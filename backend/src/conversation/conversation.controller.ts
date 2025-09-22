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

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {
    console.log('controller is instantiatted');
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async listConversationsForUser(@CurrentUser() user: HydratedDocument<User>) {
    return this.conversationService.listConversationForUser(
      user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteIfEmpty(
    @Param('id') id: string,
    @CurrentUser() user: HydratedDocument<User>,
  ) {
    return this.conversationService.deleteIfEmpty(id, user._id.toString());
  }
}
