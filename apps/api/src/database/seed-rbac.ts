import { In, EntityManager } from 'typeorm';
import { Role as RoleEntity } from '../modules/users/entities/role.entity';
import { Permission as PermissionEntity } from '../modules/users/entities/permission.entity';
import { Permission } from '../common/constants/permissions.enum';
import { Role } from '../common/constants/roles.enum';
import { ROLE_PERMISSIONS_MAPPING } from '../common/constants/role-permissions.mapping';

export async function seedRbac(manager: EntityManager) {
  console.log('🚀 Bắt đầu quá trình đồng bộ RBAC...');

  const roleRepo = manager.getRepository(RoleEntity);
  const permRepo = manager.getRepository(PermissionEntity);

  // 1. Seed Permissions
  const permissionCodes = Object.values(Permission);
  await permRepo.upsert(
    permissionCodes.map((code) => ({ name: code, code })),
    ['code'],
  );

  const savedPermissions = await permRepo.find();
  const permissionByCode = new Map(savedPermissions.map((p) => [p.code, p]));
  console.log(`✅ Đã đồng bộ ${savedPermissions.length} permissions.`);

  // 2. Seed Roles
  const roleNames = Object.values(Role);
  await roleRepo.upsert(
    roleNames.map((name) => ({ name })),
    ['name'],
  );

  const savedRoles = await roleRepo.find({ relations: { permissions: true } });

  // 3. Mapping Permissions vào Roles
  for (const role of savedRoles) {
    const targetPermissionCodes = ROLE_PERMISSIONS_MAPPING[role.name as Role] || [];
    
    role.permissions = targetPermissionCodes
      .map((code) => permissionByCode.get(code))
      .filter((p): p is PermissionEntity => !!p);
      
    await roleRepo.save(role);
  }

  console.log('✨ RBAC Seeding hoàn tất!');
}
