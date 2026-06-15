import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RevokeDto {
  @ApiProperty({ description: 'The refresh token to be revoked' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
