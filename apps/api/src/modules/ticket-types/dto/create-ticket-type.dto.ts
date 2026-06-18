import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateTicketTypeDto {
  @ApiProperty({ example: 'VIP', description: 'Tên loại vé' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 1000000, description: 'Giá vé' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Giá vé không được âm' })
  price!: number;

  @ApiProperty({ example: 1000, description: 'Tổng số lượng vé' })
  @IsNumber()
  @Min(0, { message: 'Tổng số lượng không được âm' })
  totalQuantity!: number;

  @ApiProperty({ example: 4, description: 'Số lượng tối đa mỗi user' })
  @IsNumber()
  @Min(1, { message: 'Giới hạn mua ít nhất phải là 1' })
  maxPerUser!: number;

  @ApiProperty({ example: '2023-12-01T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  saleStartsAt?: string;

  @ApiProperty({ example: '2023-12-31T23:59:59Z', required: false })
  @IsOptional()
  @IsDateString()
  saleEndsAt?: string;
}
