import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthService, SafeUser } from './auth.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(dto, res);
  }

  @Post('login')
  @ApiOperation({ summary: 'Log in with email and password' })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Clear auth cookie and log out' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('boardman_token');
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiCookieAuth('boardman_token')
  @ApiOperation({ summary: 'Get the authenticated user' })
  getMe(@Req() req: Request & { user: User }) {
    return this.authService.getMe(req.user.id);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Redirect to Google OAuth' })
  googleAuth() {
    // Passport redirects automatically
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(
    @Req() req: Request & { user: SafeUser },
    @Res() res: Response,
  ) {
    const redirectUrl = await this.authService.handleGoogleCallback(
      req.user,
      res,
    );
    return res.redirect(redirectUrl);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address via token link' })
  @ApiQuery({ name: 'token', description: 'Email verification token' })
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    const { redirectUrl } = await this.authService.verifyEmail(token);
    return res.redirect(redirectUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete-profile')
  @ApiCookieAuth('boardman_token')
  @ApiOperation({ summary: 'Set username after Google OAuth sign-up' })
  completeProfile(
    @Req() req: Request & { user: User },
    @Body() dto: CompleteProfileDto,
  ) {
    return this.authService.completeProfile(req.user.id, dto);
  }
}
