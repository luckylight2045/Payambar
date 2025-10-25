import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  IMAGE = 'image',
  VIDEO = 'video',
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ enum: MessageType, default: MessageType.TEXT })
  messageType: MessageType;

  @Prop({ reuired: true })
  content: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Date, default: null })
  deliveredAt?: Date;

  @Prop({ type: Array, default: [] })
  deliveredTo: string[];

  @Prop({ type: Date, default: null })
  readAt?: Date;

  @Prop({ default: false })
  isEdited: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Message', default: null })
  replyTo: Types.ObjectId;

  @Prop({ default: null })
  attachMentKey: string;

  @Prop({ default: null })
  publicUrl: string;

  @Prop({ default: null })
  originalName: string;

  @Prop({ default: Date.now, timestamp: true })
  createdAt: Date;

  @Prop({ default: Date.now, timestamp: true })
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, createdAt: -1 });
