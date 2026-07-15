import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFailureReasonToNotificationLogs1782372768844 implements MigrationInterface {
  name = 'AddFailureReasonToNotificationLogs1782372768844';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "failure_reason" text');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "notification_logs" DROP COLUMN IF EXISTS "failure_reason"');
  }
}
