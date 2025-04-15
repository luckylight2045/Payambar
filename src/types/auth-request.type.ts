// types/auth-request.type.ts
import { Request } from 'express';
import { User } from 'src/user/schema/user.schema';

export interface AuthRequest extends Request {
  user: User;
}
