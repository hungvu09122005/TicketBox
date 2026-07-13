import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_POLICY_KEY, RateLimitPolicyName } from '../decorators/rate-limit.decorator';
import { RedisService } from '../../modules/redis/redis.service';

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

const POLICIES: Record<RateLimitPolicyName, RateLimitConfig> = {
  public:  { limit: 100, windowSeconds: 60 },   // Blueprint §07 mục 1.2: 100 req/min theo IP
  order:   { limit: 5,   windowSeconds: 60 },   // Blueprint §07 mục 1.2: 5 req/min theo User ID
  payment: { limit: 5,   windowSeconds: 60 },   // Blueprint §07 mục 1.2: 5 req/min theo User ID
  checkin: { limit: 60,  windowSeconds: 60 },   // Blueprint §07 mục 1.2: 60 req/min theo Device+Staff
  sync:    { limit: 10,  windowSeconds: 60 },   // Blueprint §07 mục 1.2: 10 req/min theo Device+Staff
  admin:   { limit: 3,   windowSeconds: 60 },   // Blueprint §07 mục 1.2: 3 req/min theo Staff ID
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyName = this.reflector.getAllAndOverride<RateLimitPolicyName>(RATE_LIMIT_POLICY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!policyName) {
      return true; // No rate limit policy applied
    }

    const config = POLICIES[policyName];
    if (!config) {
      this.logger.warn(`Unknown rate limit policy: ${policyName}`);
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // Determine identifier
    let identifier = request.ip || 'unknown-ip';
    if (['order', 'payment', 'admin'].includes(policyName) && request.user?.sub) {
      identifier = request.user.sub;
    } else if (['checkin', 'sync'].includes(policyName) && request.body?.device_id) {
      identifier = request.body.device_id;
    } else if (['checkin', 'sync'].includes(policyName) && request.user?.sub) {
      // Offline sync device is the sub in JWT
      identifier = request.user.sub;
    }

    const key = `ratelimit:${policyName}:${identifier}`;
    const now = Date.now();
    const windowStart = now - (config.windowSeconds * 1000);

    const redis = this.redisService.getClient();

    try {
      // Pipeline for Sliding Window Log using Sorted Set
      const pipeline = redis.pipeline();
      
      // 1. Remove timestamps older than the window
      pipeline.zremrangebyscore(key, 0, windowStart);
      
      // 2. Add current timestamp with unique ID to prevent collisions
      const memberId = `${now}-${Math.random().toString(36).substring(2, 9)}`;
      pipeline.zadd(key, now, memberId);
      
      // 3. Count requests in the window
      pipeline.zcard(key);
      
      // 4. Update expiry of the key
      pipeline.expire(key, config.windowSeconds);
      
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error('Redis pipeline failed');
      }

      // The 3rd command is ZCARD (index 2 in results)
      const countResult = results[2];
      const count = countResult[1] as number;

      if (count > config.limit) {
        response.header('Retry-After', config.windowSeconds.toString());
        throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
      }

      // Set informative headers
      response.header('X-RateLimit-Limit', config.limit.toString());
      response.header('X-RateLimit-Remaining', Math.max(0, config.limit - count).toString());

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`RateLimitGuard error: ${error.message}`, error.stack);
      // Fail open if Redis is down
      return true;
    }
  }
}
