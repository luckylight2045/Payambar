import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { UserService } from './user.service';
import { UserSignUpDto } from './dtos/user.signup.dto';
import { UserLoginDto } from './dtos/user.login.dto';
import { ApiBearerAuth, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { User, UserRole } from './schema/user.schema';
import { RolesGuard } from 'src/auth/roles.guard';
import { UserUpdateDto } from './dtos/user.update.dto';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { UserLoginResponseSchema } from 'src/auth/response/user.login.response.schema';
import { UserSignUpResponseSchema } from './response/user.signup.response.schema';
import { UserUpdateResponseSchema } from './response/user.update.response.schema';
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @ApiOkResponse({
    description: 'Returns user',
    type: UserSignUpResponseSchema,
  })
  @Post('signup')
  async signup(@Body() userSignUpDto: UserSignUpDto) {
    return this.userService.signup(userSignUpDto);
  }

  @ApiOkResponse({
    description: 'Returns a JWT access token',
    type: UserLoginResponseSchema,
  })
  @Post('login')
  async login(@Body() userSignInDto: UserLoginDto) {
    return this.authService.validateUser(
      userSignInDto.userName,
      userSignInDto.password,
    );
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('')
  async getAllUsers() {
    return this.userService.getAllUsers();
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'The updated user (password omitted)',
    type: UserUpdateResponseSchema,
  })
  @Patch('update')
  async updateUser(@CurrentUser() user: User, @Body() body: UserUpdateDto) {
    return await this.userService.updateUser(user, body);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiParam({
    name: 'id',
    description: 'The MongoDB ObjectId of the user to update',
    type: String,
  })
  @Delete('delete/:id')
  async deleteUser(@Param('id') id: string) {
    await this.userService.deleteUser(id);
  }
}
