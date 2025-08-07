import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import Redis from 'ioredis';

@Module({
  imports: [],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new Redis('process.env.REDIS_URL'),
    },
    OtpService,
  ],
})
export class OtpModule {}
