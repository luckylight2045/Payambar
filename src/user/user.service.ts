import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schema/user.schema';
import { Model } from 'mongoose';
import { UserSignUpDto } from './dtos/user.signup.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private readonly user: Model<User>) {}

  async signup(body: UserSignUpDto) {
    const salt = await bcrypt.genSalt(1043);
    const hash = await bcrypt.hash(body.password, salt);

    const user = await this.user.create({
      userName: body.userName,
      password: hash,
      phoneNumber: body.phoneNumber,
    });

    return user;
  }

  async getUserByUserName(userName: string): Promise<User | null> {
    return await this.user.findOne({ userName }).exec();
  }

  async getAllUsers() {
    return await this.user.find().exec();
  }

  async findUserById(userId: string) {
    return await this.user.findById(userId).exec();
  }
}
