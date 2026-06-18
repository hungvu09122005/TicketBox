import { AppDataSource } from './data-source';
import { seedRbac } from './seed-rbac';
import { seedAdmin } from './seed-admin';
import { seedUsers } from './seed-users';
import { resetSeedTables, seedFullData } from './seed-full';

async function seed() {
  await AppDataSource.initialize();

  try {
    await resetSeedTables(AppDataSource);
    await seedRbac(AppDataSource);
    await seedAdmin(AppDataSource);
    await seedUsers(AppDataSource);
    await seedFullData(AppDataSource);
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('❌ Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
