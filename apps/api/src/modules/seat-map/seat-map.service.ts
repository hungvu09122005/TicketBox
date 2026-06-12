import { Injectable } from '@nestjs/common';
import { SeatMapRepository } from './seat-map.repository';

/** SeatMapService — exported interface for ConcertsController route /seat-map. */
@Injectable()
export class SeatMapService {
  constructor(private readonly repo: SeatMapRepository) {}
  // TODO Phase 2: getZonesByConcert, uploadSvg (via ObjectStoragePort), generatePresignedUrl
}
