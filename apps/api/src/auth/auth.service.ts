import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Response } from 'express';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export type SafeUser = Omit<
  User,
  'password' | 'verificationToken' | 'verificationTokenExpiresAt'
>;

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days — matches JWT expiry
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto, res: Response): Promise<SafeUser> {
    const [emailTaken, usernameTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.user.findUnique({ where: { username: dto.username } }),
    ]);

    if (emailTaken) throw new ConflictException('Email already in use');
    if (usernameTaken) throw new ConflictException('Username already taken');

    const [hashedPassword, verificationToken] = await Promise.all([
      bcrypt.hash(dto.password, 10),
      Promise.resolve(crypto.randomBytes(32).toString('hex')),
    ]);

    try {
      const user = await this.prisma.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          username: dto.username,
          email: dto.email,
          password: hashedPassword,
          isOnboarded: true,
          verificationToken,
          verificationTokenExpiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
        },
      });

      // Fire-and-forget — don't block the response on email delivery
      this.mail
        .sendVerificationEmail(user.email, user.firstName, verificationToken)
        .catch((err) =>
          this.logger.error('Verification email failed after register', err),
        );

      this.issueToken(user, res);
      return this.sanitize(user);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const field = (e.meta?.target as string[])?.[0];
        if (field === 'email') throw new ConflictException('Email already in use');
        throw new ConflictException('Username already taken');
      }
      throw e;
    }
  }

  async login(dto: LoginDto, res: Response): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.password) {
      throw new UnauthorizedException('This account uses Google sign-in');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    this.issueToken(user, res);
    return this.sanitize(user);
  }

  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar: string;
  }): Promise<SafeUser> {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (user) return this.sanitize(user);

    user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId },
      });
      return this.sanitize(user);
    }

    // New Google user — email is implicitly verified by Google
    user = await this.prisma.user.create({
      data: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        googleId: profile.googleId,
        avatar: profile.avatar,
        isOnboarded: false,
        emailVerified: true,
        password: null,
        username: null,
      },
    });

    return this.sanitize(user);
  }

  async handleGoogleCallback(user: SafeUser, res: Response): Promise<string> {
    this.issueToken(user, res);
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    return user.isOnboarded
      ? `${frontendUrl}/dashboard`
      : `${frontendUrl}/auth/complete-profile`;
  }

  async verifyEmail(
    token: string,
  ): Promise<{ redirectUrl: string }> {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const user = await this.prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification link');
    }

    if (user.emailVerified) {
      return { redirectUrl: `${frontendUrl}/dashboard` };
    }

    if (
      !user.verificationTokenExpiresAt ||
      user.verificationTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Verification link has expired');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });

    return { redirectUrl: `${frontendUrl}/auth/verified` };
  }

  async completeProfile(
    userId: string,
    dto: CompleteProfileDto,
  ): Promise<SafeUser> {
    const usernameTaken = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (usernameTaken) throw new ConflictException('Username already taken');

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { username: dto.username, isOnboarded: true },
      });

      return this.sanitize(user);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Username already taken');
      }
      throw e;
    }
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  private issueToken(user: SafeUser, res: Response): void {
    const token = this.jwt.sign({ sub: user.id, username: user.username });

    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie('boardman_token', token, {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      maxAge: COOKIE_MAX_AGE,
    });
  }

  private sanitize(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, verificationToken: _vt, verificationTokenExpiresAt: _vtea, ...safe } = user;
    return safe;
  }
}
