import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dtos/create-message.dto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger, NotFoundException } from '@nestjs/common';
import { createClient as createNodeRedisClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { JwtPayload } from 'src/auth/interfaces/jwt.payload';
import { UserService } from 'src/user/user.service';
import { MessageService } from 'src/message/message.service';

type AuthSocket = Socket<any, any, any, { userId?: string }>;

@WebSocketGateway({ cors: true })
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('ChatGateway');

  constructor(
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly messageService: MessageService,
    @InjectRedis() private readonly ioredis: Redis,
  ) {}

  async afterInit() {
    const pubClient = createNodeRedisClient({
      url: this.configService.get<string>('REDIS_URL'),
    });
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    this.server.adapter(createAdapter(pubClient, subClient));
    this.logger.log('Socket.io Redis adapter configured');
  }

  async handleConnection(client: AuthSocket) {
    const auth = client.handshake?.auth as unknown;
    const maybeToken =
      auth && typeof (auth as Record<string, unknown>)['token'] === 'string'
        ? (auth as Record<string, string>)['token']
        : undefined;

    console.log('handleConnection');
    if (typeof maybeToken !== 'string') {
      this.logger.warn(`socket ${client.id} connected without token`);
      client.emit('error', 'Authentication required');
      client.disconnect(true);
      return;
    }

    const token = maybeToken.replace(/^Bearer\s+/i, '');

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('ACCESS_TOKEN_SECRET_KEY'),
      });

      const user = await this.userService.getUserByUserName(payload.userName);
      if (!user) {
        throw new NotFoundException('user is not found');
      }

      const userId = user._id.toString();
      client.data.userId = userId;

      const socketId = client.id;
      if (!socketId) {
        this.logger.warn(`Connection has no socket id for user ${userId}`);
        try {
          await this.ioredis.sadd('online_users', userId);
        } catch (err) {
          this.logger.warn(
            'Redis add online_users failed',
            (err as Error).message,
          );
        }
        return;
      }

      try {
        await this.ioredis
          .multi()
          .sadd(`online:${userId}`, socketId)
          .sadd('online_users', userId)
          .set(`socket:${socketId}`, userId, 'EX', 86400)
          .exec();
      } catch (err) {
        this.logger.warn(
          'Redis multi in handleConnection failed',
          (err as Error).message,
        );
      }

      try {
        const members = await this.ioredis.smembers(`online:${userId}`);
        if (members && members.length > 0) {
          const pipeline = this.ioredis.pipeline();
          members.forEach((sid) => pipeline.exists(`socket:${sid}`));
          const existsResults = await pipeline.exec();
          if (!existsResults) {
            throw new NotFoundException('no results found');
          }
          const stale: string[] = [];
          existsResults.forEach((res, i) => {
            const [err, val] = res as [Error | null, number | null];
            const exists = !err && val === 1;
            if (!exists) stale.push(members[i]);
          });
          if (stale.length > 0) {
            const pipe2 = this.ioredis.multi();
            pipe2.srem(`online:${userId}`, ...stale);
            stale.forEach((sid) => pipe2.del(`socket:${sid}`));
            await pipe2.exec();
            this.logger.log(
              `Pruned stale sockets for user ${userId}: ${stale.join(',')}`,
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          'Failed to prune stale sockets',
          (err as Error).message,
        );
      }
      const remaining = await this.ioredis.scard(`online:${userId}`);
      if (remaining === 1) {
        this.server.emit('user_connected', { userId });
        this.logger.log(`User ${userId} is now online`);
      }

      try {
        const onlineUserIds = await this.ioredis.smembers('online_users');
        client.emit('online_list', onlineUserIds);
      } catch (err) {
        this.logger.warn('Failed to fetch online_list', (err as Error).message);
      }
    } catch (err) {
      this.logger.warn(
        `Socket ${client.id} auth failed: ${(err as Error).message}`,
      );
      client.emit('error', 'Authentication failed');
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthSocket) {
    const socketId = client.id;
    let userId: string | null = null;
    console.log('handleDisconnect');
    try {
      if (client.data && typeof client.data.userId === 'string') {
        userId = client.data.userId;
      } else if (socketId) {
        const maybe = await this.ioredis.get(`socket:${socketId}`);
        if (typeof maybe === 'string' && maybe.length > 0) userId = maybe;
      }
    } catch (err) {
      this.logger.warn(
        `Error reading socket->user mapping for socket ${socketId}: ${(err as Error).message}`,
      );
    }

    if (typeof userId !== 'string') {
      this.logger.debug(
        `Disconnected socket ${socketId} had no associated user`,
      );
      if (socketId) {
        try {
          await this.ioredis.del(`socket:${socketId}`);
        } catch (e) {
          console.log(e);
        }
      }
      return;
    }

    const multi = this.ioredis.multi();
    if (socketId) multi.srem(`online:${userId}`, socketId);
    multi.del(`socket:${socketId}`);

    try {
      await multi.exec();
    } catch (err) {
      this.logger.warn(
        `Redis multi in handleDisconnect failed: ${(err as Error).message}`,
      );
    }

    try {
      const members = await this.ioredis.smembers(`online:${userId}`);
      if (members && members.length > 0) {
        const pipeline = this.ioredis.pipeline();
        members.forEach((sid) => pipeline.exists(`socket:${sid}`));
        const existsResults = await pipeline.exec();
        if (!existsResults) {
          throw new NotFoundException();
        }
        const stale: string[] = [];
        existsResults.forEach((res, i) => {
          const [err, val] = res as [Error | null, number | null];
          const exists = !err && val === 1;
          if (!exists) stale.push(members[i]);
        });
        if (stale.length > 0) {
          const p2 = this.ioredis.multi();
          p2.srem(`online:${userId}`, ...stale);
          stale.forEach((sid) => p2.del(`socket:${sid}`));
          await p2.exec();
          this.logger.log(
            `Pruned stale sockets for user ${userId} on disconnect: ${stale.join(',')}`,
          );
        }
      }

      const remaining = await this.ioredis.scard(`online:${userId}`);
      this.logger.debug('remaining', remaining);

      if (remaining === 0) {
        try {
          await this.ioredis.srem('online_users', userId);
        } catch (err) {
          this.logger.warn(
            `Failed to remove ${userId} from online_users: ${(err as Error).message}`,
          );
        }
        this.server.emit('user_disconnected', { userId });
        this.logger.log(`User ${userId} is now offline`);
      } else {
        this.logger.debug(
          `Socket ${socketId} removed for user ${userId}. ${remaining} sockets remain.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to compute remaining sockets for ${userId}: ${(err as Error).message}`,
      );
    }
  }

  private async notifyUser(
    userId: string,
    event: string,
    payload: any,
    excludeRoom?: string,
  ) {
    const sockets = await this.ioredis.smembers(`online:${userId}`);
    if (!sockets || sockets.length === 0) return;

    const excluded = new Set<string>();
    if (excludeRoom) {
      const room = this.server.sockets.adapter.rooms.get(excludeRoom);
      if (room) {
        for (const sid of room) excluded.add(sid);
      }
    }

    for (const sid of sockets) {
      if (excluded.has(sid)) continue;
      this.server.to(sid).emit(event, payload);
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthSocket,
  ) {
    const userId = client.data.userId;
    if (typeof userId !== 'string') {
      client.emit('error', 'Unauthenticated');
      return;
    }
    const convId = data?.conversationId;
    if (typeof convId !== 'string') {
      client.emit('error', 'conversationId required');
      return;
    }

    await client.join(convId);
    this.logger.debug(`User ${userId} joined room ${convId}`);
  }

  async handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthSocket,
  ) {
    const userId = client.data.userId;
    if (typeof userId !== userId) {
      client.emit('error', 'unauthenticated');
      return;
    }

    const convId = data?.conversationId;
    if (typeof convId !== 'string') {
      client.emit('error', 'conversationId required');
      return;
    }

    await client.leave(convId);
    this.logger.debug(`User ${userId} left room ${convId}`);
  }

  @SubscribeMessage('messages_received')
  async handleMessagesReceived(
    @MessageBody()
    data: {
      messageIds?: string[];
      messageId?: string;
      conversationId?: string;
      upToMessageId?: string;
    },
    @ConnectedSocket() client: AuthSocket,
  ) {
    const recipientId = client?.data?.userId;
    if (typeof recipientId !== 'string') {
      client.emit('error', 'Unauthenticated');
      return;
    }

    try {
      let idsToProcess: string[] = [];

      if (Array.isArray(data?.messageIds) && data.messageIds.length > 0) {
        idsToProcess = data.messageIds.filter(Boolean).map(String);
      } else if (data?.messageId) {
        idsToProcess = [String(data.messageId)];
      } else if (data?.conversationId && data?.upToMessageId) {
        const upToMsg = await this.messageService.getMessageById(
          String(data.upToMessageId),
        );
        if (!upToMsg || !upToMsg.createdAt) {
          client.emit('messages_received_ack', {
            ok: true,
            processed: 0,
            results: [],
          });
          return;
        }
        const beforeDate = new Date(new Date(upToMsg.createdAt).getTime() + 1);
        const msgs = await this.messageService.getMessagesForConversation(
          String(data.conversationId),
          {
            limit: 1000,
            beforeDate,
          },
        );
        const msgsAny = Array.isArray(msgs) ? (msgs as any[]) : [];
        idsToProcess = msgsAny
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          .map((m: any) => String(m._id ?? m.id ?? ''))
          .filter(Boolean);
      } else {
        client.emit('messages_received_ack', {
          ok: false,
          reason: 'no_ids_provided',
        });
        return;
      }

      if (idsToProcess.length === 0) {
        client.emit('messages_received_ack', {
          ok: true,
          processed: 0,
          results: [],
        });
        return;
      }

      await this.messageService.markAsDelivered({
        recipientId: recipientId,
        messageIds: idsToProcess,
        conversationId: data?.conversationId ?? '',
      });

      const fetched = await Promise.all(
        idsToProcess.map((id) =>
          this.messageService.getMessageById(String(id)),
        ),
      );

      const results: Array<{
        messageId: string;
        ok: boolean;
        reason?: string;
        deliveredAt?: string;
      }> = [];
      const seen = new Set<string>();

      for (const m of fetched) {
        if (!m) continue;
        const mid = String(m._id ?? m.id ?? '');
        if (!mid || seen.has(mid)) continue;
        seen.add(mid);
        const senderRaw = m.senderId;
        let senderId: string | null = null;
        if (senderRaw && typeof senderRaw === 'object') {
          senderId = String(senderRaw._id ?? senderRaw.id ?? senderRaw);
        } else if (senderRaw) {
          senderId = String(senderRaw);
        }
        const deliveredAtIso = m.deliveredAt
          ? new Date(m.deliveredAt).toISOString()
          : new Date().toISOString();
        if (senderId && senderId !== String(recipientId)) {
          try {
            await this.notifyUser(
              senderId,
              'message_delivered',
              {
                messageId: mid,
                recipientId,
                deliveredAt: deliveredAtIso,
              },
              undefined,
            );
            results.push({
              messageId: mid,
              ok: true,
              deliveredAt: deliveredAtIso,
            });
          } catch (err) {
            results.push({
              messageId: mid,
              ok: false,
              reason: (err as Error).message,
            });
          }
        } else {
          results.push({
            messageId: mid,
            ok: false,
            reason: 'no_sender_or_self',
          });
        }
      }

      client.emit('messages_received_ack', {
        ok: true,
        processed: results.length,
        results,
      });
    } catch (err) {
      this.logger.warn(
        `handleMessagesReceived failed: ${(err as Error).message}`,
      );
      client.emit('messages_received_ack', {
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody()
    data: CreateMessageDto & {
      conversationId?: string;
      participantIds?: string[];
    },
    @ConnectedSocket() client: AuthSocket,
  ) {
    const senderId = client.data.userId;
    if (typeof senderId !== 'string') {
      client.emit('error', 'Unauthenticated');
      return;
    }

    if (typeof data?.content !== 'string' || data.content.trim().length === 0) {
      client.emit('error', 'content required');
      return;
    }

    try {
      const saved = await this.chatService.createMessage({
        conversationId: data.conversationId,
        participantIds: data.participantIds,
        senderId,
        content: data.content,
        messageType: data.messageType,
      });

      const convId = saved.conversationId.toString();

      client.to(convId).emit('receive_message', saved);
      client.emit('message_sent', saved);

      const participants =
        await this.chatService.getConversationParticipants(convId);
      for (const pid of participants) {
        if (pid === senderId) continue;
        await this.notifyUser(pid, 'receive_message', saved, convId);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to send message from ${senderId}: ${(err as Error).message}`,
      );
      client.emit('error', (err as Error).message || 'send failed');
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { conversationId: string; isTyping: boolean },
    @ConnectedSocket() client: AuthSocket,
  ) {
    const senderId = client.data.userId;
    if (typeof senderId !== 'string') {
      client.emit('error', 'Unauthenticated');
      return;
    }

    const convId = data?.conversationId;
    if (typeof convId !== 'string') return;

    client.to(convId).emit('typing', {
      conversationId: convId,
      userId: senderId,
      isTyping: !!data.isTyping,
    });
  }
}
