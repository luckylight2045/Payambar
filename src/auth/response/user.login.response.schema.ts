import { ApiProperty } from '@nestjs/swagger';

export class UserLoginResponseSchema {
  @ApiProperty({ example: 'uehfdsfj...' })
  access_token: string;
}
