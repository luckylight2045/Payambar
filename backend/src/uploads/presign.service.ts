import {
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PresignService {
  private s3: S3Client;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('ARVAN_ENDPOINT')!;
    const accessKeyId = this.configService.get<string>('ARVAN_ACCESS_KEY')!;
    const secretAccessKey = this.configService.get<string>('ARVAN_SECRET_KEY')!;
    const region = this.configService.get<string>('ARVAN_REGION') ?? 'auto';

    this.s3 = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: false,
    });
  }

  async createPresignedPutUrl(
    filename: string,
    contentType: string,
    expiresIn: 120,
  ) {
    const Key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;
    const cmd = new PutObjectCommand({
      Bucket: this.configService.get<string>('ARVAN_BUCKET_NAME')!,
      Key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3, cmd, { expiresIn });
    const publicUrl = `${this.configService.get<string>('ARVAN_ENDPOINT')}/${this.configService.get<string>('ARVAN_BUCKET_NAME')}/${Key}`;
    return { url, key: Key, publicUrl };
  }

  async uploadBuffer(filename: string, buffer: Buffer, contentType: string) {
    const Key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;
    const Bucket = this.configService.get<string>('ARVAN_BUCKET_NAME')!;
    const params = {
      Bucket,
      Key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read' as ObjectCannedACL,
    };

    await this.s3.send(new PutObjectCommand(params));

    const publicUrl = `${this.configService.get<string>('ARVAN_ENDPOINT')}/${Bucket}/${Key}`;
    return { key: Key, publicUrl };
  }
}
