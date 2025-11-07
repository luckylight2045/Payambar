import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schema/user.schema';
import { Model, Types } from 'mongoose';
import { UserSignUpDto } from './dtos/user.signup.dto';
import * as bcrypt from 'bcrypt';
import { UserUpdateDto } from './dtos/user.update.dto';
import { SafeUser } from 'src/interfaces/safe.user.interface';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { UserWithPresence } from './types/user.presence.types';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly user: Model<User>,
    @InjectRedis() private readonly ioredis: Redis,
  ) {}

  async signup(body: UserSignUpDto) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(body.password, salt);

    if (await this.getUserByUserName(body.name)) {
      throw new BadRequestException('userName is already taken');
    }

    if (await this.getUserByPhoneNumber(body.phoneNumber)) {
      throw new BadRequestException('phoneNumber  is already taken');
    }

    const user = await this.user.create({ ...body, password: hash });
    const obj = user.toObject() as unknown as SafeUser;
    delete obj.password;
    delete obj.__v;
    return obj;
  }

  async getUserByUserName(name: string) {
    return await this.user.findOne({ name }).exec();
  }

  async getAllUsers() {
    return await this.user.find({}, { password: 0 }).exec();
  }

  async getUserById(userId: string): Promise<UserWithPresence | null> {
    const userDoc = await this.user.findById(userId).lean().exec();
    if (!userDoc) return null;

    const onlineCount = await this.ioredis
      .scard(`online:${userId}`)
      .catch(() => 0);
    const online = Number(onlineCount) > 0;
    const lastSeenAt = online
      ? null
      : ((await this.ioredis.get(`last_seen:${userId}`).catch(() => null)) ??
        null);

    return {
      ...userDoc,
      _id: userDoc._id.toString(),
      online,
      lastSeenAt,
    };
  }

  async getUserByPhoneNumber(phoneNumber: string) {
    return await this.user.findOne({ phoneNumber }).exec();
  }

  async getUserByEmail(email: string) {
    return await this.user.findOne({ email });
  }

  async storeRefreshToken(userId: string, refreshToken: string) {
    await this.user.findByIdAndUpdate(userId, { refreshToken }).exec();
  }

  async logout(userId: string) {
    await this.user.findByIdAndUpdate(userId, { refreshToken: null }).exec();
  }

  async updateUser(user: User, body: UserUpdateDto) {
    if (
      body.name &&
      body.name != user.name &&
      (await this.getUserByUserName(body.name))
    ) {
      throw new BadRequestException('userName is already taken');
    }

    if (
      body.phoneNumber &&
      body.phoneNumber != user.phoneNumber &&
      (await this.getUserByPhoneNumber(body.phoneNumber))
    ) {
      throw new BadRequestException('phoneNumber is already taken');
    }

    if (
      body.email &&
      body.email != user.email &&
      (await this.getUserByEmail(body.email))
    ) {
      throw new BadRequestException('email is already taken');
    }

    let hash;
    if (body.password) {
      const salt = await bcrypt.genSalt(10);
      hash = await bcrypt.hash(body.password, salt);
    }

    const userDoc = await this.user
      .findOneAndUpdate(
        { name: user.name },
        { ...body, password: body.password ? hash : user.password },
        {
          new: true,
          select: '-password',
        },
      )
      .exec();

    if (!userDoc) {
      throw new NotFoundException(`User ${user.name} not found`);
    }

    const obj = userDoc.toObject() as unknown as SafeUser;
    delete obj.password;
    delete obj.__v;
    return obj;
  }

  async deleteUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid UserId');
    }
    const objectId = new Types.ObjectId(userId);

    if (!(await this.getUserById(userId))) {
      throw new NotFoundException('user is not found');
    }

    await this.user.deleteOne({ _id: objectId });
  }

  async searchByPrefix(term: string, limit = 50) {
    if (!term || term.trim().length === 0) {
      return [];
    }

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const q = escapeRegex(term.trim());
    const regex = new RegExp('^' + q, 'i');

    return await this.user
      .find({ $or: [{ name: regex }] })
      .select('_id name')
      .limit(limit)
      .lean()
      .exec();
  }

  async blockUser(userId: string, blockUserId: string) {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new NotFoundException('user not found');
    }

    const blockUser = await this.getUserById(blockUserId);

    if (!blockUser) {
      throw new NotFoundException('target block user not found');
    }

    const res = await this.user
      .updateOne(
        {
          _id: userId,
        },
        {
          $addToSet: { blockedUsers: new Types.ObjectId(blockUserId) },
        },
      )
      .exec();

    if (!res) {
      throw new NotFoundException('user not found');
    }

    try {
      await this.ioredis.sadd(`blocked:${userId}`, blockUserId);
    } catch (err) {
      throw new InternalServerErrorException(err);
    }

    return { ok: true };
  }

  async unblockUser(userId: string, unblockUserId: string) {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new NotFoundException('user not found');
    }

    const unblockedUser = await this.getUserById(unblockUserId);

    if (!unblockedUser) {
      throw new NotFoundException('target unblock user not found');
    }

    const oid = Types.ObjectId.isValid(unblockUserId)
      ? new Types.ObjectId(unblockUserId)
      : unblockUserId;
    const res = await this.user
      .updateOne(
        {
          _id: Types.ObjectId.isValid(userId)
            ? new Types.ObjectId(userId)
            : userId,
        },
        { $pull: { blockedUsers: oid } },
      )
      .exec();

    if (!res) {
      throw new NotFoundException('user not found');
    }

    try {
      await this.ioredis.srem(`blocked:${userId}`, String(unblockUserId));
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
    return { ok: true };
  }

  async getBlockedUsers(userId: string) {
    const user = await this.user
      .findById(userId)
      .select('blockedUsers')
      .lean()
      .exec();

    return (user?.blockedUsers || []).map(String);
  }

  async isBlockedBy(
    targetId: string,
    maybeBlockedId: string,
  ): Promise<boolean> {
    if (!targetId || !maybeBlockedId) return false;
    const queryTarget = Types.ObjectId.isValid(targetId)
      ? new Types.ObjectId(targetId)
      : targetId;
    const queryBlocked = Types.ObjectId.isValid(maybeBlockedId)
      ? new Types.ObjectId(maybeBlockedId)
      : maybeBlockedId;
    const res = await this.user
      .findOne({ _id: queryTarget, blockedUsers: queryBlocked })
      .select('_id')
      .lean()
      .exec();
    return !!res;
  }

  async blockStatus(userId: string, otherUserId: string) {
    const myBlockedLIst = await this.getBlockedUsers(userId);

    const blockedByMe = myBlockedLIst.includes(otherUserId);
    const blockedByThem = await this.isBlockedBy(otherUserId, userId);

    return { blockedByMe, blockedByThem };
  }
}
