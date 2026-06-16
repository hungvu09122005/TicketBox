import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedRbac1781594847577 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Chèn dữ liệu vào bảng permissions
        // Sửa đoạn INSERT trong file SeedRbac.ts thành:
        await queryRunner.query(`
            INSERT INTO permissions (id, name) VALUES 
            (gen_random_uuid(), 'TICKET_CREATE'),
            (gen_random_uuid(), 'TICKET_VALIDATE')
            ON CONFLICT (name) DO NOTHING; 
        `);
        // Lấy ID vừa tạo để gán vào Roles (ví dụ đơn giản hóa)
        // Lưu ý: Nếu bạn muốn an toàn hơn, hãy dùng Repository trong migration
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM permissions WHERE name IN ('TICKET_CREATE', 'TICKET_VALIDATE');`);
    }
}