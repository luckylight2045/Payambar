import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { HydratedDocument } from 'mongoose';
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

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async searchUsers(@Query('q') q: string) {
    return this.userService.searchByPrefix(q);
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
    return await this.userService.deleteUser(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserById(@Param('id') userId: string) {
    return this.userService.getUserById(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('blocked/:id')
  async blockUser(
    @Param('id') blockedUserId: string,
    @CurrentUser() user: HydratedDocument<User>,
  ) {
    return await this.userService.blockUser(user._id.toString(), blockedUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('block/:id')
  async unblockUser(
    @Param('id') blockedUserId: string,
    @CurrentUser() user: HydratedDocument<User>,
  ) {
    return await this.userService.unblockUser(
      user._id.toString(),
      blockedUserId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('blocked')
  async listBlocked(@CurrentUser() user: HydratedDocument<User>) {
    return await this.userService.getBlockedUsers(user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Get('block/status/:id')
  async blockedStatus(
    @CurrentUser() user: HydratedDocument<User>,
    @Param('id') otherUserId: string,
  ) {
    return await this.userService.blockStatus(user._id.toString(), otherUserId);
  }
}
