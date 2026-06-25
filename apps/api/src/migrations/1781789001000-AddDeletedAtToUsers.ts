import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToUsers1781899060210 implements MigrationInterface {
  name = 'AddDeletedAtToUsers1781899060210';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deleted_at" TIMESTAMPTZ`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "deleted_at"`,
    );
  }
}
