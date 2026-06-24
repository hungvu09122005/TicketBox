import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiBioRepository } from './ai-bio.repository';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../common/ports/object-storage.port';
import { AiBioStatus } from './entities/ai-bio-request.entity';
import { AI_BIO_JOB } from './processors/ai-bio.processor';
import { Artist } from '../artists/entities/artist.entity';

@Injectable()
export class AiBioService {
  constructor(
    private readonly repo: AiBioRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    @InjectQueue('ai-bio') private readonly queue: Queue,
    @InjectRepository(Artist) private readonly artistRepo: Repository<Artist>,
  ) {}
  
  async createRequest(pdfFile: Express.Multer.File, artistId: string, userId: string) {
    const objectKey = `artist-bios/${artistId}-${Date.now()}.pdf`;

    await this.storage.upload({
      objectKey,
      buffer: pdfFile.buffer,
      contentType: pdfFile.mimetype,
      size: pdfFile.size,
    });

    const bio = await this.repo.create({
      artistId,
      pdfObjectKey: objectKey,
      status: AiBioStatus.PENDING,
      requestedBy: userId,
    });

    await this.queue.add(
      AI_BIO_JOB,
      { requestId: bio.id, fileUrl: objectKey },
      { jobId: `ai-bio:${bio.id}` },
    );

    return bio;
  }

  async findAll(status?: string) {
    if (status?.toUpperCase() === 'SUCCESS') {
      return this.repo.findAll([AiBioStatus.DRAFT, AiBioStatus.PUBLISHED]);
    }
    if (status && Object.values(AiBioStatus).includes(status as AiBioStatus)) {
      return this.repo.findAll(status as AiBioStatus);
    }
    return this.repo.findAll();
  }

  async findById(id: string) {
    const job = await this.repo.findById(id);
    if (!job) {
      throw new Error(`AI Bio job ${id} not found`);
    }
    return job;
  }

  async retryJob(id: string) {
    const bio = await this.repo.findById(id);
    if (!bio) {
      throw new Error(`AI Bio job ${id} not found`);
    }
    if (bio.status !== AiBioStatus.FAILED) {
      throw new Error(`Cannot retry AI Bio job in state: ${bio.status}`);
    }
    await this.repo.updateStatus(id, AiBioStatus.PENDING);
    await this.queue.add(
      AI_BIO_JOB,
      { requestId: bio.id, fileUrl: bio.pdfObjectKey },
      { jobId: `ai-bio:${bio.id}` },
    );
    return { success: true, message: `AI Bio job ${id} is being retried` };
  }

  async updateDraft(id: string, draftContent: string) {
    const bio = await this.repo.findById(id);
    if (!bio) {
      throw new Error(`AI Bio job ${id} not found`);
    }

    await this.repo.updateDraft(id, draftContent, AiBioStatus.DRAFT);
    return this.repo.findById(id);
  }

  async publishDraft(id: string) {
    const bio = await this.repo.findById(id);
    if (!bio) {
      throw new Error(`AI Bio job ${id} not found`);
    }

    const content = bio.draftContent?.trim();
    if (!content) {
      throw new Error('No draft content available to publish');
    }

    const artist = await this.artistRepo.findOneBy({ id: bio.artistId });
    if (!artist) {
      throw new Error(`Artist ${bio.artistId} not found`);
    }

    artist.shortBio = content;
    await this.artistRepo.save(artist);
    await this.repo.updateDraft(id, content, AiBioStatus.PUBLISHED);

    return this.repo.findById(id);
  }
}
