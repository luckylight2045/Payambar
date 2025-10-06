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
import { ConversationService } from 'src/conversation/conversation.service';

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
    private readonly conversationService: ConversationService,
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
        await this.ioredis.del(`last_seen:${userId}`);
      } catch (err) {
        this.logger.warn(
          `Failed to clear last_seen for ${userId}: ${(err as Error).message}`,
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
          await this.ioredis.set(
            `last_seen:${userId}`,
            new Date().toISOString(),
          );
        } catch (err) {
          this.logger.warn(
            `Failed to set last_seen for ${userId}: ${(err as Error).message}`,
          );
        }
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
      conversationId: string;
      upToMessageId?: string;
    },
    @ConnectedSocket() client: AuthSocket,
  ) {
    const senderSocketId = client.id;
    let recipientId: string | null = null;
    if (client?.data && typeof client.data.userId === 'string') {
      recipientId = String(client.data.userId);
    } else if (senderSocketId) {
      const maybe = await this.ioredis
        .get(`socket:${senderSocketId}`)
        .catch(() => null);
      if (typeof maybe === 'string' && maybe.length > 0) recipientId = maybe;
    }

    if (!recipientId) {
      client.emit('error', 'Unauthenticated');
      return;
    }

    if (!data || typeof data.conversationId !== 'string') {
      client.emit('error', 'conversationId required');
      return;
    }

    const conv = await this.conversationService.getConversationById(
      data.conversationId,
    );
    if (!conv) {
      client.emit('error', 'conversation not found');
      return;
    }

    try {
      if (Array.isArray(data.messageIds) && data.messageIds.length > 0) {
        await this.messageService.markAsDelivered({
          recipientId,
          messageIds: data.messageIds.map((id) => String(id)),
          conversationId: data.conversationId,
        });
        const deliveredAt = new Date().toISOString();
        for (const mid of data.messageIds) {
          this.server.to(data.conversationId).emit('message_delivered', {
            messageId: mid,
            conversationId: data.conversationId,
            recipientId,
            deliveredAt,
          });
        }
        return { ok: true };
      }

      if (typeof data.messageId === 'string' && data.messageId) {
        await this.messageService.markAsDelivered({
          recipientId,
          messageId: data.messageId,
          conversationId: data.conversationId,
        });
        const deliveredAt = new Date().toISOString();
        this.server.to(data.conversationId).emit('message_delivered', {
          messageId: data.messageId,
          conversationId: data.conversationId,
          recipientId,
          deliveredAt,
        });
        return { ok: true };
      }

      if (typeof data.upToMessageId === 'string' && data.upToMessageId) {
        const res = await this.messageService.markAsDelivered({
          recipientId,
          conversationId: data.conversationId,
          upToMessageId: data.upToMessageId,
        });
        const deliveredAt = new Date().toISOString();
        this.server.to(data.conversationId).emit('messages_delivered', {
          conversationId: data.conversationId,
          upToMessageId: data.upToMessageId,
          recipientId,
          deliveredAt,
          matchedCount: res?.matchedCount ?? 0,
          modifiedCount: res?.modifiedCount ?? 0,
        });
        return { ok: true };
      }

      client.emit('error', 'No messageId/messageIds or upToMessageId provided');
    } catch (err) {
      client.emit('error', String((err as Error).message ?? err));
      throw err;
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
    let recipientIds: string[] = [];
    let origParticipantIds: string[] | null = null;
    if (Array.isArray(data.participantIds) && data.participantIds.length > 0) {
      origParticipantIds = data.participantIds.map(String);
      recipientIds = origParticipantIds.filter((id) => id !== String(senderId));
    } else if (typeof data.conversationId === 'string' && data.conversationId) {
      const participants = await this.chatService.getConversationParticipants(
        data.conversationId,
      );
      recipientIds = (participants || [])
        .map(String)
        .filter((id) => id !== String(senderId));
    } else {
      client.emit('error', 'No recipient(s) specified');
      return;
    }
    const blockedRecipients: string[] = [];
    const allowedRecipients: string[] = [];
    if (recipientIds.length > 0) {
      let usedRedis = true;
      try {
        const pipe = this.ioredis.pipeline();
        for (const rid of recipientIds) {
          pipe.sismember(`blocked:${rid}`, String(senderId));
          pipe.sismember(`blocked:${senderId}`, String(rid));
        }
        const results = await pipe.exec();
        if (!results) usedRedis = false;
        else {
          for (let i = 0; i < recipientIds.length; i++) {
            const a = results[i * 2];
            const b = results[i * 2 + 1];
            if (!a || !b) {
              usedRedis = false;
              break;
            }
            const aErr = a[0];
            const aVal = a[1];
            const bErr = b[0];
            const bVal = b[1];
            if (aErr || bErr) {
              usedRedis = false;
              break;
            }
            const recipientBlockedSender = aVal === 1;
            const senderBlockedRecipient = bVal === 1;
            if (recipientBlockedSender || senderBlockedRecipient)
              blockedRecipients.push(recipientIds[i]);
            else allowedRecipients.push(recipientIds[i]);
          }
        }
      } catch (e) {
        console.log(e);
        usedRedis = false;
      }
      if (!usedRedis) {
        blockedRecipients.length = 0;
        allowedRecipients.length = 0;
        for (const rid of recipientIds) {
          const recipientBlockedSender = await this.userService.isBlockedBy(
            rid,
            senderId,
          );
          const senderBlockedRecipient = await this.userService.isBlockedBy(
            senderId,
            rid,
          );
          if (recipientBlockedSender || senderBlockedRecipient)
            blockedRecipients.push(rid);
          else allowedRecipients.push(rid);
        }
      }
    }
    if (recipientIds.length > 0 && allowedRecipients.length === 0) {
      client.emit('error', 'All recipients blocked');
      return;
    }
    if (blockedRecipients.length > 0) {
      client.emit('error', 'Recipient blocked');
      return;
    }
    type SavedMessageLike = {
      conversationId?: string | { toString(): string };
      conversation?: { _id?: string | { toString(): string } } | null;
      _id?: string | { toString(): string };
    } & Record<string, unknown>;
    try {
      let savedMessageRaw: unknown;
      if (data.conversationId) {
        savedMessageRaw = await this.chatService.createMessage({
          messageType: data.messageType,
          content: data.content,
          senderId,
          conversationId: data.conversationId,
        });
      } else {
        const participantIdsToCreate =
          origParticipantIds && origParticipantIds.length > 0
            ? origParticipantIds.map(String)
            : [String(senderId)];
        savedMessageRaw = await this.chatService.createMessage({
          messageType: data.messageType,
          content: data.content,
          senderId,
          participantIds: participantIdsToCreate,
        });
      }
      const savedMessage = savedMessageRaw as SavedMessageLike;
      let convField: string | { toString(): string } | undefined;
      if (savedMessage.conversationId) convField = savedMessage.conversationId;
      else if (savedMessage.conversation && savedMessage.conversation._id)
        convField = savedMessage.conversation._id;
      else if (savedMessage._id) convField = savedMessage._id;
      const convId = String(
        typeof convField === 'object'
          ? convField.toString()
          : (convField ?? ''),
      );
      if (convId) {
        this.server.to(convId).emit('message_sent', savedMessage);
        this.server.emit('message_event', {
          conversationId: convId,
          message: savedMessage,
        });
      } else {
        client.emit('error', 'Failed to determine conversation id');
      }
      return savedMessageRaw;
    } catch (err) {
      client.emit('error', 'Failed to send message ' + err);
      return;
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
