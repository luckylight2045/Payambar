import { UserRole } from 'src/user/schema/user.schema';

export interface SafeUser {
  _id: string;
  userName: string;
  phoneNumber?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  password?: string;
  __v?: number;
}
