import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthRequest } from 'src/types/auth-request.type';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthRequest>();

    return request.user;
  },
);
