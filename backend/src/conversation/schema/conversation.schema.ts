import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationSchema = HydratedDocument<Conversation>;

export enum ConversationType {
  PRIVATE = 'private',
  GROUP = 'group',
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ enum: ConversationType, required: true })
  type: ConversationType;

  @Prop({ required: false })
  name?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Message', required: false })
  lastMessage?: Types.ObjectId;

  @Prop({ default: Date.now, timestamp: true })
  createdAt: Date;

  @Prop({ default: Date.now, timestamp: true })
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
