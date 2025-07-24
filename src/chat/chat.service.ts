import {
  BadRequestException,
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

    if (conversationId) {
      const conversation =
        await this.conversationService.getConversationById(conversationId);

      if (!conversation) {
        throw new NotFoundException('related conversation does not exist');
      }

      if (
        !conversation.participants
          .map((participant) => participant.toString())
          .includes(senderId)
      ) {
        throw new BadRequestException(
          'Sender is not a participant in this conversation',
        );
      }

      return await this.messageService.createMessage({
        messageType,
        content,
        senderId,
        conversationId,
      });
    } else {
      if (!participantIds || participantIds.length < 1) {
        throw new BadRequestException(
          'participantIds should exist when conversation does not exist',
        );
      }
      const participants = [...new Set([senderId, ...participantIds])];
      const newConv = await this.conversationService.createConversation({
        type: ConversationType.PRIVATE,
        participants,
      });
      return await this.messageService.createMessage({
        ...data,
        conversationId: newConv._id.toString(),
      });
    }
  }

  async getConversationParticipants(conversationId: string) {
    return await this.conversationService.getConversationParticipants(
      conversationId,
    );
  }
}
