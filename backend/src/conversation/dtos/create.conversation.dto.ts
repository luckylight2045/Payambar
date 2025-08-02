import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ConversationType } from '../schema/conversation.schema';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ enum: ConversationType })
  @IsEnum(ConversationType)
  type: ConversationType;

  @ApiPropertyOptional({
    description: 'Group Name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    type: [String],
    description: 'exactly the users in the conversation',
    example: ['fdij...', 'jfkdj...3..'],
  })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  participants: string[];
}
