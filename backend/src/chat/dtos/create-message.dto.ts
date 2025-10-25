import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { MessageType } from 'src/message/schema/message.schema';

export class CreateMessageDto {
  @ApiPropertyOptional({ example: 'hello' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ enum: MessageType })
  @IsEnum(MessageType)
  @IsOptional()
  messageType?: MessageType;

  @IsOptional()
  @IsMongoId()
  replyTo?: string;

  @IsOptional()
  @IsString()
  publicUrl?: string;

  @IsOptional()
  @IsString()
  attachMentKey?: string;

  @IsOptional()
  @IsString()
  originalName?: string;
}
