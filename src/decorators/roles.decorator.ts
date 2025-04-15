import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'src/user/schema/user.schema';

export const ROLES_KEY = 'key';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
