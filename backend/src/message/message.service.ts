import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      replyTo: data.replyTo ? new Types.ObjectId(String(data.replyTo)) : null,
    });
    return await message.save();
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
      .populate([
        { path: 'senderId', select: '_id username name' },
        {
          path: 'replyTo',
          populate: { path: 'senderId', select: '_id username name' },
        },
      ])
      .lean();

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

  async getMessageById(messageId: string) {
    return await this.message.findOne({ _id: messageId });
  }

  async editMessage(messageId: string, content: string) {
    const message = await this.getMessageById(messageId);

    if (!message) {
      throw new NotFoundException('message does not exist');
    }

    if (message.content !== content) {
      const isEdited = await this.message.updateOne(
        { _id: messageId },
        { content, isEdited: true },
      );
      if (!isEdited) {
        throw new NotFoundException('messsage does not exist');
      }

      return isEdited;
    }

    return;
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

  async markAsDelivered(options: {
    recipientId: string;
    messageId?: string;
    messageIds?: string[];
    conversationId: string;
    upToMessageId?: string;
  }) {
    const { recipientId } = options;
    if (!recipientId) {
      throw new BadRequestException('receipentId is required');
    }

    const recipientOid = Types.ObjectId.isValid(recipientId)
      ? new Types.ObjectId(recipientId)
      : recipientId;

    if (Array.isArray(options.messageIds) && options.messageIds.length > 0) {
      const oids = options.messageIds
        .filter(Boolean)
        .map((id) =>
          Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id,
        );

      const res = await this.message
        .updateMany(
          { _id: { $in: oids } },
          { deliveredAt: new Date(), readAt: new Date(), isRead: true },
          {
            $addToSet: {
              deliveredTo: recipientId,
            },
          },
        )
        .exec();
      return {
        matchedCount: res.matchedCount,
        modifiedCount: res.modifiedCount,
      };
    }

    if (options.conversationId && options.upToMessageId) {
      const upTo = await this.message
        .findById(options.upToMessageId)
        .select('createdAt')
        .lean()
        .exec();

      if (!upTo) {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      const query = {
        conversationId: Types.ObjectId.isValid(options.conversationId)
          ? new Types.ObjectId(options.conversationId)
          : options.conversationId,
        deliveredTo: { $ne: recipientId },
        createdAt: new Date(),
      };

      const res = await this.message.updateMany(query, {
        isRead: true,
        readAt: new Date(),
        deliveredAt: new Date(),
        $addToSet: {
          deliveredTo: recipientId,
        },
      });

      return {
        matchedCount: res.matchedCount,
        modifiedCount: res.modifiedCount,
      };
    }

    if (options.messageId) {
      const mid = options.messageId;
      const res = await this.message
        .updateOne(
          { _id: Types.ObjectId.isValid(mid) ? new Types.ObjectId(mid) : mid },
          { $addToSet: { deliveredTo: recipientOid } },
        )
        .exec();
      return {
        matchedCount: res.matchedCount,
        modifiedCount: res.modifiedCount ?? 0,
      };
    }

    throw new Error(
      'No messageId/messageIds or conversationId+upToMessageId provided',
    );
  }
}
