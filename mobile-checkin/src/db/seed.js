// src/db/seed.js
import { initDatabase, db } from './database';

export const seedDatabase = async () => {
  try {
    await initDatabase();

    // Seed một số vé mẫu cho test offline
    await db.runAsync(`
      INSERT OR IGNORE INTO local_tickets 
        (ticket_id, qr_token, ticket_type, owner_name, concert_id, status)
      VALUES 
        ('TICKET001', 'QR_VIP_001', 'VIP', 'Nguyễn Văn A', 'CONCERT001', 'VALID'),
        ('TICKET002', 'QR_GA_001', 'GA', 'Trần Thị B', 'CONCERT001', 'VALID'),
        ('TICKET003', 'QR_SVIP_001', 'SVIP', 'Lê Văn C', 'CONCERT001', 'VALID')
    `);

    console.log('✅ Seed dữ liệu SQLite thành công!');
  } catch (error) {
    console.error('❌ Seed error:', error);
  }
}; 