import * as SQLite from 'expo-sqlite';
import { DB_SCHEMA } from './schema';

let db = null;

export const initDatabase = async () => {
  try {
    // Phải có await ở đây theo đúng SDK 56+
    db = await SQLite.openDatabaseAsync('ticketbox_checkin.db');
    
    // Thực thi schema
    await db.execAsync(DB_SCHEMA);
    
    console.log('✅ Database initialized successfully!');
    return db;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error; // Ném lỗi để phía UI biết mà xử lý (ví dụ: hiện thông báo lỗi)
  }
};

// Hàm lấy db sau khi đã khởi tạo
export const getDatabase = () => {
  if (!db) throw new Error("Database chưa được khởi tạo!");
  return db;
};