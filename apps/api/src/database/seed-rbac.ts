import { DataSource } from 'typeorm';
import { Role as RoleEntity } from '../modules/users/entities/role.entity';
import { Permission as PermissionEntity } from '../modules/users/entities/permission.entity';
import { ROLE_PERMISSIONS_MAPPING } from '../common/constants/role-permissions.mapping';
import { Role as RoleEnum } from '../common/constants/roles.enum';
import { EntityManager } from 'typeorm';

export async function seedRbac(manager: EntityManager) {
  
  const roleRepo = manager.getRepository(RoleEntity);
  const permRepo = manager.getRepository(PermissionEntity);

  console.log('🔄 Đang đồng bộ RBAC từ Mapping...');

  // 1. Tạo tất cả các Role từ Enum (nếu chưa có)
  for (const roleName of Object.values(RoleEnum)) {
    const existingRole = await roleRepo.findOne({ where: { name: roleName } });
    if (!existingRole) {
      await roleRepo.save(roleRepo.create({ name: roleName }));
      console.log(`✅ Created role: ${roleName}`);
    }
  }

  // 2. Tạo Permission và Gán quyền dựa trên Mapping
  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS_MAPPING)) {
    const role = await roleRepo.findOne({ 
      where: { name: roleName as RoleEnum }, 
      relations: ['permissions'] 
    });

    if (role) {
      for (const permCode of permissions) {
        // Tạo permission nếu chưa tồn tại
        let perm = await permRepo.findOne({ where: { code: permCode } });
        if (!perm) {
          perm = await permRepo.save(permRepo.create({ code: permCode, name: permCode }));
          console.log(`✅ Created permission: ${permCode}`);
        }

        // Gán quyền cho role nếu chưa có
        const hasPerm = role.permissions.some((p) => p.code === permCode);
        if (!hasPerm) {
          role.permissions.push(perm);
        }
      }
      await roleRepo.save(role);
    }
  }
  console.log('✨ RBAC Seeding hoàn tất!');
}
