import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, FindOneOptions, UpdateResult } from 'typeorm';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class TicketsRepository {
  constructor(
    @InjectRepository(Ticket) 
    private readonly repo: Repository<Ticket>
  ) {}

  // "Lộ" các phương thức cần thiết ra ngoài
  find(options: FindManyOptions<Ticket>) {
    return this.repo.find(options);
  }

  findOne(options: FindOneOptions<Ticket>) {
    return this.repo.findOne(options);
  }

  update(id: string, updateData: Partial<Ticket>) {
    return this.repo.update(id, updateData);
  }

  saveTickets(tickets: Ticket[]) {
    return this.repo.save(tickets);
  }
}
