import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  async search(@Query('username') username: string, @Request() req) {
    if (!username || username.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }
    return this.usersService.searchByUsername(username, req.user.id);
  }

  @Get(':username')
  async findOne(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }
}
