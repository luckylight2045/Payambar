import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Message } from 'src/message/schema/message.schema';
import { CreateMessageDto } from './dtos/create-message.dto';
import { ConversationService } from 'src/conversation/conversation.service';
import { MessageService } from 'src/message/message.service';
import { ConversationType } from 'src/conversation/schema/conversation.schema';

@Injectable()
export class ChatService {
  constructor(
    private readonly messageService: MessageService,
    private readonly conversationService: ConversationService,
  ) {}

  async createMessage(
    data: CreateMessageDto & {
      conversationId?: string;
      senderId: string;
      participantIds?: string[];
    },
  ): Promise<Message> {
    const { senderId, conversationId, participantIds, messageType, content } =
      data;

    const updateConvLastMessage = async (convId: string, messageId: string) => {
      await this.conversationService.updateLastMessage(convId, messageId);
    };

    if (conversationId) {
      const isMember = await this.conversationService.isParticipant(
        conversationId,
        senderId,
      );

      if (!isMember) {
        throw new ForbiddenException(
          'sender is not a participant in this conversation',
        );
      }

      const savedMessage = await this.messageService.createMessage({
        messageType,
        content,
        senderId,
        conversationId,
      });

      await updateConvLastMessage(
        savedMessage.conversationId.toString(),
        savedMessage._id.toString(),
      );
    }

    if (!participantIds || participantIds.length < 1) {
      throw new BadRequestException(
        'participantIds should exist when conversation does not exist',
      );
    }

    const participants = [
      ...new Set([senderId, ...participantIds.map(String)]),
    ];
  }

  async getConversationParticipants(conversationId: string) {
    return await this.conversationService.getConversationParticipants(
      conversationId,
    );
  }

  async getMessageForConversation(
    conversationId: string,
    userId: string,
    options: { limit: number; skip?: number; beforeDate?: Date },
  ) {
    if (!(await this.conversationService.getConversationById(conversationId))) {
      throw new NotFoundException('this conversation does not exist');
    }

    const participants =
      await this.conversationService.getConversationParticipants(
        conversationId,
      );
    if (!participants.includes(userId)) {
      throw new ForbiddenException(
        'the user is not authorized to access the conversation',
      );
    }
    return await this.messageService.getMessagesForConversation(
      conversationId,
      options,
    );
  }

  async getConversationForUser(userId: string) {
    return await this.conversationService.listConversationForUser(userId);
  }

  async createConversation(userId: string, participantIds: string[]) {
    const conversation =
      await this.conversationService.getPrivateConversation(userId);

    if (conversation) {
      return conversation;
    }
    return await this.conversationService.createConversation({
      type: ConversationType.PRIVATE,
      participants: [userId, ...participantIds],
    });
  }
}
