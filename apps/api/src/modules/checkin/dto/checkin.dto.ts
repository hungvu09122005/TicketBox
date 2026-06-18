import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CheckinDto {
  @IsUUID()
  ticket_id!: string; // Thêm dấu !

  @IsString()
  @IsNotEmpty()
  client_event_id!: string; // Thêm dấu !

  @IsString()
  @IsNotEmpty()
  device_id!: string; // Thêm dấu !
}