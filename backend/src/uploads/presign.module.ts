import { Module } from '@nestjs/common';
import { PresignService } from './presign.service';
import { PresignController } from './presign.controller';

@Module({
  imports: [],
  providers: [PresignService],
  controllers: [PresignController],
})
export class PresignModule {}
