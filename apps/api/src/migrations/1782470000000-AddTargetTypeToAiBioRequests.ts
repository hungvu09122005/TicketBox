import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTargetTypeToAiBioRequests1782470000000 implements MigrationInterface {
  name = 'AddTargetTypeToAiBioRequests1782470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."ai_bio_requests_target_type_enum" AS ENUM('ARTIST', 'CONCERT')`);
    await queryRunner.query(`ALTER TABLE "ai_bio_requests" ADD "target_type" "public"."ai_bio_requests_target_type_enum" NOT NULL DEFAULT 'ARTIST'`);
    await queryRunner.query(`ALTER TABLE "ai_bio_requests" ADD "target_id" character varying`);
    await queryRunner.query(`UPDATE "ai_bio_requests" SET "target_id" = "artist_id" WHERE "target_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "ai_bio_requests" ALTER COLUMN "target_id" SET NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_ae4eb5beec1b3f7d2f0e2d26d7" ON "ai_bio_requests" ("target_id") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_ae4eb5beec1b3f7d2f0e2d26d7"`);
    await queryRunner.query(`ALTER TABLE "ai_bio_requests" DROP COLUMN "target_id"`);
    await queryRunner.query(`ALTER TABLE "ai_bio_requests" DROP COLUMN "target_type"`);
    await queryRunner.query(`DROP TYPE "public"."ai_bio_requests_target_type_enum"`);
  }
}
