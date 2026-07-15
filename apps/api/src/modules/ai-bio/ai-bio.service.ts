import { BadRequestException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AiBioRepository } from './ai-bio.repository';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../common/ports/object-storage.port';
import { AiBioStatus, AiBioTargetType } from './entities/ai-bio-request.entity';
import { AI_BIO_JOB } from './processors/ai-bio.processor';
import { ArtistsService } from '../artists/artists.service';
import { ConcertsService } from '../concerts/concerts.service';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class AiBioService {
  constructor(
    private readonly repo: AiBioRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    @InjectQueue('ai-bio') private readonly queue: Queue,
    private readonly artistsService: ArtistsService,
    private readonly concertsService: ConcertsService,
  ) {}
  
  async createRequest(
    pdfFile: Express.Multer.File,
    targetId: string,
    targetType: AiBioTargetType,
    userId: string,
  ) {
    if (!pdfFile) {
      throw new BadRequestException('PDF file is required');
    }

    if (pdfFile.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    if (!pdfFile.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Only files with .pdf extension are allowed');
    }

    if (pdfFile.size > MAX_PDF_SIZE_BYTES) {
      throw new BadRequestException('PDF file size must not exceed 10MB');
    }

    const safeTargetId = targetId.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (!safeTargetId) {
      throw new BadRequestException('Invalid targetId');
    }

    if (targetType === AiBioTargetType.ARTIST) {
      await this.artistsService.findById(targetId);
    } else if (targetType === AiBioTargetType.CONCERT) {
      await this.concertsService.findById(targetId);
    } else {
      throw new BadRequestException('Invalid targetType');
    }

    const objectKey = `press-kits/${targetType.toLowerCase()}/${safeTargetId}-${Date.now()}.pdf`;

    await this.storage.upload({
      objectKey,
      buffer: pdfFile.buffer,
      contentType: pdfFile.mimetype,
      size: pdfFile.size,
    });

    const bio = await this.repo.create({
      targetId,
      targetType,
      pdfObjectKey: objectKey,
      status: AiBioStatus.PENDING,
      requestedBy: userId,
    });

    await this.queue.add(
      AI_BIO_JOB,
      { requestId: bio.id, fileUrl: objectKey },
      {
        jobId: `ai-bio:${bio.id}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: false,
      },
    );

    return {
      success: true,
      job_id: bio.id,
      status: bio.status,
      pdfObjectKey: bio.pdfObjectKey,
      targetId: bio.targetId,
      targetType: bio.targetType,
    };
  }

  async createManualBio(targetId: string, bio: string, userId: string, targetType: AiBioTargetType) {
    if (!targetId) {
      throw new BadRequestException('targetId is required');
    }

    if (!bio || !bio.trim()) {
      throw new BadRequestException('bio is required');
    }

    if (targetType === AiBioTargetType.ARTIST) {
      await this.artistsService.findById(targetId);
    } else if (targetType === AiBioTargetType.CONCERT) {
      await this.concertsService.findById(targetId);
    } else {
      throw new BadRequestException('Invalid targetType');
    }

    const request = await this.repo.create({
      targetId,
      targetType,
      requestedBy: userId,
      draftContent: bio.trim(),
      status: AiBioStatus.DRAFT,
    });

    return this.repo.findById(request.id);
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
      throw new NotFoundException(`AI Bio job ${id} not found`);
    }
    return job;
  }

  async retryJob(id: string) {
    const bio = await this.repo.findById(id);
    if (!bio) {
      throw new NotFoundException(`AI Bio job ${id} not found`);
    }
    if (bio.status !== AiBioStatus.FAILED) {
      throw new NotFoundException(`Cannot retry AI Bio job in state: ${bio.status}`);
    }
    await this.repo.updateStatus(id, AiBioStatus.PENDING);

    await this.queue.add(
      AI_BIO_JOB,
      { requestId: bio.id, fileUrl: bio.pdfObjectKey },
      {
        jobId: `ai-bio:${bio.id}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: false,
      },
    );
    return { success: true, message: `AI Bio job ${id} is being retried` };
  }

  async updateDraftContent(id: string, content: string) {
    const bio = await this.repo.findById(id);
    if (!bio) {
      throw new NotFoundException(`AI Bio job ${id} not found`);
    }
    if (bio.status !== AiBioStatus.DRAFT) {
      throw new BadRequestException(`Cannot edit bio job in state: ${bio.status}`);
    }
    await this.repo.updateStatus(id, AiBioStatus.DRAFT, { draftContent: content });
    return this.repo.findById(id);
  }

  async publishBio(id: string) {
    const bio = await this.repo.findById(id);
    if (!bio) {
      throw new NotFoundException(`AI Bio job ${id} not found`);
    }
    if (bio.status !== AiBioStatus.DRAFT) {
      throw new BadRequestException(`Cannot publish bio job in state: ${bio.status}`);
    }
    if (!bio.draftContent) {
      throw new BadRequestException('Bio draft content is empty. Cannot publish.');
    }

    if (bio.targetType === AiBioTargetType.ARTIST) {
      await this.artistsService.update(bio.targetId, { shortBio: bio.draftContent });
    } else if (bio.targetType === AiBioTargetType.CONCERT) {
      await this.concertsService.updateById(bio.targetId, { description: bio.draftContent });
    } else {
      throw new BadRequestException(`Unsupported target type: ${bio.targetType}`);
    }

    await this.repo.updateStatus(id, AiBioStatus.PUBLISHED);

    return this.repo.findById(id);
  }
}
