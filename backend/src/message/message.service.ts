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

  async getMessagesForConversation(
    conversationId: string,
    options: {
      limit: number;
      skip?: number;
      beforeDate?: Date;
    },
  ): Promise<Message[]> {
    const filter: {
      conversationId: string;
      createdAt?: { $lt: Date };
    } = {
      conversationId,
    };

    if (options.beforeDate) {
      filter.createdAt = { $lt: options.beforeDate };
    }

    let query = this.message.find(filter).sort({ createdAt: -1 });

    if (!options.beforeDate && options.skip !== undefined) {
      query = query.skip(options.skip);
    }

    const messages = await query.limit(options.limit).exec();
    return messages;
  }
}
