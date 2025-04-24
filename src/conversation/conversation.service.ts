import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation } from './schema/conversation.schema';
import { Model } from 'mongoose';

@Injectable()
export class ConversationService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversation: Model<Conversation>,
  ) {}

  async getConversationById(conversationId: string) {
    return await this.conversation.findById(conversationId).exec();
  }
}
