import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { SeatMapRepository } from './seat-map.repository';
import { ConcertsService } from '../concerts/concerts.service';
import { TicketTypesService } from '../ticket-types/ticket-types.service';
import { ObjectStoragePort, OBJECT_STORAGE_PORT } from '../../common/ports/object-storage.port';
import { XMLParser } from 'fast-xml-parser';

/** SeatMapService — exported interface for ConcertsController route /seat-map. */
@Injectable()
export class SeatMapService {
  constructor(
    private readonly repo: SeatMapRepository,
    private readonly concertsService: ConcertsService,
    private readonly ticketTypesService: TicketTypesService,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
  ) {}

  private extractAllIds(obj: any, ids: Set<string>) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach((item) => this.extractAllIds(item, ids));
      return;
    }
    if (obj['@_id']) {
      ids.add(obj['@_id']);
    }
    Object.keys(obj).forEach((key) => {
      this.extractAllIds(obj[key], ids);
    });
  }

  async uploadSvgAndMapZones(
    concertId: string,
    file: Express.Multer.File,
    mapping: Record<string, string>,
    userId: string,
    isAdmin: boolean,
  ) {
    if (file.mimetype !== 'image/svg+xml') {
      throw new BadRequestException('File must be a valid SVG image');
    }

    // Ownership check implicitly validates concert exists
    await this.concertsService.checkOwnership(concertId, userId, isAdmin);

    // Validate SVG and extract IDs
    const parser = new XMLParser({ ignoreAttributes: false });
    let svgObj;
    try {
      svgObj = parser.parse(file.buffer.toString('utf-8'));
    } catch (e) {
      throw new BadRequestException('Invalid SVG file format');
    }

    const svgIds = new Set<string>();
    this.extractAllIds(svgObj, svgIds);

    // Validate mappings against SVG IDs
    for (const zoneId of Object.keys(mapping)) {
      if (!svgIds.has(zoneId)) {
        throw new BadRequestException(`Zone '${zoneId}' not found in SVG`);
      }
    }

    // Validate that ticketTypes exist for this concert
    const concertTicketTypes = await this.ticketTypesService.findByConcertId(concertId);
    const validTicketTypeIds = new Set(concertTicketTypes.map(t => t.id));

    for (const [zoneId, ticketTypeId] of Object.entries(mapping)) {
      if (!validTicketTypeIds.has(ticketTypeId)) {
        throw new BadRequestException(`Ticket Type '${ticketTypeId}' does not belong to this concert`);
      }
    }

    // Upload to MinIO
    const timestamp = Date.now();
    const objectKey = `concerts/${concertId}/seatmap_${timestamp}.svg`;
    await this.storage.upload({
      objectKey,
      buffer: file.buffer,
      contentType: file.mimetype,
      size: file.size,
    });

    // Delete existing zones
    await this.repo.deleteByConcertId(concertId);

    // Create new zones
    const zonesToCreate = Object.entries(mapping).map(([zoneId, ticketTypeId]) => ({
      concertId,
      name: zoneId,
      svgObjectKey: objectKey,
      ticketTypeId,
    }));

    let createdZones: any[] = [];
    if (zonesToCreate.length > 0) {
      createdZones = await this.repo.createZones(zonesToCreate);
    }

    // Invalidate concert cache since seat map zones changed
    await this.concertsService.invalidateCacheFor(concertId);

    return {
      message: 'SVG uploaded and zones mapped successfully',
      objectKey,
      zones: createdZones,
    };
  }

  async getZonesByConcert(concertId: string) {
    const zones = await this.repo.findByConcertId(concertId);
    if (!zones.length) {
      return { svgUrl: null, zones: [] };
    }

    const objectKey = zones[0].svgObjectKey;
    const svgUrl = objectKey ? await this.storage.getPresignedUrl(objectKey, 3600) : null;

    return { svgUrl, zones };
  }
}
