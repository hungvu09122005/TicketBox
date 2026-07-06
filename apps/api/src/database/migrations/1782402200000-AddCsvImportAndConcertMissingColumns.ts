import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCsvImportAndConcertMissingColumns1782402200000 implements MigrationInterface {
  name = "AddCsvImportAndConcertMissingColumns1782402200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE csv_import_jobs
      ADD COLUMN IF NOT EXISTS failure_reason TEXT
    `);

    await queryRunner.query(`
      ALTER TABLE concerts
      ADD COLUMN IF NOT EXISTS banner_object_key TEXT,
      ADD COLUMN IF NOT EXISTS sale_starts_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE concerts
      DROP COLUMN IF EXISTS sale_ends_at,
      DROP COLUMN IF EXISTS sale_starts_at,
      DROP COLUMN IF EXISTS banner_object_key
    `);

    await queryRunner.query(`
      ALTER TABLE csv_import_jobs
      DROP COLUMN IF EXISTS failure_reason
    `);
  }
}
