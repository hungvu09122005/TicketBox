import { AppDataSource } from './data-source';
import { seedRbac } from './seed-rbac';
import { seedAdmin } from './seed-admin';
import { seedUsers } from './seed-users';

async function seed() {
  await AppDataSource.initialize();

  try {
    await seedRbac(AppDataSource);
    await seedAdmin(AppDataSource);
    await seedUsers(AppDataSource);
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('❌ Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
