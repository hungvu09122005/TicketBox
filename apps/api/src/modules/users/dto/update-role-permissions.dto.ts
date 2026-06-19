import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRolePermissionsDto {
  @ApiProperty({
    example: ['concert:read', 'concert:update', 'rbac:manage'],
    description: 'List of permission codes to assign to the role',
  })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
