import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRolesDto {
  @ApiProperty({ example: ['AUDIENCE', 'ORGANIZER'], description: 'List of roles assigned to the user' })
  @IsArray()
  @IsString({ each: true })
  roles!: string[];
}
