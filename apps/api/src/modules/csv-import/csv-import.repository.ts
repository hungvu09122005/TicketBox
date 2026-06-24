import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsvImportJob } from './entities/csv-import-job.entity';
import { CsvImportRow } from './entities/csv-import-row.entity';
import { VipGuest } from './entities/vip-guest.entity';
import { CsvImportJobStatus } from './entities/csv-import-job.entity';

@Injectable()
export class CsvImportRepository {
  constructor(
    @InjectRepository(CsvImportJob) private readonly jobRepo: Repository<CsvImportJob>,
    @InjectRepository(CsvImportRow) private readonly rowRepo: Repository<CsvImportRow>,
    @InjectRepository(VipGuest) private readonly vipRepo: Repository<VipGuest>,
  ) {}
  async createJob(concertId: string, userId: string, objectKey: string): Promise<CsvImportJob> {
    const job = this.jobRepo.create({
      concertId,
      triggeredBy: userId,
      objectKey,
    });
    return this.jobRepo.save(job);
  }

  async findById(jobId: string): Promise<CsvImportJob | null> {
    return this.jobRepo.findOneBy({ id: jobId });
  }

  async findAll(status?: CsvImportJobStatus): Promise<CsvImportJob[]> {
    return this.jobRepo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(jobId: string, status: CsvImportJobStatus): Promise<void> {
    await this.jobRepo.update(jobId, { status });
  }

  async updateJobProgress(
    jobId: string,
    data: Partial<Pick<CsvImportJob, 'status' | 'totalRows' | 'successRows' | 'errorRows'>>,
  ): Promise<void> {
    await this.jobRepo.update(jobId, data);
  }

  async findRowsByJobId(jobId: string): Promise<CsvImportRow[]> {
    return this.rowRepo.find({
      where: { jobId },
      order: { rowNumber: 'ASC' },
    });
  }

  async addRow(row: Partial<CsvImportRow>): Promise<CsvImportRow> {
    return this.rowRepo.save(this.rowRepo.create(row));
  }

  async findVipGuest(concertId: string, dedupKey: string): Promise<VipGuest | null> {
    return this.vipRepo.findOneBy({ concertId, dedupKey });
  }

  async saveVipGuest(data: Partial<VipGuest>): Promise<VipGuest> {
    return this.vipRepo.save(this.vipRepo.create(data));
  }
}
