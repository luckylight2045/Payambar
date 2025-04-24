import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation } from 'src/conversation/schema/conversation.schema';
import { Message } from 'src/message/schema/message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
  ) {}

  async createMessage(data: {
    conversationId: string;
    senderId: string;
    content: string;
  }): Promise<Message> {
    const message = new this.messageModel({
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
    });
    return message.save();
  }

  async getConversationParticipants(conversationId: string): Promise<string[]> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .select('participants');
    return conversation
      ? conversation.participants.map((id) => id.toString())
      : [];
  }
}
