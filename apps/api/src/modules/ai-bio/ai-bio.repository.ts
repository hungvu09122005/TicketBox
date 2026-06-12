import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiBioRequest } from './entities/ai-bio-request.entity';

@Injectable()
export class AiBioRepository {
  constructor(@InjectRepository(AiBioRequest) private readonly repo: Repository<AiBioRequest>) {}
  // TODO Phase 7: create, findById, updateStatus, saveDraft, publish
}
