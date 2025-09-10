import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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
}
