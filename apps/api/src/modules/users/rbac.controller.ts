import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { Role } from '../../common/constants/roles.enum';
import { ROLE_PERMISSIONS_MAPPING } from '../../common/constants/role-permissions.mapping';
import { UsersService } from './users.service';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';

function mapUserSummary(user: NonNullable<Awaited<ReturnType<UsersService['findById']>>>) {
  const roles = user.roles ?? [];
  const permissions = Array.from(
    new Set(
      roles.flatMap((role) =>
        role.permissions?.length
          ? role.permissions.map((permission) => permission.name)
          : ROLE_PERMISSIONS_MAPPING[role.name as Role] ?? [],
      ),
    ),
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: roles.map((role) => role.name),
    permissions,
    permissionVersion: user.permissionVersion,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@ApiTags('rbac')
@ApiBearerAuth()
@Controller('rbac')
@UseGuards(JwtAuthGuard, RbacGuard)
export class RbacController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get('users')
  @RequirePermissions(Permission.RBAC_MANAGE)
  async listUsers(
    @Query('query') query?: string,
    @Query('role') role?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    const result = await this.usersService.findMany({ query, role, page, limit });
    return {
      ...result,
      items: result.items.map((user) => mapUserSummary(user)),
    };
  }

  @Get('roles')
  @RequirePermissions(Permission.RBAC_MANAGE)
  async listRoles() {
    const roles = await this.rolesService.findAll();
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      permissions: (role.permissions ?? []).map((permission) => permission.name),
    }));
  }

  @Get('permissions')
  @RequirePermissions(Permission.RBAC_MANAGE)
  async listPermissions() {
    const permissions = await this.permissionsService.findAll();
    return permissions.map((permission) => ({
      id: permission.id,
      name: permission.name,
    }));
  }

  @Post('permissions')
  @RequirePermissions(Permission.RBAC_MANAGE)
  async createPermission(@Body() body: CreatePermissionDto) {
    const permission = await this.permissionsService.createPermissionIfNotExists(body.name.trim());
    return {
      id: permission.id,
      name: permission.name,
    };
  }

  @Patch('roles/:id/permissions')
  @RequirePermissions(Permission.RBAC_MANAGE)
  updateRolePermissions(
    @Param('id') roleId: string,
    @Body() body: UpdateRolePermissionsDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.rolesService.updateRolePermissions(roleId, body.permissions, admin.sub);
  }
}
