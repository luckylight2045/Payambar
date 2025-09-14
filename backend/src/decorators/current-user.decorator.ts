import {
  ExecutionContext,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { HydratedDocument } from 'mongoose';
import { AuthRequest } from 'src/types/auth-request.type';
import { User } from 'src/user/schema/user.schema';

export const CurrentUser = createParamDecorator<
  HydratedDocument<User>,
  unknown
>((_data, ctx: ExecutionContext): HydratedDocument<User> => {
  const request = ctx.switchToHttp().getRequest<AuthRequest>();
  console.log('life');
  if (!request.user) {
    throw new UnauthorizedException('user not found in request');
  }
  return request.user;
});
