import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation, ConversationType } from './schema/conversation.schema';
import { Model, Types } from 'mongoose';
import { CreateConversationDto } from './dtos/create.conversation.dto';
import { HydratedDocument } from 'mongoose';
import { MessageService } from 'src/message/message.service';

export type ConversationDocument = HydratedDocument<Conversation>;
@Injectable()
export class ConversationService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversation: Model<ConversationDocument>,
    private readonly messageService: MessageService,
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
        select: 'name',
      })
      .populate({
        path: 'lastMessage',
        select: 'content senderId createdAt messageType',
        populate: { path: 'senderId', select: 'name' },
      })
      .lean()
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
  ): Promise<ConversationDocument | null> {
    const oids = participants.map((p) =>
      Types.ObjectId.isValid(p) ? new Types.ObjectId(p) : p,
    );
    return this.conversation
      .findOne({
        type: ConversationType.PRIVATE,
        participants: { $all: oids, $size: oids.length },
      })
      .exec() as Promise<ConversationDocument | null>;
  }

  async createPrivateConversation(participants: string[] | Types.ObjectId[]) {
    if (!participants || participants.length < 2)
      throw new BadRequestException('At least two participants are required');
    const normalized = participants.map((p: string | Types.ObjectId) =>
      typeof p === 'string' ? new Types.ObjectId(p) : p,
    );
    const conv = new this.conversation({
      type: ConversationType.PRIVATE,
      participants: normalized,
    });
    await conv.save();
    return conv;
  }

  async findConversationById(conversationId: string) {
    if (!conversationId) {
      throw new BadRequestException('conversationId is not provided');
    }

    const conversation = await this.conversation.findById(conversationId);

    if (!conversation) {
      throw new NotFoundException('conversation is not found');
    }

    return conversation;
  }

  async deleteIfEmpty(
    conversationId: string,
    requesterId: string,
  ): Promise<{ deleted: boolean; reason?: string }> {
    if (!Types.ObjectId.isValid(conversationId)) {
      return { deleted: false, reason: 'invalid_conversation_id' };
    }

    const conv = await this.findConversationById(conversationId);
    if (!conv) {
      return { deleted: false, reason: 'not_found' };
    }

    const isParticipant = (conv.participants || []).some(
      (p: any) => String(p) === String(requesterId),
    );
    if (!isParticipant) {
      return { deleted: false, reason: 'not_participant' };
    }

    const count =
      await this.messageService.countForConversation(conversationId);
    if (count > 0) {
      return { deleted: false, reason: 'has_messages' };
    }

    await this.conversation.deleteOne({ _id: conversationId }).exec();
    return { deleted: true };
  }

  async deleteConversatiohn(conversationId: string) {
    const isDeleted = await this.conversation.deleteOne({
      _id: conversationId,
    });

    if (!isDeleted) {
      throw new NotFoundException(
        'conversationId does not match any conversation',
      );
    }

    return isDeleted;
  }
}
