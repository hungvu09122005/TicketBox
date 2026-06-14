import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * AuthService — application service for authentication.
 *
 * Boundary rules:
 *   - Accesses user data ONLY through UsersService (module boundary).
 *   - Does NOT import UserRepository or User entity.
 *   - Password hashing happens here, not in UsersService.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.usersService.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already registered.');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.createUser({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    return this.issueTokens(user.id, user.email, user.permissionVersion, user.roles);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials.');

    if (!user.isActive) throw new UnauthorizedException('Account is inactive.');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials.');

    return this.issueTokens(user.id, user.email, user.permissionVersion, user.roles);
  }

  async refresh(refreshToken: string) {
    // TODO Phase 1: verify refresh token signature + check revocation list
    throw new Error('Not implemented');
  }

  private issueTokens(userId: string, email: string, permissionVersion: number, roles: string[]) {
    const payload = { sub: userId, email, permissionVersion, roles };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: this.config.get<string>('app.jwt.refreshSecret'),
        expiresIn: this.config.get<string>('app.jwt.refreshExpiresIn'),
      }),
    };
  }
}
