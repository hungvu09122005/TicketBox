// apps/api/src/database/sync-db.ts
import { AppDataSource } from './data-source'; // Nhớ export AppDataSource trong file data-source.ts của bạn

async function sync() {
  await AppDataSource.initialize();
  await AppDataSource.synchronize(); // Lệnh này ép tạo bảng
  console.log('✅ Bảng đã được tạo thành công!');
  process.exit(0);
}
sync();