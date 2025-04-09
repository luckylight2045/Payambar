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
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, {
    message:
      'phoneNumber must be exactly 11 digits long and contain only numbers',
  })
  phoneNumber: string;

  @ApiProperty()
  @IsEnum(UserRole)
  @IsOptional()
  role: UserRole;
}
