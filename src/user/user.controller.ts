import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { UserService } from './user.service';
import { UserSignUpDto } from './dtos/user.signup.dto';
import { UserLoginDto } from './dtos/user.login.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/auth.guard';
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Post('signup')
  async signup(@Body() userSignUpDto: UserSignUpDto) {
    return this.userService.signup(userSignUpDto);
  }

  @Post('login')
  async login(@Body() userSignInDto: UserLoginDto) {
    return this.authService.validateUser(
      userSignInDto.userName,
      userSignInDto.password,
    );
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('')
  async getAllUsers() {
    return this.userService.getAllUsers();
  }
}
