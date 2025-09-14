import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { UserRole } from '../schema/user.schema';

export class UserSignUpDto {
  @ApiProperty({ example: 'john', description: 'unique userName' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'password', description: 'any password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: '09335910559',
    description: 'phoneNumber should be 11 numbers ',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, {
    message:
      'phoneNumber must be exactly 11 digits long and contain only numbers',
  })
  phoneNumber: string;

  @ApiProperty({ example: 'user', description: 'should be user or adminI' })
  @IsEnum(UserRole)
  @IsOptional()
  role: UserRole;
}
