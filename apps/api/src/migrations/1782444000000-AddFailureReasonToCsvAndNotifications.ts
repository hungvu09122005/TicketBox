import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFailureReasonToCsvAndNotifications1782444000000 implements MigrationInterface {
  name = 'AddFailureReasonToCsvAndNotifications1782444000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "csv_import_jobs" ADD COLUMN IF NOT EXISTS "failure_reason" text;
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "failure_reason" text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "csv_import_jobs" DROP COLUMN IF EXISTS "failure_reason";
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_logs" DROP COLUMN IF EXISTS "failure_reason";
    `);
  }
}
