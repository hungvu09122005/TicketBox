import { Injectable, UnauthorizedException, ConflictException, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.get<string>('app.jwt.refreshSecret'),
      });

      const isRevoked = await this.cacheManager.get(`revoked_token:${payload.jti}`);
      if (isRevoked) {
        throw new UnauthorizedException('Token has been revoked.');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user?.isActive) {
        throw new UnauthorizedException('Account is inactive or not found.');
      }

      // Revoke the old refresh token to prevent reuse (Token Rotation)
      // Calculate remaining TTL
      const exp = payload.exp * 1000;
      const ttl = Math.max(0, exp - Date.now());
      if (ttl > 0) {
        await this.cacheManager.set(`revoked_token:${payload.jti}`, true, ttl);
      }

      return this.issueTokens(user.id, user.email, user.permissionVersion, user.roles);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(`Refresh token validation failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  async revoke(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.get<string>('app.jwt.refreshSecret'),
        ignoreExpiration: true,
      });

      const exp = payload.exp * 1000;
      const ttl = Math.max(0, exp - Date.now());

      if (ttl > 0) {
        await this.cacheManager.set(`revoked_token:${payload.jti}`, true, ttl);
      }
      return { success: true, message: 'Token successfully revoked' };
    } catch (error) {
      // If token is completely invalid, we don't throw, just return success
      this.logger.debug(`Ignored error during token revocation: ${(error as Error).message}`);
      return { success: true, message: 'Token successfully revoked' };
    }
  }

  private issueTokens(userId: string, email: string, permissionVersion: number, roles: string[]) {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const accessPayload = { sub: userId, email, permissionVersion, roles, jti: accessJti };
    const refreshPayload = { sub: userId, email, permissionVersion, roles, jti: refreshJti };

    return {
      accessToken: this.jwtService.sign(accessPayload),
      refreshToken: this.jwtService.sign(refreshPayload, {
        secret: this.config.get<string>('app.jwt.refreshSecret'),
        expiresIn: this.config.get<string>('app.jwt.refreshExpiresIn'),
      }),
    };
  }
}
