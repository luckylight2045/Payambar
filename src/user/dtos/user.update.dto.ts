import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UserUpdateDto {
  @ApiProperty({
    required: false,
    description: 'New userName',
    example: 'john',
  })
  @IsString()
  @IsOptional()
  userName: string;

  @ApiProperty({ required: false, description: 'New phone number' })
  @IsString()
  @IsOptional()
  phoneNumber: string;

  @ApiProperty({ required: false, description: 'New password' })
  @IsString()
  @IsOptional()
  password: string;

  @ApiProperty({ required: false, description: 'New firstName' })
  @IsString()
  @IsOptional()
  firstName: string;

  @ApiProperty({ required: false, description: 'New lastName' })
  @IsString()
  @IsOptional()
  lastName: string;

  @ApiProperty({ required: false, description: 'New email' })
  @IsString()
  @IsOptional()
  email: string;
}
