import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class OtpService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async generateOtp(phoneNumber: string) {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redis.set(`otp:${phoneNumber}`, otpCode);
    console.log(`otp for ${phoneNumber}:${otpCode}`);
    return otpCode;
  }

  async verifyOtp(phoneNumber: string, code: string) {
    const otpCode = await this.redis.get(`otp:${phoneNumber}`);
    if (otpCode !== code) {
      throw new Error('invalid otp');
    }
    await this.redis.del(`otp:${phoneNumber}`);
    return true;
  }
}
