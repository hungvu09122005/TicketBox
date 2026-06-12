import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator that extracts the authenticated user from the request.
 * The user is attached by JwtAuthGuard after validating the JWT.
 *
 * @example
 *   async getOrders(\@CurrentUser() user: AuthenticatedUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);

/**
 * Shape of the authenticated user attached to request by JwtStrategy.
 * Contains only minimal JWT claims — no full permission list in memory.
 */
export interface AuthenticatedUser {
  sub: string;       // user UUID
  email: string;
  roles: string[];   // role names
  permissionVersion: number;
  jti: string;
}
