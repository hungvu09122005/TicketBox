import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TicketStatus } from '../entities/ticket.entity';

export class TicketQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  concertId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  ticketTypeId?: string;
}
