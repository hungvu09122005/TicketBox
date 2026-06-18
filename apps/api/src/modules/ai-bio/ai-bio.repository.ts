import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiBioRequest, AiBioStatus } from './entities/ai-bio-request.entity'; // Import thêm AiBioStatus

@Injectable()
export class AiBioRepository {
  constructor(
    @InjectRepository(AiBioRequest) 
    private readonly repo: Repository<AiBioRequest>
  ) {}

  // Ép kiểu status là AiBioStatus thay vì string
  async updateStatus(id: string, status: AiBioStatus, failureReason?: string): Promise<void> {
    await this.repo.update(id, { status, failureReason });
  }

  // Phương thức tạo mới
  async create(data: Partial<AiBioRequest>): Promise<AiBioRequest> {
    const newRequest = this.repo.create(data);
    return await this.repo.save(newRequest);
  }
}