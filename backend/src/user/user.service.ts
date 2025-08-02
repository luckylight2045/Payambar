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

    if (await this.getUserByUserName(body.userName)) {
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

  async getUserByUserName(userName: string): Promise<User | null> {
    return await this.user.findOne({ userName }).exec();
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

  async updateUser(user: User, body: UserUpdateDto) {
    if (
      body.userName &&
      body.userName != user.userName &&
      (await this.getUserByUserName(body.userName))
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
        { userName: user.userName },
        { ...body, password: body.password ? hash : user.password },
        {
          new: true,
          select: '-password',
        },
      )
      .exec();

    if (!userDoc) {
      throw new NotFoundException(`User ${user.userName} not found`);
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
}
