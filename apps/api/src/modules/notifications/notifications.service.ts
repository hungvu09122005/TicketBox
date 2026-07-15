import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NotificationsRepository } from './notifications.repository';
import { NotificationChannel, NotificationStatus, NotificationType } from './entities/notification-log.entity';

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

  async queueTicketConfirmation(params: {
  toEmail: string;
  toName: string;
  ticketId: string;
  userId: string;
  orderId: string;
  concertName: string;
  concertDate: string | Date;
  venue: string;
  ticketTypeName: string;
  qrToken: string;
}) {
    const type = NotificationType.TICKET_CONFIRMATION;
    const channel = NotificationChannel.EMAIL;
    const jobId = `notification.ticket_confirmation:${params.ticketId}`;

    const existing = await this.repo.findByTicketTypeChannel(params.ticketId, type, channel);
    if (existing && existing.status !== NotificationStatus.FAILED) {
      return { success: true, message: 'Notification is already queued or sent.', logId: existing.id };
    }

    const log = existing
      ? existing
      : await this.repo.createLog({
          ticketId: params.ticketId,
          userId: params.userId,
          type,
          channel,
          status: NotificationStatus.QUEUED,
        });

    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
    }
    if (existing) {
      await this.repo.markQueued(existing.id);
    }

    await this.queue.add(
      'notification.ticket_confirmation',
      {
        toEmail: params.toEmail,
        toName: params.toName,
        ticketId: params.ticketId,
        userId: params.userId,
        orderId: params.orderId,
        concertName: params.concertName,
        concertDate: params.concertDate,
        venue: params.venue,
        ticketTypeName: params.ticketTypeName,
        qrToken: params.qrToken,
        type,
        channel,
        logId: log.id,
      },
      {
        
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: false,

      },
    );

    return { success: true, message: 'Ticket confirmation queued.', logId: log.id };
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

    if (job.data?.logId) {
      await this.repo.markQueued(String(job.data.logId));
      await this.repo.updateFailureReason(String(job.data.logId), '');
    }

    await job.retry();
    return { success: true, message: `Job ${id} is being retried` };
  }

  async queueVipWelcome(params: {
    toEmail: string;
    toName: string;
    ticketId: string;
    userId: string;
    concertName: string;
  }) {
    const type = NotificationType.VIP_WELCOME;
    const channel = NotificationChannel.EMAIL;
    const jobId = `notification.vip_welcome:${params.ticketId}`;

    const existing = await this.repo.findByTicketTypeChannel(params.ticketId, type, channel);
    if (existing && existing.status !== NotificationStatus.FAILED) {
      return { success: true, message: 'Notification is already queued or sent.', logId: existing.id };
    }

    const log = existing
      ? existing
      : await this.repo.createLog({
          ticketId: params.ticketId,
          userId: params.userId,
          type,
          channel,
          status: NotificationStatus.QUEUED,
        });

    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
    }
    if (existing) {
      await this.repo.markQueued(existing.id);
    }

    await this.queue.add(
      'notification.vip_welcome',
      {
        toEmail: params.toEmail,
        toName: params.toName,
        ticketId: params.ticketId,
        userId: params.userId,
        concertName: params.concertName,
        type,
        channel,
        logId: log.id,
      },
      {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: false,
      },
    );

    return { success: true, message: 'VIP welcome notification queued.', logId: log.id };
  }

  async queueConcertReminder(params: {
  toEmail: string;
  toName: string;
  ticketId: string;
  userId: string;
  concertName: string;
  concertDate: string | Date;
  venue: string;
  ticketTypeName: string;
}) {
  const type = NotificationType.REMINDER_24H;
  const channel = NotificationChannel.EMAIL;
  const jobId = `notification.concert_reminder:${params.ticketId}`;

  const log = await this.repo.createQueuedLogIfAbsent({
    ticketId: params.ticketId,
    userId: params.userId,
    type,
    channel,
  });

  if (!log) {
    return {
      success: true,
      skipped: true,
      message: '24h reminder already queued or sent.',
    };
  }

  await this.queue.add(
    'notification.concert_reminder',
    {
      toEmail: params.toEmail,
      toName: params.toName,
      ticketId: params.ticketId,
      userId: params.userId,
      concertName: params.concertName,
      concertDate: params.concertDate,
      venue: params.venue,
      ticketTypeName: params.ticketTypeName,
      type,
      channel,
      logId: log.id,
    },
    {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 3600,
        count: 100,
      },
      removeOnFail: false,
    },
  );

  return {
    success: true,
    skipped: false,
    message: '24h reminder queued.',
    logId: log.id,
  };
}



}
