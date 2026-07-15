import * as bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';
import { seedRbac } from './seed-rbac';
import { User } from '../modules/users/entities/user.entity';
import { Role as RoleEntity } from '../modules/users/entities/role.entity';
import { Role } from '../common/constants/roles.enum';
import { resetSeedTables, seedFullData } from './seed-full';

async function seed() {
  await AppDataSource.initialize();
  await AppDataSource.runMigrations();

  console.log('🧹 Truncating old tables...');
  await resetSeedTables(AppDataSource);

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    console.log('🚀 Đang chạy full seed...');

    await seedRbac(queryRunner.manager);

    const userRepo = queryRunner.manager.getRepository(User);
    const roleRepo = queryRunner.manager.getRepository(RoleEntity);

    const adminRole = await roleRepo.findOne({ where: { name: Role.SYSTEM_ADMIN } });
    const organizerRole = await roleRepo.findOne({ where: { name: Role.ORGANIZER } });
    const staffRole = await roleRepo.findOne({ where: { name: Role.CHECKIN_STAFF } });
    const audienceRole = await roleRepo.findOne({ where: { name: Role.AUDIENCE } });

    if (!adminRole || !organizerRole || !staffRole || !audienceRole) {
      throw new Error('Roles are missing. Run RBAC seed first.');
    }

    const hashedAdminPassword = await bcrypt.hash('Admin@123456', 12);
    const hashedOrgPassword = await bcrypt.hash('Organizer@123456', 12);
    const hashedStaffPassword = await bcrypt.hash('Staff@123456', 12);
    const hashedAudiencePassword = await bcrypt.hash('Audience@123456', 12);

    const userData = [
      { email: 'admin@ticketbox.local', name: 'System Admin', passwordHash: hashedAdminPassword, roles: [adminRole], isActive: true },
      { email: 'organizer@ticketbox.local', name: 'Organizer User', passwordHash: hashedOrgPassword, roles: [organizerRole], isActive: true },
      { email: 'staff@ticketbox.local', name: 'Check-in Staff', passwordHash: hashedStaffPassword, roles: [staffRole], isActive: true },
      { email: 'audience@ticketbox.local', name: 'Audience User', passwordHash: hashedAudiencePassword, roles: [audienceRole], isActive: true },
    ];

    for (const u of userData) {
      let user = await userRepo.findOne({ where: { email: u.email }, relations: { roles: true } });
      if (!user) {
        user = await userRepo.save(userRepo.create(u));
      } else {
        user.name = u.name;
        user.passwordHash = u.passwordHash;
        user.roles = u.roles;
        user.isActive = u.isActive;
        user = await userRepo.save(user);
      }
    }

    await queryRunner.commitTransaction();

    console.log('📦 Seeding core business data from seed-full...');
    await seedFullData(AppDataSource);

    console.log('✅ Hoàn tất seeding toàn bộ hệ thống!');
  } catch (err) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    console.error('❌ Seeding failed:', err);
    throw err;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}


seed().catch((err) => {
  console.error('❌ Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
