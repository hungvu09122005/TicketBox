import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCheckinLogs1781669131019 implements MigrationInterface {
    name = 'CreateCheckinLogs1781669131019'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Dọn dẹp dữ liệu NULL trước khi áp đặt NOT NULL
        await queryRunner.query(`UPDATE "artists" SET "name" = 'Untitled' WHERE "name" IS NULL`);
        await queryRunner.query(`UPDATE "seat_zones" SET "name" = 'Untitled Zone' WHERE "name" IS NULL`);
        await queryRunner.query(`UPDATE "ticket_types" SET "name" = 'Untitled Ticket' WHERE "name" IS NULL`);
        await queryRunner.query(`UPDATE "ticket_types" SET "concert_id" = NULL WHERE "concert_id" IS NULL`);

        // 2. Các thay đổi về cấu trúc bảng (Giữ nguyên logic của bạn)
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "FK_bcb2c8c129a8b1673bddd479df9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e4d3266e6037e5d0cb9274256"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_3653ff316a8c45881f80b1981d"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_b8230bc6f1f5cf7cf09ea0d7b5"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_3679a297c91368649a2214406a"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_8724d3bc7eca86910601da5cf0"`);

        // 3. Thay đổi cột an toàn bằng ALTER COLUMN thay vì DROP/ADD
        await queryRunner.query(`ALTER TABLE "seat_zones" ALTER COLUMN "name" TYPE character varying(100)`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ALTER COLUMN "name" SET NOT NULL`);
        
        await queryRunner.query(`ALTER TABLE "ticket_types" ALTER COLUMN "name" TYPE character varying(100)`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ALTER COLUMN "name" SET NOT NULL`);
        
        await queryRunner.query(`ALTER TABLE "artists" ALTER COLUMN "name" SET NOT NULL`);

        // 4. Tạo bảng checkin_logs và các cột mới
        // Lưu ý: Đảm bảo bạn đã định nghĩa bảng checkin_logs ở đây nếu nó chưa tồn tại
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "checkin_logs" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "ticket_id" varchar NOT NULL, "staff_id" varchar, "device_id" varchar(200) NOT NULL, "mode" varchar DEFAULT 'ONLINE', "status" varchar NOT NULL, "client_event_id" varchar NOT NULL, "scanned_at" timestamptz NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "conflict_reason" varchar, "sync_at" timestamptz)`);
        
        // 5. Thêm Index
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dafb472d502a610f3992355892" ON "checkin_logs" ("client_event_id", "device_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_cf4123939455b7b53d149a6f95" ON "checkin_logs" ("ticket_id", "scanned_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Logic rollback (thường ít dùng trong dev)
        await queryRunner.query(`DROP TABLE "checkin_logs"`);
    }
}