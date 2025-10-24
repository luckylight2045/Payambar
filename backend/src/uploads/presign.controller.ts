import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { PresignService } from './presign.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('uploads')
export class PresignController {
  constructor(private presignService: PresignService) {}

  @Post('presign')
  async presign(@Body() body: { filename: string; contentType: string }) {
    const { filename, contentType } = body || {};
    if (!filename || !contentType)
      throw new BadRequestException('filename and contentType required');
    const res = await this.presignService.createPresignedPutUrl(
      filename,
      contentType,
      120,
    );
    return res;
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 40 * 1024 * 1024 },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file required');

    const res = await this.presignService.uploadBuffer(
      file.originalname,
      file.buffer,
      file.mimetype,
    );
    return res;
  }
}
