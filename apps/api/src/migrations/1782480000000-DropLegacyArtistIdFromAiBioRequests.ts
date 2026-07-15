import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropLegacyArtistIdFromAiBioRequests1782480000000 implements MigrationInterface {
  name = 'DropLegacyArtistIdFromAiBioRequests1782480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_c17c2ae66a9629cf8d19403515"`);
    await queryRunner.query(`ALTER TABLE "ai_bio_requests" DROP COLUMN IF EXISTS "artist_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_bio_requests" ADD "artist_id" character varying NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_c17c2ae66a9629cf8d19403515" ON "ai_bio_requests" ("artist_id") `);
  }
}
