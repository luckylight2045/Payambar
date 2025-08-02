// src/users/dtos/update-user-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../schema/user.schema';

export class UserUpdateResponseSchema {
  @ApiProperty({ example: '6800bce813256ca391e4ee76' })
  _id: string;

  @ApiProperty({ example: 'magic' })
  userName: string;

  @ApiPropertyOptional({ example: '04335010559' })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'hesam@gmail.com' })
  email?: string;

  @ApiPropertyOptional({ example: 'Hesams' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'khedri' })
  lastName?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role: UserRole;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-04-17T08:33:44.257Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-04-17T09:15:22.123Z' })
  updatedAt: Date;
}
