import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsDateString } from 'class-validator';

export class ReportQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  concertId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
