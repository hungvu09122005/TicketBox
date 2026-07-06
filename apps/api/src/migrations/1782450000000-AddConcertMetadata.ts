import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConcertMetadata1782450000000 implements MigrationInterface {
  name = 'AddConcertMetadata1782450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "banner_object_key" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "description" text
    `);
    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "venue" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "sale_starts_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "sale_ends_at" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "concerts" DROP COLUMN IF EXISTS "sale_ends_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "concerts" DROP COLUMN IF EXISTS "sale_starts_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "concerts" DROP COLUMN IF EXISTS "venue"
    `);
    await queryRunner.query(`
      ALTER TABLE "concerts" DROP COLUMN IF EXISTS "description"
    `);
    await queryRunner.query(`
      ALTER TABLE "concerts" DROP COLUMN IF EXISTS "banner_object_key"
    `);
  }
}
