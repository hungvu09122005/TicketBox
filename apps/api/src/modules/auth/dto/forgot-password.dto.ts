import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { AuthClientApp } from '../auth.types';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'audience',
    required: false,
    enum: ['audience', 'admin'],
    description: 'Which frontend should be linked in the email',
  })
  @IsOptional()
  @IsIn(['audience', 'admin'])
  app?: AuthClientApp;
}

