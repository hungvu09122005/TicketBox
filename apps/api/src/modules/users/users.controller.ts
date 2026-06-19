import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { UsersService } from './users.service';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { UpdateUserActiveStatusDto } from './dto/update-user-active-status.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RbacGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.sub).then((profile) => {
      if (!profile) return null;

      const roles = profile.roles ?? [];
      const permissions = Array.from(
        new Set(
          roles.flatMap((role) =>
            role.permissions?.map((permission) => permission.name) ?? [],
          ),
        ),
      );

      return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        roles: roles.map((role) => role.name),
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

  @Patch(':id/active')
  @RequirePermissions(Permission.RBAC_MANAGE)
  updateActiveStatus(
    @Param('id') targetUserId: string,
    @Body() body: UpdateUserActiveStatusDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.usersService.updateActiveStatus(targetUserId, body.isActive, admin.sub);
  }
}
