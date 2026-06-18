import { DataSource } from 'typeorm';
import { Role } from '../modules/users/entities/role.entity';
import { Permission } from '../modules/users/entities/permission.entity';

export async function seedRbac(dataSource: DataSource) {
  const roleRepo = dataSource.getRepository(Role);
  const permRepo = dataSource.getRepository(Permission);

  const permissions = [
    { name: 'Create Ticket', code: 'TICKET_CREATE' },
    { name: 'Validate Ticket', code: 'TICKET_VALIDATE' },
    { name: 'Manage Concert', code: 'CONCERT_MANAGE' },
    { name: 'Ban User', code: 'USER_BAN' }
  ];

  for (const permData of permissions) {
    // Tìm xem đã tồn tại chưa
    const existing = await permRepo.findOne({ where: { code: permData.code } });
    if (!existing) {
      await permRepo.save(permData);
      console.log(`✅ Created permission: ${permData.code}`);
    }
  }

  // Tương tự với Roles
  const roles = ['ADMIN', 'STAFF', 'AUDIENCE'];
  for (const roleName of roles) {
    const existing = await roleRepo.findOne({ where: { name: roleName } });
    if (!existing) {
      await roleRepo.save({ name: roleName });
      console.log(`✅ Created role: ${roleName}`);
    }
  }

}