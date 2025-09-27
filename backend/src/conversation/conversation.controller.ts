import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { HydratedDocument } from 'mongoose';
import { User } from 'src/user/schema/user.schema';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get('me')
  async listConversationsForUser(@CurrentUser() user: HydratedDocument<User>) {
    return this.conversationService.listConversationForUser(
      user._id.toString(),
    );
  }

  @Post('private/:otherUserId')
  async createOrGetPrivate(
    @Param('otherUserId') otherUserId: string,
    @CurrentUser() user: HydratedDocument<User>,
  ) {
    const currentUserId = user._id.toString();
    const participants = [currentUserId, otherUserId].map((p) => p.toString());
    const existing =
      await this.conversationService.findPrivateBetween(participants);
    if (existing) return existing;
    const conv =
      await this.conversationService.createPrivateConversation(participants);
    return conv;
  }

  @Delete(':id')
  async deleteIfEmpty(
    @Param('id') id: string,
    @CurrentUser() user: HydratedDocument<User>,
  ) {
    return this.conversationService.deleteIfEmpty(id, user._id.toString());
  }

  @Delete(':id')
  async deleteConversation(@Param('id') conversationId: string) {
    return await this.conversationService.deleteConversatiohn(conversationId);
  }
}
