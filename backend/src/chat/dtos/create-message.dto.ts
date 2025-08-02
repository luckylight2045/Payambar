import { MessageType } from 'src/message/schema/message.schema';

export interface CreateMessageDto {
  content: string;
  messageType: MessageType;
}
