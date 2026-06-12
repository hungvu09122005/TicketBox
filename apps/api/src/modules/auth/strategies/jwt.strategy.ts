import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('app.jwt.accessSecret') ?? '',
    });
  }

  validate(payload: {
    sub: string;
    email: string;
    roles: string[];
    permissionVersion: number;
    jti: string;
  }): AuthenticatedUser {
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
