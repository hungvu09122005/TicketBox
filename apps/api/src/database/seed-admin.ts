import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Role as RoleEntity } from '../modules/users/entities/role.entity';
import { User as UserEntity } from '../modules/users/entities/user.entity';
import { Role } from '../common/constants/roles.enum';

export async function seedAdmin(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(UserEntity);
  const roleRepo = dataSource.getRepository(RoleEntity);

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@ticketbox.local';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'System Admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';

  const adminRole = await roleRepo.findOne({ where: { name: Role.SYSTEM_ADMIN } });
  if (!adminRole) {
    throw new Error('SYSTEM_ADMIN role not found. Run RBAC seed first.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const existingAdmin = await userRepo.findOne({
    where: { email: adminEmail },
    relations: { roles: true },
  });

  if (existingAdmin) {
    existingAdmin.name = adminName;
    existingAdmin.passwordHash = passwordHash;
    existingAdmin.isActive = true;
    existingAdmin.roles = [adminRole];
    await userRepo.save(existingAdmin);
    console.log(`✅ Admin user updated: ${adminEmail}`);
    return;
  }

  const adminUser = userRepo.create({
    email: adminEmail,
    name: adminName,
    passwordHash,
    roles: [adminRole],
  });

  await userRepo.save(adminUser);
  console.log(`✅ Admin user seeded: ${adminEmail}`);
}
