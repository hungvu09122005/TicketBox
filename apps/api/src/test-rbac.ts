// src/test-rbac.ts
import 'reflect-metadata';
import { AppDataSource } from './database/data-source';
import { User } from './modules/users/entities/user.entity';

async function verifyDatabase() {
  try {
    // 1. Kết nối DB
    await AppDataSource.initialize();
    console.log("✅ Đã kết nối Database thành công!");

    // 2. Lấy Repository của User
    const userRepository = AppDataSource.getRepository(User);
    
    // 3. Test Query: Thử lấy 1 user và quan hệ với Roles
    const users = await userRepository.find({
      relations: ['roles'] // Kiểm tra xem quan hệ ManyToMany có chạy không
    });

    console.log("📝 Danh sách Users trong hệ thống:", users);
    
  } catch (error) {
    console.error("❌ Lỗi kết nối hoặc truy vấn:", error);
  } finally {
    await AppDataSource.destroy();
  }
}

verifyDatabase();