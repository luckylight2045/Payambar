import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { CreateMessageDto } from './dtos/create-message.dto';
import { HydratedDocument } from 'mongoose';
import { User } from 'src/user/schema/user.schema';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { GetMessagesQueryDto } from './dtos/get-messages-query.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations/:conversationId/messages')
  async sendToExisting(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: HydratedDocument<User>,
    @Body() body: CreateMessageDto,
  ) {
    return this.chatService.createMessage({
      ...body,
      conversationId,
      senderId: user._id.toString(),
    });
  }

  @Post('private/:otherUserId/messages')
  async sendPrivate(
    @Param('otherUserId') otherUserId: string,
    @CurrentUser() user: HydratedDocument<User>,
    @Body() body: CreateMessageDto,
  ) {
    if (!otherUserId) {
      throw new BadRequestException(
        'otherUserId is required for private chats',
      );
    }

    return await this.chatService.createMessage({
      ...body,
      senderId: user._id.toString(),
      participantIds: [otherUserId],
    });
  }

  @Post('group/messages')
  async sendToGroup(
    @CurrentUser() user: HydratedDocument<User>,
    @Body('participantIds') participantIds: string[],
    @Body() body: CreateMessageDto,
  ) {
    if (!participantIds || participantIds.length < 2) {
      throw new BadRequestException(
        'participantIds must include at least two user IDs for group chats',
      );
    }

    return this.chatService.createMessage({
      ...body,
      senderId: user._id.toString(),
      participantIds,
    });
  }

  @Get('conversations/:conversationId/messages')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: HydratedDocument<User>,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.chatService.getMessageForConversation(
      conversationId,
      user._id.toString(),
      {
        limit: query.limit,
        skip: query.skip,
        beforeDate: query.beforeDate,
      },
    );
  }
}
