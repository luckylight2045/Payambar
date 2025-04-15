import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/decorators/roles.decorator';
import { AuthRequest } from 'src/types/auth-request.type';
import { UserRole } from 'src/user/schema/user.schema';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    console.log(requiredRoles);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Requires ${requiredRoles.join('')} role. Your role: ${user.role}`,
      );
    }

    return true;
  }
}
