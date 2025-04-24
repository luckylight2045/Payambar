import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';

@Module({
  imports: [],
  providers: [ConversationService],
  controllers: [ConversationController],
})
export class ConversationModule {}
