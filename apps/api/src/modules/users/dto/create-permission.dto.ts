import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    example: 'concert:archive',
    description: 'Permission code to create',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z][a-z0-9]*:[a-z0-9_]+$/, {
    message: 'Permission code must follow module:action format',
  })
  name!: string;
}
