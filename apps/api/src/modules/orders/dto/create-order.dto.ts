import { IsUUID, IsInt, Min, Max, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  concertId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  ticketTypeId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(10)
  quantity: number;

  @ApiPropertyOptional({ description: 'JWT token issued by Virtual Waiting Room' })
  @IsOptional()
  @IsString()
  queueToken?: string;
}