import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { AuthActionPurpose } from './auth.types';
import { Role } from '../../common/constants/roles.enum';

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
      isActive: false,
      roles: [Role.AUDIENCE],
    });

    await this.usersService.sendActivationEmail(user, dto.app ?? 'audience');

    return {
      success: true,
      message: 'Account created. Please check your email to activate it.',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (user) {
      if (user.isActive) {
        await this.usersService.sendPasswordResetEmail(user, dto.app ?? 'audience');
      } else {
        await this.usersService.sendActivationEmail(user, dto.app ?? 'audience');
      }
    }

    return {
      success: true,
      message: 'If the account exists, we sent an email with the next step.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.consumeActionToken(dto.token, 'password-reset');
    if (!user) {
      throw new UnauthorizedException('Invalid or expired password reset token.');
    }

    const nextPasswordHash = await bcrypt.hash(dto.password, 12);
    const currentUser = await this.usersService.findById(user.id);
    if (!currentUser) {
      throw new UnauthorizedException('Invalid or expired password reset token.');
    }

    await this.usersService.updatePassword(currentUser.id, nextPasswordHash);
    await this.usersService.invalidatePermissionCache(currentUser.id);

    return {
      success: true,
      message: 'Password updated successfully. Please sign in again.',
    };
  }

  async activateAccount(dto: ActivateAccountDto) {
    const user = await this.consumeActionToken(dto.token, 'activation');
    if (!user) {
      throw new UnauthorizedException('Invalid or expired activation token.');
    }

    const currentUser = await this.usersService.findById(user.id);
    if (!currentUser) {
      throw new UnauthorizedException('Invalid or expired activation token.');
    }

    if (!currentUser.isActive) {
      await this.usersService.updateActiveStatus(currentUser.id, true, 'self-activation', false);
    }

    return {
      success: true,
      message: 'Account activated successfully. You can now sign in.',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials.');

    if (!user.isActive) throw new UnauthorizedException('Account is inactive.');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials.');

    return this.issueTokens(user.id, user.email, user.permissionVersion, (user.roles || []).map((role: any) => role.name));
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

      if (user.permissionVersion !== (payload.permissionVersion ?? 0)) {
        throw new UnauthorizedException('Session expired. Please sign in again.');
      }

      // Revoke the old refresh token to prevent reuse (Token Rotation)
      const exp = payload.exp * 1000;
      const ttl = Math.max(0, exp - Date.now());
      if (ttl > 0) {
        await this.cacheManager.set(`revoked_token:${payload.jti}`, true, ttl);
      }

      return this.issueTokens(user.id, user.email, user.permissionVersion, user.roles.map((role: any) => role.name));
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
      this.logger.debug(`Ignored error during token revocation: ${(error as Error).message}`);
      return { success: true, message: 'Token successfully revoked' };
    }
  }

  private async consumeActionToken(token: string, purpose: AuthActionPurpose): Promise<{ id: string } | null> {
    const cacheKey = `auth:${purpose}:${token}`;
    const userId = await this.cacheManager.get<string>(cacheKey);

    if (!userId) {
      return null;
    }

    await this.cacheManager.del(cacheKey);
    return { id: userId };
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
