import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt } from 'passport-jwt';
import { Strategy } from 'passport-jwt';
import { User } from 'src/user/schema/user.schema';
import { UserService } from 'src/user/user.service';

interface Payload {
  userName: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.ACCESS_TOKEN_SECRET_KEY || 'life',
    });
  }

  async validate(payload: Payload): Promise<User> {
    const user = await this.userService.getUserByUserName(payload.userName);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
