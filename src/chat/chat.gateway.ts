/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io'; // ①
import { Handshake } from 'socket.io/dist/socket-types';
import { ChatService } from './chat.service';

interface ChatSocket extends Socket {
  handshake: Handshake & { query: { userId?: string } };
}

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly chatService: ChatService) {}
  private onlineUsers = new Map<string, string>();

  handleConnection(client: ChatSocket) {
    const userId = client.handshake.query.userId;
    if (userId) {
      this.onlineUsers.set(userId, client.id);
    }
  }

  handleDisconnect(client: ChatSocket) {
    for (const [uid, sid] of this.onlineUsers.entries()) {
      if (sid === client.id) {
        this.onlineUsers.delete(uid);
        break;
      }
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody()
    {
      conversationId,
      senderId,
      content,
    }: { conversationId: string; senderId: string; content: string },
    @ConnectedSocket() client: ChatSocket,
  ): Promise<void> {
    const message = await this.chatService.createMessage({
      conversationId,
      senderId,
      content,
    });

    const participants =
      await this.chatService.getConversationParticipants(conversationId);

    for (const pid of participants) {
      if (pid !== senderId) {
        const sid = this.onlineUsers.get(pid);
        if (sid) {
          client.to(sid).emit('receive_message', message);
        }
      }
    }
  }
}
