import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';

export interface QueueTokenPayload {
  sub: string; // userId
  concertId: string;
  type: 'QUEUE_TOKEN';
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  
  // Maximum number of active checkout sessions allowed concurrently per concert
  private readonly MAX_ACTIVE_TOKENS = 100;
  // How long an active token stays valid (in seconds) - 5 minutes
  private readonly ACTIVE_TTL_SECONDS = 300;

  constructor(
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Tries to admit user directly, or queues them if over capacity.
   * Returns:
   * - { status: 'ACTIVE' } if they can proceed
   * - { status: 'QUEUED', queueToken: string } if they are placed in waiting room
   */
  async handleCheckoutRequest(concertId: string, userId: string): Promise<{ status: 'ACTIVE' | 'QUEUED', queueToken?: string }> {
    const redis = this.redisService.getClient();
    const activeKey = `waiting_room:${concertId}:active`;
    const queueKey = `waiting_room:${concertId}:queue`;
    const now = Date.now();

    // 1. Check if user is already active
    const score = await redis.zscore(activeKey, userId);
    if (score && parseInt(score, 10) > now) {
      return { status: 'ACTIVE' }; // Still valid
    }

    // Clean up expired active tokens
    await redis.zremrangebyscore(activeKey, 0, now);

    // 2. Check current capacity
    const activeCount = await redis.zcard(activeKey);
    if (activeCount < this.MAX_ACTIVE_TOKENS) {
      // Admit directly
      const expiry = now + (this.ACTIVE_TTL_SECONDS * 1000);
      await redis.zadd(activeKey, expiry, userId);
      return { status: 'ACTIVE' };
    }

    // 3. Capacity full, enqueue user
    await redis.zadd(queueKey, 'NX', now, userId); // Use NX so we don't overwrite their place in line if they spam

    // Generate JWT token
    const payload: QueueTokenPayload = {
      sub: userId,
      concertId,
      type: 'QUEUE_TOKEN',
    };
    
    // Set a very long expiry for queue token as they might wait for a while (e.g. 2 hours)
    const queueToken = this.jwtService.sign(payload, { expiresIn: '2h' });

    return { status: 'QUEUED', queueToken };
  }

  /**
   * Verify if a queue token is valid and currently ACTIVE.
   */
  async verifyAndCheckActive(concertId: string, token: string): Promise<{ isValid: boolean, isActive: boolean, userId?: string }> {
    try {
      const payload = this.jwtService.verify<QueueTokenPayload>(token);
      if (payload.type !== 'QUEUE_TOKEN' || payload.concertId !== concertId) {
        return { isValid: false, isActive: false };
      }

      const redis = this.redisService.getClient();
      const activeKey = `waiting_room:${concertId}:active`;
      
      const score = await redis.zscore(activeKey, payload.sub);
      const isActive = score !== null && parseInt(score, 10) > Date.now();

      return { isValid: true, isActive, userId: payload.sub };
    } catch (e) {
      return { isValid: false, isActive: false };
    }
  }

  /**
   * Poll endpoint: Get user's position in queue.
   */
  async getQueueStatus(concertId: string, userId: string): Promise<{ status: 'ACTIVE' | 'QUEUED', position?: number }> {
    const redis = this.redisService.getClient();
    const activeKey = `waiting_room:${concertId}:active`;
    const queueKey = `waiting_room:${concertId}:queue`;
    const now = Date.now();

    // Check active
    const score = await redis.zscore(activeKey, userId);
    if (score && parseInt(score, 10) > now) {
      // Remove from queue just in case
      await redis.zrem(queueKey, userId);
      return { status: 'ACTIVE' };
    }

    // Check queue
    const rank = await redis.zrank(queueKey, userId);
    if (rank !== null) {
      return { status: 'QUEUED', position: rank + 1 }; // 0-indexed to 1-indexed
    }

    // Neither active nor in queue (expired active or dropped)
    return { status: 'QUEUED', position: -1 }; 
  }

  /**
   * Worker task: Admits users from queue to active state.
   */
  async admitUsersFromQueue(concertId: string): Promise<number> {
    const redis = this.redisService.getClient();
    const activeKey = `waiting_room:${concertId}:active`;
    const queueKey = `waiting_room:${concertId}:queue`;
    const now = Date.now();

    // Clean expired
    await redis.zremrangebyscore(activeKey, 0, now);

    const activeCount = await redis.zcard(activeKey);
    const availableSlots = this.MAX_ACTIVE_TOKENS - activeCount;

    if (availableSlots <= 0) {
      return 0; // Full
    }

    // Pop the oldest users from queue (FIFO)
    // zpopmin returns array like: [ member1, score1, member2, score2 ]
    const popped = await redis.zpopmin(queueKey, availableSlots);
    if (popped.length === 0) return 0;

    let admittedCount = 0;
    const expiry = now + (this.ACTIVE_TTL_SECONDS * 1000);
    
    // Add to active set
    const pipeline = redis.pipeline();
    for (let i = 0; i < popped.length; i += 2) {
      const userId = popped[i];
      pipeline.zadd(activeKey, expiry, userId);
      admittedCount++;
    }
    await pipeline.exec();

    this.logger.log(`Admitted ${admittedCount} users to active waiting room for concert ${concertId}`);
    return admittedCount;
  }
}
