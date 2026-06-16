import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { ArtistsService } from './artists.service';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';

@ApiTags('artists')
@ApiBearerAuth()
@Controller('artists')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @Get()
  @RequirePermissions(Permission.CONCERT_READ)
  findAll() { return this.artistsService.findAll(); }

  @Get(':id')
  @RequirePermissions(Permission.CONCERT_READ)
  findOne(@Param('id') id: string) { return this.artistsService.findById(id); }

  @Post()
  @RequirePermissions(Permission.CONCERT_CREATE)
  create(@Body() createArtistDto: CreateArtistDto) {
    return this.artistsService.create(createArtistDto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONCERT_UPDATE)
  update(@Param('id') id: string, @Body() updateArtistDto: UpdateArtistDto) {
    return this.artistsService.update(id, updateArtistDto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CONCERT_UPDATE)
  remove(@Param('id') id: string) {
    return this.artistsService.remove(id);
  }
}
