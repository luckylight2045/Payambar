import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Message, MessageType } from './schema/message.schema';
import { Model } from 'mongoose';
import { CreateMessageDto } from 'src/chat/dtos/create-message.dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private readonly message: Model<Message>,
  ) {}

  async createMessage(
    data: CreateMessageDto & { conversationId: string; senderId: string },
  ) {
    const message = new this.message({
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      messageType: data.messageType || MessageType.TEXT,
    });
    return message.save();
  }
}
