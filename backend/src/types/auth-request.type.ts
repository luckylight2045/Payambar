// types/auth-request.type.ts
import { Request } from 'express';
import { HydratedDocument } from 'mongoose';
import { User } from 'src/user/schema/user.schema';

export interface AuthRequest extends Request {
  user: HydratedDocument<User>;
}
