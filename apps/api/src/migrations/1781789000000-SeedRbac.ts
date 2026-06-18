import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedRbac1781789000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO permissions (id, name) VALUES 
            (gen_random_uuid(), 'TICKET_CREATE'),
            (gen_random_uuid(), 'TICKET_VALIDATE')
            ON CONFLICT (name) DO NOTHING; 
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM permissions WHERE name IN ('TICKET_CREATE', 'TICKET_VALIDATE');`);
    }

}
