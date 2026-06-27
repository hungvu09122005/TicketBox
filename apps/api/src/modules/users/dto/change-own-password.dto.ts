import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeOwnPasswordDto {
  @ApiProperty({ minLength: 8, description: 'Current password' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, description: 'New password' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
