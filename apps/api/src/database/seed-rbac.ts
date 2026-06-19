import { DataSource } from 'typeorm';
import { In } from 'typeorm';
import { Role as RoleEntity } from '../modules/users/entities/role.entity';
import { Permission as PermissionEntity } from '../modules/users/entities/permission.entity';
import { Permission } from '../common/constants/permissions.enum';
import { Role } from '../common/constants/roles.enum';
import { ROLE_PERMISSIONS_MAPPING } from '../common/constants/role-permissions.mapping';

export async function seedRbac(dataSource: DataSource) {
  const roleRepo = dataSource.getRepository(RoleEntity);
  const permRepo = dataSource.getRepository(PermissionEntity);

  const permissionNames = Object.values(Permission);
  await permRepo.upsert(
    permissionNames.map((name) => ({ name })),
    ['name'],
  );

  const savedPermissions = await permRepo.find({
    where: { name: In(permissionNames) },
  });
  const permissionByName = new Map(savedPermissions.map((permission) => [permission.name, permission]));
  console.log('✅ Permissions seeded:', savedPermissions.length);

  const roleNames = Object.values(Role);
  await roleRepo.upsert(
    roleNames.map((name) => ({ name })),
    ['name'],
  );

  const savedRoles = await roleRepo.find({
    where: { name: In(roleNames) },
    relations: { permissions: true },
  });

  for (const role of savedRoles) {
    const permissionNamesForRole = ROLE_PERMISSIONS_MAPPING[role.name as Role];
    role.permissions = permissionNamesForRole
      .map((name) => permissionByName.get(name))
      .filter((permission): permission is PermissionEntity => Boolean(permission));
    await roleRepo.save(role);
  }

  console.log('✅ Roles seeded successfully:', savedRoles.length);
}
