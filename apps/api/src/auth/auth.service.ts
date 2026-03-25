import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, res: Response): Promise<SafeUser> {
    const [emailTaken, usernameTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.user.findUnique({ where: { username: dto.username } }),
    ]);

    if (emailTaken) throw new ConflictException('Email already in use');
    if (usernameTaken) throw new ConflictException('Username already taken');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        isOnboarded: true,
      },
    });

    this.issueToken(user, res);
    return this.sanitize(user);
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
  }): Promise<User> {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (user) return user;

    user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId },
      });
      return user;
    }

    user = await this.prisma.user.create({
      data: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        googleId: profile.googleId,
        avatar: profile.avatar,
        isOnboarded: false,
        password: null,
        username: null,
      },
    });

    return user;
  }

  async completeProfile(
    userId: string,
    dto: CompleteProfileDto,
  ): Promise<SafeUser> {
    const usernameTaken = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (usernameTaken) throw new ConflictException('Username already taken');

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { username: dto.username, isOnboarded: true },
    });

    return this.sanitize(user);
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  issueToken(user: User, res: Response): void {
    const token = this.jwt.sign({ sub: user.id, username: user.username });

    res.cookie('boardman_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
    });
  }

  private sanitize(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...safe } = user;
    return safe;
  }
}
