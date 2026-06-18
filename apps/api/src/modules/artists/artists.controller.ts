import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { ArtistsService } from './artists.service';

@ApiTags('artists')
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
}
