import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateRefreshTokenDto } from './dtos/create.refresh.token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('refresh')
  async refreshToken(@Body() body: CreateRefreshTokenDto) {
    return this.authService.refreshToken(body.refreshToken);
  }
}
