import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedRbac1781789000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO permissions (id, name) VALUES
            (gen_random_uuid(), 'concert:read_public'),
            (gen_random_uuid(), 'concert:read_own'),
            (gen_random_uuid(), 'concert:read_all'),
            (gen_random_uuid(), 'concert:create'),
            (gen_random_uuid(), 'concert:update_own'),
            (gen_random_uuid(), 'concert:update_all'),
            (gen_random_uuid(), 'concert:publish_own'),
            (gen_random_uuid(), 'concert:publish_all'),
            (gen_random_uuid(), 'concert:cancel_own'),
            (gen_random_uuid(), 'concert:cancel_all'),
            (gen_random_uuid(), 'artist:read'),
            (gen_random_uuid(), 'artist:create'),
            (gen_random_uuid(), 'artist:update'),
            (gen_random_uuid(), 'artist:delete'),
            (gen_random_uuid(), 'venue:read'),
            (gen_random_uuid(), 'venue:create'),
            (gen_random_uuid(), 'venue:update'),
            (gen_random_uuid(), 'venue:delete'),
            (gen_random_uuid(), 'ticket_type:read'),
            (gen_random_uuid(), 'ticket_type:create'),
            (gen_random_uuid(), 'ticket_type:update'),
            (gen_random_uuid(), 'ticket_type:delete'),
            (gen_random_uuid(), 'seatmap:read'),
            (gen_random_uuid(), 'seatmap:update'),
            (gen_random_uuid(), 'seatmap:upload'),
            (gen_random_uuid(), 'order:create'),
            (gen_random_uuid(), 'order:read_own'),
            (gen_random_uuid(), 'order:read_all'),
            (gen_random_uuid(), 'order:refund'),
            (gen_random_uuid(), 'ticket:view_own'),
            (gen_random_uuid(), 'ticket:validate'),
            (gen_random_uuid(), 'vip:import'),
            (gen_random_uuid(), 'ai:generate_bio'),
            (gen_random_uuid(), 'report:view'),
            (gen_random_uuid(), 'report:export'),
            (gen_random_uuid(), 'role:update_permissions'),
            (gen_random_uuid(), 'permission:read'),
            (gen_random_uuid(), 'permission:create'),
            (gen_random_uuid(), 'rbac:manage')
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
        await queryRunner.query(`DELETE FROM permissions WHERE name IN ('concert:read_public', 'concert:read_own', 'concert:read_all', 'concert:create', 'concert:update_own', 'concert:update_all', 'concert:publish_own', 'concert:publish_all', 'concert:cancel_own', 'concert:cancel_all', 'artist:read', 'artist:create', 'artist:update', 'artist:delete', 'venue:read', 'venue:create', 'venue:update', 'venue:delete', 'ticket_type:read', 'ticket_type:create', 'ticket_type:update', 'ticket_type:delete', 'seatmap:read', 'seatmap:update', 'seatmap:upload', 'order:create', 'order:read_own', 'order:read_all', 'order:refund', 'ticket:view_own', 'ticket:validate', 'vip:import', 'ai:generate_bio', 'report:view', 'report:export', 'role:update_permissions', 'permission:read', 'permission:create', 'rbac:manage');`);
        await queryRunner.query(`DELETE FROM roles WHERE name IN ('AUDIENCE', 'ORGANIZER', 'CHECKIN_STAFF', 'SYSTEM_ADMIN');`);
    }

}
