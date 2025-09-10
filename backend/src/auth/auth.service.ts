import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './interfaces/jwt.payload';

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

    return this.jwtSign(username, user._id.toString());
  }

  async jwtSign(username: string, userId: string) {
    const payload = {
      sub: userId,
      userName: username,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.config.get<string>('ACCESS_TOKEN_EXPIRE_TIME'),
      secret: this.config.get<string>('ACCESS_TOKEN_SECRET_KEY'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.config.get<string>('REFRESH_TOKEN_EXPIRE_TIME'),
      secret: this.config.get<string>('REFRESH_TOKEN_SECRET_KEY'),
    });

    await this.userService.storeRefreshToken(userId, refreshToken);

    return { access_token: accessToken, refresh_token: refreshToken };
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

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('refresh token is required');
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(
      refreshToken,
      {
        secret: this.config.get<string>('REFRESH_TOKEN_SECRET_KEY'),
      },
    );

    const user = await this.userService.getUserByUserName(payload.userName);

    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('unauthorized user');
    }

    const newAccessToken = await this.jwtService.signAsync(
      {
        userName: user.name,
      },
      {
        expiresIn: this.config.get<string>('ACCESS_TOKEN_EXPIRE_TIME'),
        secret: this.config.get<string>('ACCESS_TOKEN_SECRET_KEY'),
      },
    );

    const newRefreshToken = await this.jwtService.signAsync(
      { userName: user.name },
      {
        expiresIn: this.config.get<string>('REFRESH_TOKEN_EXPIRE_TIME') || '7d',
        secret: this.config.get<string>('REFRESH_SECRET_KEY'),
      },
    );

    await this.userService.storeRefreshToken(
      user._id.toString(),
      newRefreshToken,
    );

    return { access_token: newAccessToken, refresh_token: newRefreshToken };
  }
}
