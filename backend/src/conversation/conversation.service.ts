import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation, ConversationType } from './schema/conversation.schema';
import { Model, Types } from 'mongoose';
import { CreateConversationDto } from './dtos/create.conversation.dto';

@Injectable()
export class ConversationService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversation: Model<Conversation>,
  ) {}

  async getConversationById(conversationId: string) {
    return await this.conversation.findById(conversationId).exec();
  }

  async getConversationParticipants(conversationId: string): Promise<string[]> {
    const conversation = await this.conversation
      .findById(conversationId)
      .select('participants');
    return conversation
      ? conversation.participants.map((id) => id.toString())
      : [];
  }

  async createConversation(data: CreateConversationDto) {
    const conversation = new this.conversation({ ...data });
    return conversation.save();
  }

  async updateLastMessage(conversationId: string, messageId: string) {
    const update = { lastMessage: messageId, updatedAt: new Date() };
    return await this.conversation
      .findByIdAndUpdate(conversationId, update, { new: true })
      .exec();
  }

  async listConversationForUser(userId: string) {
    return await this.conversation
      .find({ participants: userId })
      .sort({ updatedAt: -1 })
      .populate({
        path: 'participants',
        select: 'userName',
      })
      .populate({
        path: 'lastMessage',
        select: 'content senderId createdAt messageType',
      })
      .exec();
  }

  async getPrivateConversation(userId: string) {
    return await this.conversation.find({
      type: ConversationType.PRIVATE,
      participants: userId,
    });
  }

  async isParticipant(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(conversationId)) return false;
    const oid = new Types.ObjectId(conversationId);
    const res = await this.conversation
      .findOne({ _id: oid, participants: new Types.ObjectId(userId) })
      .select('_id')
      .lean()
      .exec();
    return !!res;
  }

  async findPrivateBetween(
    participants: string[],
  ): Promise<Conversation | null> {
    const oids = participants.map((p) =>
      Types.ObjectId.isValid(p) ? new Types.ObjectId(p) : p,
    );
    return await this.conversation
      .findOne({
        type: ConversationType.PRIVATE,
        participants: { $all: oids, $size: oids.length },
      })
      .exec();
  }
}
