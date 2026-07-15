import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixOrdersUserIdType1782244000000 implements MigrationInterface {
  name = 'FixOrdersUserIdType1782244000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'orders'
            AND column_name = 'user_id'
            AND data_type <> 'uuid'
        ) THEN
          ALTER TABLE "orders"
            ALTER COLUMN "user_id" TYPE uuid
            USING "user_id"::uuid;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'orders'
            AND column_name = 'user_id'
            AND data_type = 'uuid'
        ) THEN
          ALTER TABLE "orders"
            ALTER COLUMN "user_id" TYPE character varying
            USING "user_id"::text;
        END IF;
      END $$;
    `);
  }
}
