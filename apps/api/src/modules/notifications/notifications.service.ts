import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NotificationsRepository } from './notifications.repository';

/**
 * NotificationsService — exported surface consumed by PaymentsModule and CsvImportModule.
 * Enqueuing is idempotent: checks notification_logs UNIQUE constraint before enqueueing.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly repo: NotificationsRepository,
    @InjectQueue('notifications') private readonly queue: Queue,
  ) {}

  async getJobs(status?: string): Promise<any[]> {
    if (status === 'FAILED') {
      const failedJobs = await this.queue.getFailed();
      return failedJobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn,
        attemptsMade: job.attemptsMade,
      }));
    }
    // Return empty array for other statuses for now, or implement active/waiting/delayed
    return [];
  }

  async getJob(id: string): Promise<any> {
    const job = await this.queue.getJob(id);
    if (!job) {
      return null;
    }
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      status: await job.getState(),
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
    };
  }

  async retryJob(id: string): Promise<{ success: boolean; message: string }> {
    const job = await this.queue.getJob(id);
    if (!job) {
      return { success: false, message: 'Job not found' };
    }
    const state = await job.getState();
    if (state !== 'failed') {
      return { success: false, message: `Cannot retry job in state: ${state}` };
    }
    await job.retry();
    return { success: true, message: `Job ${id} is being retried` };
  }
}
