import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT authentication guard — validates the Bearer token and attaches user to request.
 * Delegates to the 'jwt' Passport strategy registered in AuthModule.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser>(err: Error, user: TUser): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Invalid or expired token.');
    }
    return user;
  }
}

/**
 * Optional JWT guard — does NOT throw if no token is present.
 * Use for endpoints that serve both authenticated and anonymous users.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Passport jwt strategy is invoked but failure is silently ignored.
    return true;
  }
}
