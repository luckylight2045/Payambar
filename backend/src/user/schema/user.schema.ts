import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Schema()
export class User {
  @Prop({ unique: true, required: true })
  name: string;

  @Prop({ required: false })
  firstName: string;

  @Prop({ required: false })
  lastName: string;

  @Prop({ required: false, unique: true, sparse: true })
  email: string;

  @Prop({ required: false, unique: true })
  phoneNumber: string;

  @Prop({ required: true })
  password: string;

  @Prop({ enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Prop({ default: Date.now, timestamp: true })
  createdAt: Date;

  @Prop({ default: Date.now, timestamp: true })
  updatedAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: String, default: null })
  refreshToken: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
