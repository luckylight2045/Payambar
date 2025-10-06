import { User } from '../schema/user.schema';

export type UserWithPresence = Omit<User, keyof Document> & {
  _id: string;
  lastSeenAt: string | null;
  online: boolean;
};
