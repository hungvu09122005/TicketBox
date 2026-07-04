import { Test, TestingModule } from '@nestjs/testing';
import { CsvImportProcessor } from './csv-import.processor';
import { CsvImportRepository } from '../csv-import.repository';
import { OBJECT_STORAGE_PORT } from '../../../common/ports/object-storage.port';
import { TicketsService } from '../../tickets/tickets.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EntityManager } from 'typeorm';
import { Job } from 'bull';
import { CsvImportJobStatus } from '../entities/csv-import-job.entity';
import { Readable } from 'stream';

describe('CsvImportProcessor', () => {
  let processor: CsvImportProcessor;
  let repo: jest.Mocked<CsvImportRepository>;
  let storage: any;
  let ticketsService: jest.Mocked<TicketsService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let manager: jest.Mocked<EntityManager>;

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
      updateJobStats: jest.fn(),
      createRowOutcome: jest.fn(),
    } as any;

    storage = {
      download: jest.fn(),
      downloadStream: jest.fn(),
    };

    ticketsService = {
      issueVipTicket: jest.fn(),
    } as any;

    notificationsService = {
      queueVipWelcome: jest.fn(),
    } as any;

    manager = {
      findOne: jest.fn(),
      find: jest.fn(),
      transaction: jest.fn((cb) => cb(manager)),
      create: jest.fn((entity, data) => data),
      save: jest.fn((entity, data) => Promise.resolve(data)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvImportProcessor,
        { provide: CsvImportRepository, useValue: repo },
        { provide: OBJECT_STORAGE_PORT, useValue: storage },
        { provide: TicketsService, useValue: ticketsService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: EntityManager, useValue: manager },
      ],
    }).compile();

    processor = module.get<CsvImportProcessor>(CsvImportProcessor);
  });

  it('should process a valid CSV successfully', async () => {
    const jobId = 'test-job-id';
    const concertId = 'test-concert-id';
    const csvContent = 'email,name,ticketTypeId,phone\nvip@example.com,Vip Guest,vip-type-id,0900000001\n';

    repo.findById.mockResolvedValue({ id: jobId, concertId } as any);
    storage.downloadStream.mockResolvedValue(Readable.from([csvContent]));
    manager.findOne.mockImplementation((entity: any, options: any) => {
      if (entity === 'Concert' || (entity && entity.name === 'Concert')) {
        return Promise.resolve({ id: concertId, name: 'Test Concert' });
      }
      if (entity === 'TicketType' || (entity && entity.name === 'TicketType')) {
        return Promise.resolve({ id: 'vip-type-id', concertId });
      }
      if (entity === 'Role' || (entity && (entity.name === 'Role' || entity.name === 'RoleEntity'))) {
        return Promise.resolve({ id: 'role-id', name: 'AUDIENCE' });
      }
      return Promise.resolve(null);
    });

    ticketsService.issueVipTicket.mockResolvedValue({ id: 'ticket-id' } as any);

    const mockJob = {
      data: { jobId, fileUrl: 'test.csv', concertId },
    } as Job;

    await processor.handle(mockJob);

    expect(repo.updateStatus).toHaveBeenCalledWith(jobId, CsvImportJobStatus.PROCESSING);
    expect(repo.updateJobStats).toHaveBeenCalledWith(jobId, {
      totalRows: 1,
      successRows: 1,
      errorRows: 0,
      status: CsvImportJobStatus.COMPLETED,
    });
  });

  it('should accept sponsor CSV headers and resolve ticket type by name', async () => {
    const jobId = 'test-job-id-2';
    const concertId = 'test-concert-id';
    const csvContent =
      'email,full_name,ticket_type,phone,sponsor\n' +
      'vip@example.com,Vip Guest,VIP,0900000001,Brand A\n';

    repo.findById.mockResolvedValue({ id: jobId, concertId } as any);
    storage.downloadStream.mockResolvedValue(Readable.from([csvContent]));
    manager.findOne.mockImplementation((entity: any) => {
      if (entity === 'Concert' || (entity && entity.name === 'Concert')) {
        return Promise.resolve({ id: concertId, name: 'Test Concert' });
      }
      if (entity === 'TicketType' || (entity && entity.name === 'TicketType')) {
        return Promise.resolve(null);
      }
      if (entity === 'Role' || (entity && (entity.name === 'Role' || entity.name === 'RoleEntity'))) {
        return Promise.resolve({ id: 'role-id', name: 'AUDIENCE' });
      }
      return Promise.resolve(null);
    });
    (manager as any).find.mockImplementation((entity: any) => {
      if (entity === 'TicketType' || (entity && entity.name === 'TicketType')) {
        return Promise.resolve([{ id: 'vip-type-id', concertId, name: 'VIP' }]);
      }
      return Promise.resolve([]);
    });

    ticketsService.issueVipTicket.mockResolvedValue({ id: 'ticket-id' } as any);

    const mockJob = {
      data: { jobId, fileUrl: 'test.csv', concertId },
    } as Job;

    await processor.handle(mockJob);

    expect(repo.updateJobStats).toHaveBeenCalledWith(jobId, {
      totalRows: 1,
      successRows: 1,
      errorRows: 0,
      status: CsvImportJobStatus.COMPLETED,
    });
  });
});
