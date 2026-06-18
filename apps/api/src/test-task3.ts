import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bull';

async function testTask3() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const queue = app.get<Queue>(getQueueToken('notifications'));
  await queue.add('notification.ticket_confirmation', { email: 'phuc@hcmus.edu.vn', ticketId: 'TASK3_DONE_001' });
  console.log('✅ Job test đã được đẩy thành công vào Redis!');
  await app.close();
}
testTask3();