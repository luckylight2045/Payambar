import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.userService.getUserByUserName(username);

    if (!user) {
      throw new UnauthorizedException();
    }

    const validatePass = await bcrypt.compare(password, user.password);

    if (!validatePass) {
      throw new BadRequestException('password is wrong');
    }

    return this.jwtSign(username, password);
  }

  async jwtSign(username: string, password: string) {
    const payload = {
      userName: username,
      password: password,
    };

    const signToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.config.get<string>('EXPIRE_TIME'),
      secret: this.config.get<string>('SECRET_KEY'),
    });

    return { access_token: signToken };
  }

  async validationUser(username: string, password: string) {
    const user = await this.userService.getUserByUserName(username);

    if (!user) {
      return null;
    }

    const verifiedUser = await bcrypt.compare(user.password, password);

    if (!verifiedUser) {
      return null;
    }

    return user;
  }
}
