import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsers1781410936981 implements MigrationInterface {
    name = 'CreateUsers1781410936981'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "name" character varying(100) NOT NULL, "password_hash" character varying(255) NOT NULL, "permission_version" integer NOT NULL DEFAULT '1', "is_active" boolean NOT NULL DEFAULT true, "roles" jsonb NOT NULL DEFAULT '["Audience"]', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."tickets_status_enum" AS ENUM('ACTIVE', 'USED', 'CANCELLED', 'TRANSFERRED')`);
        await queryRunner.query(`CREATE TABLE "tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" character varying NOT NULL, "ticket_type_id" character varying NOT NULL, "user_id" character varying NOT NULL, "concert_id" character varying NOT NULL, "qr_token" character varying NOT NULL, "status" "public"."tickets_status_enum" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ca4a03d058be4135bfc992479ce" UNIQUE ("qr_token"), CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bd5636236f799b19f132abf8d7" ON "tickets" ("order_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2e445270177206a97921e46171" ON "tickets" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "artists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "shortBio" text, "avatar_object_key" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_09b823d4607d2675dc4ffa82261" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."concerts_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')`);
        await queryRunner.query(`CREATE TABLE "concerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(300) NOT NULL, "artist_id" uuid NOT NULL, "organizer_id" character varying NOT NULL, "status" "public"."concerts_status_enum" NOT NULL DEFAULT 'DRAFT', "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, "sale_starts_at" TIMESTAMP WITH TIME ZONE, "sale_ends_at" TIMESTAMP WITH TIME ZONE, "venue" character varying(500), "description" text, "banner_object_key" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6ca96059628588a3988a5f3236a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_969563846063ea2b2204f5ddb9" ON "concerts" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_22a9be0ade63dfce8953c72fb0" ON "concerts" ("starts_at") `);
        await queryRunner.query(`CREATE TABLE "ticket_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "concert_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "price" numeric(15,2) NOT NULL, "total_quantity" integer NOT NULL DEFAULT '0', "sold_quantity" integer NOT NULL DEFAULT '0', "held_quantity" integer NOT NULL DEFAULT '0', "max_per_user" integer NOT NULL DEFAULT '4', "sale_starts_at" TIMESTAMP WITH TIME ZONE, "sale_ends_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_3653ff316a8c45881f80b1981d" CHECK ("sold_quantity" + "held_quantity" <= "total_quantity"), CONSTRAINT "PK_5510ce7e18a4edc648c9fbfc283" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "seat_zones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "concert_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "svg_object_key" character varying, "ticket_type_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e3e189cd9625fa371dacd6980a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" character varying NOT NULL, "idempotency_key" character varying NOT NULL, "provider_tx_id" character varying, "provider" character varying(50) NOT NULL, "amount" numeric(15,2) NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING', "raw_callback" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_59dcef70bd19850783c84f840e5" UNIQUE ("idempotency_key"), CONSTRAINT "UQ_60e40127e42dd7a263ecfc24b8e" UNIQUE ("provider_tx_id"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b2f7b823a21562eeca20e72b00" ON "payments" ("order_id") `);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('PENDING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" character varying NOT NULL, "concert_id" character varying NOT NULL, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'PENDING_PAYMENT', "total_amount" numeric(15,2) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a922b820eeef29ac1c6800e826" ON "orders" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cb77bc746d4e7b50c722fb2151" ON "orders" ("user_id", "status") `);
        await queryRunner.query(`CREATE TYPE "public"."notification_logs_type_enum" AS ENUM('TICKET_CONFIRMATION', 'REMINDER_24H', 'CONCERT_UPDATE', 'VIP_WELCOME')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_logs_channel_enum" AS ENUM('EMAIL')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_logs_status_enum" AS ENUM('QUEUED', 'SENT', 'FAILED', 'BOUNCED')`);
        await queryRunner.query(`CREATE TABLE "notification_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ticket_id" character varying NOT NULL, "user_id" character varying NOT NULL, "type" "public"."notification_logs_type_enum" NOT NULL, "channel" "public"."notification_logs_channel_enum" NOT NULL, "status" "public"."notification_logs_status_enum" NOT NULL DEFAULT 'QUEUED', "sent_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e2bdd2178fb194d0e99756b2c04" UNIQUE ("ticket_id", "type", "channel"), CONSTRAINT "PK_19c524e644cdeaebfcffc284871" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_25dc2fa07800f8aa132775fdcd" ON "notification_logs" ("ticket_id") `);
        await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "ticket_type_id" character varying NOT NULL, "quantity" integer NOT NULL DEFAULT '1', "unit_price" numeric(15,2) NOT NULL, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "vip_guests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "concert_id" character varying NOT NULL, "ticket_type_id" character varying NOT NULL, "csv_import_job_id" character varying NOT NULL, "email" character varying(255) NOT NULL, "phone" character varying(50), "name" character varying(200) NOT NULL, "dedup_key" character varying(255) NOT NULL, "ticket_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fbfcfeefd0260778e44a72acf7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_26a1838a546f3d6ae1e5f5a08b" ON "vip_guests" ("concert_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_db95171a0d4bd1ac6f7dc0c065" ON "vip_guests" ("dedup_key") `);
        await queryRunner.query(`CREATE TYPE "public"."csv_import_jobs_status_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "csv_import_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "concert_id" character varying NOT NULL, "triggered_by" character varying NOT NULL, "object_key" character varying NOT NULL, "status" "public"."csv_import_jobs_status_enum" NOT NULL DEFAULT 'PENDING', "total_rows" integer NOT NULL DEFAULT '0', "success_rows" integer NOT NULL DEFAULT '0', "error_rows" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_261509e3ef0db289de465fa2a82" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."csv_import_rows_status_enum" AS ENUM('SUCCESS', 'SKIPPED_DUPLICATE', 'ERROR')`);
        await queryRunner.query(`CREATE TABLE "csv_import_rows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "job_id" character varying NOT NULL, "row_number" integer NOT NULL, "status" "public"."csv_import_rows_status_enum" NOT NULL, "error_reason" text, CONSTRAINT "PK_1b8a81f869dddcee7e9abe04506" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0b822b435eeb129f6edb3a5a3a" ON "csv_import_rows" ("job_id") `);
        await queryRunner.query(`CREATE TYPE "public"."checkin_logs_mode_enum" AS ENUM('ONLINE', 'OFFLINE')`);
        await queryRunner.query(`CREATE TYPE "public"."checkin_logs_status_enum" AS ENUM('SUCCESS', 'ALREADY_USED', 'CONFLICT', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "checkin_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ticket_id" character varying NOT NULL, "staff_id" character varying NOT NULL, "device_id" character varying(200) NOT NULL, "mode" "public"."checkin_logs_mode_enum" NOT NULL, "status" "public"."checkin_logs_status_enum" NOT NULL, "client_event_id" character varying NOT NULL, "scanned_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_68c1ecee81f531e9a1d0e31636b" UNIQUE ("client_event_id"), CONSTRAINT "PK_5b6df439b6668ca0595ca254e94" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5e4d3266e6037e5d0cb9274256" ON "checkin_logs" ("ticket_id") `);
        await queryRunner.query(`CREATE TYPE "public"."ai_bio_requests_status_enum" AS ENUM('PENDING', 'PROCESSING', 'DRAFT', 'PUBLISHED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "ai_bio_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "artist_id" character varying NOT NULL, "requested_by" character varying NOT NULL, "pdf_object_key" character varying, "status" "public"."ai_bio_requests_status_enum" NOT NULL DEFAULT 'PENDING', "draft_content" text, "failure_reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_97739bcde793be935f982f00d01" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c17c2ae66a9629cf8d19403515" ON "ai_bio_requests" ("artist_id") `);
        await queryRunner.query(`ALTER TABLE "concerts" ADD CONSTRAINT "FK_fd2da88590ca13840dae3a22333" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "FK_bcb2c8c129a8b1673bddd479df9" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD CONSTRAINT "FK_85ecd7c8f4f82297dc4b38a2153" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP CONSTRAINT "FK_85ecd7c8f4f82297dc4b38a2153"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "FK_bcb2c8c129a8b1673bddd479df9"`);
        await queryRunner.query(`ALTER TABLE "concerts" DROP CONSTRAINT "FK_fd2da88590ca13840dae3a22333"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c17c2ae66a9629cf8d19403515"`);
        await queryRunner.query(`DROP TABLE "ai_bio_requests"`);
        await queryRunner.query(`DROP TYPE "public"."ai_bio_requests_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e4d3266e6037e5d0cb9274256"`);
        await queryRunner.query(`DROP TABLE "checkin_logs"`);
        await queryRunner.query(`DROP TYPE "public"."checkin_logs_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."checkin_logs_mode_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0b822b435eeb129f6edb3a5a3a"`);
        await queryRunner.query(`DROP TABLE "csv_import_rows"`);
        await queryRunner.query(`DROP TYPE "public"."csv_import_rows_status_enum"`);
        await queryRunner.query(`DROP TABLE "csv_import_jobs"`);
        await queryRunner.query(`DROP TYPE "public"."csv_import_jobs_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db95171a0d4bd1ac6f7dc0c065"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_26a1838a546f3d6ae1e5f5a08b"`);
        await queryRunner.query(`DROP TABLE "vip_guests"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_25dc2fa07800f8aa132775fdcd"`);
        await queryRunner.query(`DROP TABLE "notification_logs"`);
        await queryRunner.query(`DROP TYPE "public"."notification_logs_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_logs_channel_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_logs_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cb77bc746d4e7b50c722fb2151"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a922b820eeef29ac1c6800e826"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b2f7b823a21562eeca20e72b00"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`DROP TABLE "seat_zones"`);
        await queryRunner.query(`DROP TABLE "ticket_types"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_22a9be0ade63dfce8953c72fb0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_969563846063ea2b2204f5ddb9"`);
        await queryRunner.query(`DROP TABLE "concerts"`);
        await queryRunner.query(`DROP TYPE "public"."concerts_status_enum"`);
        await queryRunner.query(`DROP TABLE "artists"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2e445270177206a97921e46171"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bd5636236f799b19f132abf8d7"`);
        await queryRunner.query(`DROP TABLE "tickets"`);
        await queryRunner.query(`DROP TYPE "public"."tickets_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
