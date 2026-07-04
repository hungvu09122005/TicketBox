import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CheckinDto {
  @IsUUID()
  @IsOptional()
  ticket_id?: string;

  @IsString()
  @IsOptional()
  qr_token?: string;

  @IsString()
  @IsNotEmpty()
  client_event_id!: string;

  @IsOptional()
  scanned_at?: string;

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

export class VipGuestLookupQueryDto {
  @IsUUID()
  concertId!: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  deviceId?: string;
}

export class ConfirmVipGuestDto {
  @IsUUID()
  guestId!: string;

  @IsString()
  @IsNotEmpty()
  client_event_id!: string;

  @IsString()
  @IsNotEmpty()
  device_id!: string;

  @IsOptional()
  scanned_at?: string;
}
