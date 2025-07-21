import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Handshake } from 'socket.io/dist/socket-types';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dtos/create-message.dto';

interface ChatSocket extends Socket {
  handshake: Handshake & { query: { userId?: string } };
}

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly chatService: ChatService) {}
  private onlineUsers = new Map<string, string[]>();

  handleConnection(client: ChatSocket) {
    const userId = client.handshake.query.userId;
    if (userId) {
      const sockets = this.onlineUsers.get(userId) || [];
      sockets.push(client.id);
      this.onlineUsers.set(userId, sockets);
      client.broadcast.emit('user_connected', { userId });
    }
  }

  handleDisconnect(client: ChatSocket) {
    const userId = client.handshake.query.userId;
    if (userId) {
      const sockets = this.onlineUsers.get(userId) || [];
      const updatedSockets = sockets.filter((sid) => sid != client.id);
      if (updatedSockets.length == 0) {
        this.onlineUsers.delete(userId);
        client.broadcast.emit('user_disconnected', { userId });
      } else {
        this.onlineUsers.set(userId, updatedSockets);
      }
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody()
    data: CreateMessageDto & {
      conversationId: string;
      senderId: string;
      participantIds: string[];
    },
    @ConnectedSocket() client: ChatSocket,
  ): Promise<void> {
    const clientUserId = client.handshake.query.userId;
    if (clientUserId !== data.senderId) {
      throw new Error('Unauthorized sender');
    }

    const message = await this.chatService.createMessage(data);

    const participants = await this.chatService.getConversationParticipants(
      data.conversationId,
    );
    for (const pid of participants) {
      if (pid !== data.senderId) {
        const sockets = this.onlineUsers.get(pid) || [];
        for (const sid of sockets) {
          client.to(sid).emit('receive_message', message);
        }
      }
    }
  }
}
