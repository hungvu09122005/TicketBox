import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManualCodeToTickets1782460000000 implements MigrationInterface {
  name = 'AddManualCodeToTickets1782460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "manual_code" character varying(12)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tickets_manual_code" ON "tickets" ("manual_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tickets_manual_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "tickets" DROP COLUMN IF EXISTS "manual_code"
    `);
  }
}
