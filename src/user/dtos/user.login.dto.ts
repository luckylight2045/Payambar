import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UserLoginDto {
  @ApiProperty({
    example: 'john',
    description: 'should be userName you signed up',
  })
  @IsString()
  @IsNotEmpty()
  userName: string;

  @ApiProperty({
    example: 'password',
    description: 'should be the password you signed up with',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
