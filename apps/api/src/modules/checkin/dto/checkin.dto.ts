import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CheckinDto {
  @IsUUID()
  ticket_id!: string;

  @IsString()
  @IsNotEmpty()
  client_event_id!: string;

  @IsString()
  @IsNotEmpty()
  device_id!: string;
}

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  deviceName!: string;

  @IsUUID()
  concertId!: string;

  @IsUUID()
  @IsOptional()
  zoneId?: string;

  @IsString()
  @IsOptional()
  gate?: string;
}

export class SyncDatasetQueryDto {
  @IsString()
  @IsNotEmpty()
  deviceToken!: string;
}