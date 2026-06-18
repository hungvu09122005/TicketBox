import { DataSource } from 'typeorm';
import { Role } from '../modules/users/entities/role.entity';
import { Permission } from '../modules/users/entities/permission.entity';

export async function seedRbac(dataSource: DataSource) {
  const roleRepo = dataSource.getRepository(Role);
  const permRepo = dataSource.getRepository(Permission);

  const permissions = [
    { name: 'TICKET_CREATE' },
    { name: 'TICKET_VALIDATE' },
    { name: 'CONCERT_MANAGE' },
    { name: 'USER_BAN' }
  ];

  const savedPermissions = await permRepo.save(permissions);
  console.log('✅ Permissions seeded:', savedPermissions.length);

  const roles = [
    { name: 'ADMIN', permissions: savedPermissions },
    { name: 'STAFF', permissions: savedPermissions.filter(p => p.name === 'TICKET_VALIDATE') },
    { name: 'AUDIENCE', permissions: [] }
  ];

  await roleRepo.save(roles);
  console.log('✅ Roles seeded successfully!');
}