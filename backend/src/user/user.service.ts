import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schema/user.schema';
import { Model, Types } from 'mongoose';
import { UserSignUpDto } from './dtos/user.signup.dto';
import * as bcrypt from 'bcrypt';
import { UserUpdateDto } from './dtos/user.update.dto';
import { SafeUser } from 'src/interfaces/safe.user.interface';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private readonly user: Model<User>) {}

  async signup(body: UserSignUpDto) {
    const salt = await bcrypt.genSalt(1043);
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

  async getUserById(userId: string) {
    return await this.user.findById(userId).exec();
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
      const salt = await bcrypt.genSalt(1043);
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
}
