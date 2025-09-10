import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { HydratedDocument } from 'mongoose';
import { User } from 'src/user/schema/user.schema';
import { JwtAuthGuard } from 'src/auth/auth.guard';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async listConversationsForUser(@CurrentUser() user: HydratedDocument<User>) {
    return this.conversationService.listConversationForUser(
      user._id.toString(),
    );
  }
}
