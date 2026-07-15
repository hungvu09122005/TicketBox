import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('JWT_ACCESS_SECRET') ||
        config.get<string>('app.jwt.accessSecret') ||
        'ticketbox_access_secret_dev',
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    roles: string[];
    permissionVersion: number;
    jti: string;
  }): Promise<AuthenticatedUser> {
    if (payload.jti) {
      const isRevoked = await this.cacheManager.get(`revoked_token:${payload.jti}`);
      if (isRevoked) {
        throw new UnauthorizedException('Token has been revoked.');
      }
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user?.isActive) {
      throw new UnauthorizedException('Account is inactive.');
    }

    if (user.permissionVersion !== (payload.permissionVersion ?? 0)) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    // Payload validated by Passport; attach to request.user
    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
      permissionVersion: payload.permissionVersion ?? 0,
      jti: payload.jti ?? '',
    };
  }
}
