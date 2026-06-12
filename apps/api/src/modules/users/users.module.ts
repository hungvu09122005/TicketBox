import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { User } from './entities/user.entity';

/**
 * UsersModule — owns User entity and all user data access.
 *
 * Boundary rules:
 *   - Only this module registers User entity in TypeORM.
 *   - UsersService is exported for AuthModule (login) and admin endpoints.
 *   - No other module imports UsersRepository directly.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
