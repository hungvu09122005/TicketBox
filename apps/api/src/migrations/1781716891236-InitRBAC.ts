import { MigrationInterface, QueryRunner } from "typeorm";

export class InitRBAC1234567890123 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "users" (...);
            CREATE TABLE "roles" (...);
            CREATE TABLE "permissions" (...);
            CREATE TABLE "user_roles" (...);
            CREATE TABLE "role_permissions" (...);
            -- Thêm các index phục vụ lookup
            CREATE INDEX idx_users_email ON "users"(email);
            CREATE INDEX idx_role_permissions_role ON "role_permissions"(role_id);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE ...`);
    }
}