import { ConversationService } from './conversation.service';

export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}
}
