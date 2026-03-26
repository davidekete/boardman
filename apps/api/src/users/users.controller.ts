import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { Request as ExpressRequest } from 'express';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiCookieAuth('boardman_token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search users by username (min 2 chars, max 5 results)' })
  @ApiQuery({ name: 'username', description: 'Partial username to search for' })
  async search(@Query('username') username: string, @Request() req: ExpressRequest & { user: User }) {
    if (!username || username.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }
    return this.usersService.searchByUsername(username, req.user.id);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get a user by exact username' })
  @ApiParam({ name: 'username', description: 'Exact username to look up' })
  async findOne(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }
}
