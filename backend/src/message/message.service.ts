import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Message, MessageType } from './schema/message.schema';
import { Model, Types } from 'mongoose';
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

    let query = this.message
      .find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: 'senderId', select: 'name' });

    if (!options.beforeDate && options.skip !== undefined) {
      query = query.skip(options.skip);
    }

    const messages = await query.limit(options.limit).exec();
    return messages;
  }

  async countForConversation(conversationId: string): Promise<number> {
    if (!conversationId) return 0;
    return this.message
      .countDocuments({
        conversationId: Types.ObjectId.isValid(conversationId)
          ? new Types.ObjectId(conversationId)
          : conversationId,
      })
      .exec();
  }

  async deleteMessage(messageId: string, conversationId: string) {
    const isDeleted = await this.message.deleteOne({
      _id: messageId,
      conversationId,
    });

    if (!isDeleted) {
      throw new NotFoundException('message does not exist');
    }

    return isDeleted;
  }

  async editMessage(messageId: string, content: string) {
    const isEdited = await this.message.updateOne(
      { _id: messageId },
      { content },
    );

    if (!isEdited) {
      throw new NotFoundException('messsage does not exist');
    }

    return isEdited;
  }

  async clearHistory(conversationId: string) {
    const isDeleted = await this.message.deleteMany({
      conversationId,
    });

    if (!isDeleted) {
      throw new NotFoundException('no messages with the conversationId');
    }

    return isDeleted;
  }
}
