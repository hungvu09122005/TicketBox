import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { TicketType } from './entities/ticket-type.entity';

@Injectable()
export class TicketTypesRepository {
  constructor(
    @InjectRepository(TicketType) private readonly repo: Repository<TicketType>,
  ) {}

  // Wrapper cho hàm find để Service gọi được
  async find(options: FindManyOptions<TicketType>): Promise<TicketType[]> {
    return await this.repo.find(options);
  }

  async findOne(options: any): Promise<TicketType | null> {
    return await this.repo.findOne(options);
  }
}