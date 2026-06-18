import { MigrationInterface, QueryRunner } from "typeorm";

export class InitRBAC1234567890123 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            -- 1. Identity Tables
            CREATE TABLE "users" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "email" varchar(255) NOT NULL UNIQUE,
                "password_hash" varchar(255) NOT NULL,
                "permission_version" int NOT NULL DEFAULT 1,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_users_email" UNIQUE ("email")
            );

            -- 2. RBAC Tables
            CREATE TABLE "roles" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" varchar(50) NOT NULL UNIQUE
            );

            CREATE TABLE "permissions" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "code" varchar(100) NOT NULL UNIQUE
            );

            -- 3. Junction Tables (RBAC & User-Role)
            CREATE TABLE "user_roles" (
                "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
                PRIMARY KEY ("user_id", "role_id")
            );

            CREATE TABLE "role_permissions" (
                "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
                "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
                PRIMARY KEY ("role_id", "permission_id")
            );

            -- 4. Critical Indexes (Performance Tuning)
            CREATE INDEX "idx_users_email" ON "users"("email");
            CREATE INDEX "idx_role_permissions_role_id" ON "role_permissions"("role_id");
            CREATE INDEX "idx_role_permissions_perm_id" ON "role_permissions"("permission_id");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "role_permissions"; DROP TABLE "user_roles"; DROP TABLE "permissions"; DROP TABLE "roles"; DROP TABLE "users";`);
    }
}