import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { MessageModule } from 'src/message/message.module';
import { ConversationModule } from 'src/conversation/conversation.module';

@Module({
  imports: [MessageModule, ConversationModule],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
