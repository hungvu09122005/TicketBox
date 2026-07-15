import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ActivateAccountDto {
  @ApiProperty({ description: 'Account activation token from email' })
  @IsString()
  token!: string;
}

