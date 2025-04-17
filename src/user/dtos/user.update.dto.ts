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

  @ApiProperty({
    required: false,
    description: 'New phone number',
    example: '09335910559',
  })
  @IsString()
  @IsOptional()
  phoneNumber: string;

  @ApiProperty({
    required: false,
    description: 'New password',
    example: 'password',
  })
  @IsString()
  @IsOptional()
  password: string;

  @ApiProperty({
    required: false,
    description: 'New firstName',
    example: 'hesam',
  })
  @IsString()
  @IsOptional()
  firstName: string;

  @ApiProperty({
    required: false,
    description: 'New lastName',
    example: 'khedri',
  })
  @IsString()
  @IsOptional()
  lastName: string;

  @ApiProperty({
    required: false,
    description: 'New email',
    example: 'hesam@gmail.com',
  })
  @IsString()
  @IsOptional()
  email: string;
}
