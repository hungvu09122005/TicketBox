import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateArtistDto {
  @ApiProperty({ example: 'Taylor Swift', description: 'Name of the artist' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'American singer-songwriter...', description: 'Short biography' })
  @IsString()
  @IsOptional()
  shortBio?: string;

  @ApiPropertyOptional({ example: 'artists/taylor-swift-avatar.jpg', description: 'Avatar object key in storage' })
  @IsString()
  @IsOptional()
  avatarObjectKey?: string;
}
