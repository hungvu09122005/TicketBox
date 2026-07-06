import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiBioRequest, AiBioStatus } from './entities/ai-bio-request.entity'; // Import thêm AiBioStatus

@Injectable()
export class AiBioRepository {
  constructor(
    @InjectRepository(AiBioRequest) 
    private readonly repo: Repository<AiBioRequest>
  ) {}

  // Ép kiểu status là AiBioStatus thay vì string
  async updateStatus(
    id: string,
    status: AiBioStatus,
    extra?: string | { draftContent?: string; failureReason?: string },
  ): Promise<void> {
    const updateData: any = { status };
    if (typeof extra === 'string') {
      if (status === AiBioStatus.FAILED) {
        updateData.failureReason = extra;
      } else {
        updateData.draftContent = extra;
      }
    } else if (extra) {
      Object.assign(updateData, extra);
    }
    await this.repo.update(id, updateData);
  }

  async updateDraft(id: string, draftContent: string, status: AiBioStatus = AiBioStatus.DRAFT): Promise<void> {
    await this.repo.update(id, { draftContent, status });
  }

  // Phương thức tạo mới
  async create(data: Partial<AiBioRequest>): Promise<AiBioRequest> {
    const newRequest = this.repo.create(data);
    return await this.repo.save(newRequest);
  }

  async findById(id: string): Promise<AiBioRequest | null> {
    return this.repo.findOneBy({ id });
  }

  async findAll(status?: AiBioStatus | AiBioStatus[]): Promise<AiBioRequest[]> {
    const whereClause = status ? { status: Array.isArray(status) ? In(status) : status } : {};
    return this.repo.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
    });
  }
}
