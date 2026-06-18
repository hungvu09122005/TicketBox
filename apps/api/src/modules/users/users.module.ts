import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { User } from './entities/user.entity';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';

/**
 * UsersModule — owns User entity and all user data access.
 *
 * Boundary rules:
 *   - Only this module registers User entity in TypeORM.
 *   - UsersService is exported for AuthModule (login) and admin endpoints.
 *   - No other module imports UsersRepository directly.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission])],
  controllers: [UsersController],
  providers: [UsersService, RolesService, UsersRepository, PermissionsService],
  exports: [UsersService, RolesService, PermissionsService],
})
export class UsersModule {}
