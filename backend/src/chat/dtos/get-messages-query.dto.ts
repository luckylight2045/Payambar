import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Min } from 'class-validator';

export class GetMessagesQueryDto {
  @ApiPropertyOptional({
    description: 'maximum number of messages to return',
    example: 20,
    default: 20,
  })
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  limit = 20;

  @ApiPropertyOptional({
    description: 'number of messages to skip',
    example: 40,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) =>
    value !== undefined ? parseInt(value, 10) : undefined,
  )
  skip?: number;

  @ApiPropertyOptional({
    description:
      'Return messages created **before** this ISO timestamp (cursor pagination)',
    example: '2025-07-24T12:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'beforeDate must be a valid date (e.g., YYYY-MM-DD)' })
  beforeDate?: Date;
}
