import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(dto, res);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('boardman_token');
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: Request & { user: User }) {
    return this.authService.getMe(req.user.id);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport redirects automatically
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request & { user: User },
    @Res() res: Response,
  ) {
    const user = req.user;
    this.authService.issueToken(user, res);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (!user.isOnboarded) {
      return res.redirect(`${frontendUrl}/auth/complete-profile`);
    }
    return res.redirect(`${frontendUrl}/dashboard`);
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete-profile')
  completeProfile(
    @Req() req: Request & { user: User },
    @Body() dto: CompleteProfileDto,
  ) {
    return this.authService.completeProfile(req.user.id, dto);
  }
}
