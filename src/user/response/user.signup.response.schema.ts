import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserSignUpResponseSchema {
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

  @ApiProperty({ example: 'user' })
  role: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-04-17T08:33:44.257Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-04-17T08:33:44.257Z' })
  updatedAt: Date;
}
