import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { CreateMessageDto } from './dtos/create-message.dto';
import { HydratedDocument } from 'mongoose';
import { User } from 'src/user/schema/user.schema';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':conversationId')
  async createMessage(
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
}
