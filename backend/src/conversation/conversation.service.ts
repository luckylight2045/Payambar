import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation } from './schema/conversation.schema';
import { Model } from 'mongoose';
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
}
