import { IsString, IsOptional, MaxLength, IsUUID, IsDate, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConcertDto {
  @ApiProperty({ example: 'The Eras Tour', description: 'Name of the concert' })
  @IsString()
  @MaxLength(300)
  name!: string;

  @ApiProperty({ example: ['uuid1', 'uuid2'], description: 'Artist IDs', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  artistIds!: string[];

  @ApiProperty({ example: '2025-06-01T19:00:00Z', description: 'Concert start time' })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @ApiProperty({ example: '2025-06-01T23:00:00Z', description: 'Concert end time' })
  @Type(() => Date)
  @IsDate()
  endsAt!: Date;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00Z', description: 'Ticket sale start time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  saleStartsAt?: Date;

  @ApiPropertyOptional({ example: '2025-05-31T23:59:59Z', description: 'Ticket sale end time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  saleEndsAt?: Date;

  @ApiPropertyOptional({ example: 'Wembley Stadium', description: 'Venue' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  venue?: string;

  @ApiPropertyOptional({ example: 'Description...', description: 'Concert description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'concerts/eras-tour.jpg', description: 'Banner object key' })
  @IsString()
  @IsOptional()
  bannerObjectKey?: string;
}
