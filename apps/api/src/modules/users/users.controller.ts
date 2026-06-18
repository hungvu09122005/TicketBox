import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { Role } from '../../common/constants/roles.enum';
import { ROLE_PERMISSIONS_MAPPING } from '../../common/constants/role-permissions.mapping';
import { UsersService } from './users.service';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { Body, Param, Patch } from '@nestjs/common';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RbacGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @RequirePermissions(Permission.ORDER_READ_OWN) // Any authenticated user
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.sub).then((profile) => {
      if (!profile) return null;

      const permissions = Array.from(
        new Set(
          profile.roles.flatMap((role) => {
            const key = role.name as Role;
            return ROLE_PERMISSIONS_MAPPING[key] ?? [];
          }),
        ),
      );

      return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        roles: profile.roles.map(r => r.name),
        permissionVersion: profile.permissionVersion,
        permissions,
      };
    });
  }

  @Patch(':id/roles')
  @RequirePermissions(Permission.RBAC_MANAGE)
  updateRoles(
    @Param('id') targetUserId: string,
    @Body() body: UpdateRolesDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.usersService.updateRoles(targetUserId, body.roles, admin.sub);
  }
}
