import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsvImportJob } from './entities/csv-import-job.entity';
import { CsvImportRow } from './entities/csv-import-row.entity';
import { VipGuest } from './entities/vip-guest.entity';

@Injectable()
export class CsvImportRepository {
  constructor(
    @InjectRepository(CsvImportJob) private readonly jobRepo: Repository<CsvImportJob>,
    @InjectRepository(CsvImportRow) private readonly rowRepo: Repository<CsvImportRow>,
    @InjectRepository(VipGuest) private readonly vipRepo: Repository<VipGuest>,
  ) {}
  // TODO Phase 6: createJob, updateJobStatus, upsertVipGuest (idempotent by dedupKey), createRow
}
