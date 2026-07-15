import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPermissionCode1781844698099 implements MigrationInterface {
    name = 'AddPermissionCode1781844698099'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "FK_bcb2c8c129a8b1673bddd479df9"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_b8230bc6f1f5cf7cf09ea0d7b5"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_3679a297c91368649a2214406a"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_8724d3bc7eca86910601da5cf0"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_3653ff316a8c45881f80b1981d"`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "svg_path"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "svg_object_key"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "ticket_type_id"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "concert_id"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "sale_starts_at"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "sale_ends_at"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "avatar_object_key"`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "shortBio"`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "shortBio" text`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "avatar_object_key" character varying`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "svg_object_key" character varying`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "ticket_type_id" character varying`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "concert_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "sale_starts_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "sale_ends_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "svg_path" character varying`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "description" text`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "name" character varying(200) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "name" character varying(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ALTER COLUMN "price" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ALTER COLUMN "total_quantity" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ALTER COLUMN "max_per_user" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "CHK_3653ff316a8c45881f80b1981d" CHECK ("sold_quantity" + "held_quantity" <= "total_quantity")`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "CHK_b8230bc6f1f5cf7cf09ea0d7b5" CHECK (max_per_user > 0)`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "CHK_3679a297c91368649a2214406a" CHECK (total_quantity >= 0)`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "CHK_8724d3bc7eca86910601da5cf0" CHECK (price >= 0)`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "FK_bcb2c8c129a8b1673bddd479df9" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "UQ_provider_tx_id" UNIQUE ("provider_tx_id")`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "order_id" TYPE uuid USING "order_id"::uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "FK_bcb2c8c129a8b1673bddd479df9"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_8724d3bc7eca86910601da5cf0"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_3679a297c91368649a2214406a"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_b8230bc6f1f5cf7cf09ea0d7b5"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "CHK_3653ff316a8c45881f80b1981d"`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "name" character varying(200) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ALTER COLUMN "max_per_user" SET DEFAULT '4'`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ALTER COLUMN "total_quantity" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ALTER COLUMN "price" TYPE numeric(15,2)`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "name" character varying(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "name" character varying(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "svg_path"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "sale_ends_at"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "sale_starts_at"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP COLUMN "concert_id"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "ticket_type_id"`);
        await queryRunner.query(`ALTER TABLE "seat_zones" DROP COLUMN "svg_object_key"`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "avatar_object_key"`);
        await queryRunner.query(`ALTER TABLE "artists" DROP COLUMN "shortBio"`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "shortBio" text`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "avatar_object_key" character varying`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "sale_ends_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "sale_starts_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "concert_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "ticket_type_id" character varying`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "svg_object_key" character varying`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "seat_zones" ADD "svg_path" character varying`);
        await queryRunner.query(`ALTER TABLE "artists" ADD "description" text`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "CHK_3653ff316a8c45881f80b1981d" CHECK (((sold_quantity + held_quantity) <= total_quantity))`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "CHK_8724d3bc7eca86910601da5cf0" CHECK ((price >= (0)::numeric))`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "CHK_3679a297c91368649a2214406a" CHECK ((total_quantity >= 0))`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "CHK_b8230bc6f1f5cf7cf09ea0d7b5" CHECK ((max_per_user > 0))`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "FK_bcb2c8c129a8b1673bddd479df9" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
