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

  private normalizeState(state?: string): string {
    switch (state) {
      case 'waiting':
      case 'delayed':
        return 'PENDING';
      case 'active':
        return 'PROCESSING';
      case 'completed':
        return 'SUCCESS';
      case 'failed':
        return 'FAILED';
      default:
        return state?.toUpperCase() ?? 'UNKNOWN';
    }
  }

  private mapJob(job: any, state: string) {
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      status: this.normalizeState(state),
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
    };
  }

  async getJobs(status?: string): Promise<any[]> {
    const normalizedStatus = status?.toUpperCase();

    if (normalizedStatus === 'FAILED') {
      const failedJobs = await this.queue.getFailed();
      return failedJobs.map((job: any) => this.mapJob(job, 'failed'));
    }

    if (normalizedStatus === 'PENDING') {
      const waitingJobs = await this.queue.getWaiting();
      const delayedJobs = await this.queue.getDelayed();
      return [
        ...waitingJobs.map((job: any) => this.mapJob(job, 'waiting')),
        ...delayedJobs.map((job: any) => this.mapJob(job, 'delayed')),
      ];
    }

    if (normalizedStatus === 'PROCESSING') {
      const activeJobs = await this.queue.getActive();
      return activeJobs.map((job: any) => this.mapJob(job, 'active'));
    }

    if (normalizedStatus === 'SUCCESS') {
      const completedJobs = await this.queue.getCompleted();
      return completedJobs.map((job: any) => this.mapJob(job, 'completed'));
    }

    const [waitingJobs, activeJobs, completedJobs, failedJobs, delayedJobs] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
      this.queue.getDelayed(),
    ]);

    return [
      ...waitingJobs.map((job: any) => this.mapJob(job, 'waiting')),
      ...activeJobs.map((job: any) => this.mapJob(job, 'active')),
      ...completedJobs.map((job: any) => this.mapJob(job, 'completed')),
      ...failedJobs.map((job: any) => this.mapJob(job, 'failed')),
      ...delayedJobs.map((job: any) => this.mapJob(job, 'delayed')),
    ];
  }

  async getJob(id: string): Promise<any> {
    const job = await this.queue.getJob(id);
    if (!job) {
      return null;
    }
    const state = await job.getState();
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      status: this.normalizeState(state),
      rawStatus: state,
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
