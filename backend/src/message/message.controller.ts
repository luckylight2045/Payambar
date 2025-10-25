import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { JwtAuthGuard } from 'src/auth/auth.guard';
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}
  @Delete('history/:id')
  async clearHistory(@Param('id') conversationId: string) {
    return await this.messageService.clearHistory(conversationId);
  }

  @Delete(':messageId')
  async deleteMessage(@Param('messageId') messageId: string) {
    return await this.messageService.deleteMessage(messageId);
  }

  @Patch(':id')
  async editMessage(
    @Param('id') messageId: string,
    @Body() body: { content: string },
  ) {
    return await this.messageService.editMessage(messageId, body.content);
  }
}
