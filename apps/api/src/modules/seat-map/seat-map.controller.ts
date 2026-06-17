import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { SeatMapService } from './seat-map.service';

@ApiTags('seat-map')
@ApiBearerAuth()
@Controller('concerts/:concertId/seat-map')
@UseGuards(OptionalJwtAuthGuard)
export class SeatMapController {
  constructor(private readonly seatMapService: SeatMapService) {}

  @Get()
  async getZones(@Param('concertId') concertId: string) {
    return this.seatMapService.getZonesByConcert(concertId);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        mapping: {
          type: 'string',
          description: 'JSON string of zoneId to ticketTypeId mapping, e.g., {"zone-1": "uuid-1"}',
        },
      },
    },
  })
  async uploadSeatMap(
    @Param('concertId') concertId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingStr: string,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('SVG file is required');
    }
    
    let mapping: Record<string, string>;
    try {
      mapping = JSON.parse(mappingStr);
    } catch (e) {
      throw new BadRequestException('Invalid mapping JSON string');
    }

    if (!mapping || typeof mapping !== 'object') {
      throw new BadRequestException('Mapping must be a JSON object');
    }

    const isAdmin = req.user.roles?.includes('ADMIN') || false;
    
    return this.seatMapService.uploadSvgAndMapZones(concertId, file, mapping, req.user.sub, isAdmin);
  }
}

