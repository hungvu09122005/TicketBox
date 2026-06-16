import { IsString, IsInt, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  concertId!: string; // Dấu "!" báo với TS là biến này sẽ được khởi tạo bởi NestJS ValidationPipe

  @IsString()
  ticketTypeId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}