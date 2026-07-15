import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { UsersService } from './users.service';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { UpdateUserActiveStatusDto } from './dto/update-user-active-status.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { ChangeOwnPasswordDto } from './dto/change-own-password.dto';

function mapUserProfile(user: NonNullable<Awaited<ReturnType<UsersService['findById']>>>) {
  const roles = user.roles ?? [];
  const permissions = Array.from(
    new Set(
      roles.flatMap((role) =>
        role.permissions?.map((permission) => permission.name) ?? [],
      ),
    ),
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: roles.map((role) => role.name),
    permissionVersion: user.permissionVersion,
    permissions,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

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
      return mapUserProfile(profile);
    });
  }

  @Get('me/profile')
  @RequirePermissions(Permission.USER_READ_OWN)
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.sub).then((profile) => {
      if (!profile) return null;
      return mapUserProfile(profile);
    });
  }

  @Patch('me/profile')
  @RequirePermissions(Permission.USER_UPDATE_OWN)
  updateMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateOwnProfileDto) {
    return this.usersService.updateOwnProfile(user.sub, body).then((profile) => mapUserProfile(profile));
  }

  @Patch('me/password')
  @RequirePermissions(Permission.USER_UPDATE_OWN)
  changeMyPassword(@CurrentUser() user: AuthenticatedUser, @Body() body: ChangeOwnPasswordDto) {
    return this.usersService.changeOwnPassword(user.sub, body.currentPassword, body.newPassword).then((profile) =>
      mapUserProfile(profile),
    );
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
