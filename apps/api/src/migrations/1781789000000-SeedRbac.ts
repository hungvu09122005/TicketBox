import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedRbac1781789000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO permissions (id, name) VALUES
            (gen_random_uuid(), 'concert:read'),
            (gen_random_uuid(), 'concert:create'),
            (gen_random_uuid(), 'concert:update'),
            (gen_random_uuid(), 'order:create'),
            (gen_random_uuid(), 'order:read_own'),
            (gen_random_uuid(), 'order:read_all'),
            (gen_random_uuid(), 'ticket:view_own'),
            (gen_random_uuid(), 'ticket:validate'),
            (gen_random_uuid(), 'vip:import'),
            (gen_random_uuid(), 'ai:generate_bio'),
            (gen_random_uuid(), 'rbac:manage'),
            (gen_random_uuid(), 'report:view')
            ON CONFLICT (name) DO NOTHING;
        `);

        await queryRunner.query(`
            INSERT INTO roles (id, name) VALUES
            (gen_random_uuid(), 'AUDIENCE'),
            (gen_random_uuid(), 'ORGANIZER'),
            (gen_random_uuid(), 'CHECKIN_STAFF'),
            (gen_random_uuid(), 'SYSTEM_ADMIN')
            ON CONFLICT (name) DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM permissions WHERE name IN ('concert:read', 'concert:create', 'concert:update', 'order:create', 'order:read_own', 'order:read_all', 'ticket:view_own', 'ticket:validate', 'vip:import', 'ai:generate_bio', 'rbac:manage', 'report:view');`);
        await queryRunner.query(`DELETE FROM roles WHERE name IN ('AUDIENCE', 'ORGANIZER', 'CHECKIN_STAFF', 'SYSTEM_ADMIN');`);
    }

}
