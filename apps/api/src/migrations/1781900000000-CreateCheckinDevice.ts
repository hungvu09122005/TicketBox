import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCheckinDevice1781900000000 implements MigrationInterface {
    name = 'CreateCheckinDevice1781900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "public"."checkin_devices_status_enum" AS ENUM('ACTIVE', 'REVOKED')
        `);
        await queryRunner.query(`
            CREATE TABLE "checkin_devices" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(100) NOT NULL,
                "staff_id" character varying NOT NULL,
                "concert_id" character varying NOT NULL,
                "zone_id" character varying,
                "gate" character varying(100),
                "status" "public"."checkin_devices_status_enum" NOT NULL DEFAULT 'ACTIVE',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_checkin_devices" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_checkin_devices_staff_id" ON "checkin_devices" ("staff_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_checkin_devices_concert_id" ON "checkin_devices" ("concert_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_checkin_devices_concert_id"`);
        await queryRunner.query(`DROP INDEX "IDX_checkin_devices_staff_id"`);
        await queryRunner.query(`DROP TABLE "checkin_devices"`);
        await queryRunner.query(`DROP TYPE "public"."checkin_devices_status_enum"`);
    }
}
