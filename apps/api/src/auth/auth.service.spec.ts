import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const baseUser = {
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  username: 'johndoe',
  password: 'hashed_pw',
  googleId: null as string | null,
  avatar: null as string | null,
  walletBalance: 0,
  isOnboarded: true,
  createdAt: new Date(),
};

const makeP2002 = (field: string) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '0.0.0',
    meta: { target: [field] },
  });

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwtService: { sign: jest.Mock };
  let mockRes: { cookie: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = { sign: jest.fn().mockReturnValue('mock_token') };
    mockRes = { cookie: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'NODE_ENV'
                ? 'test'
                : key === 'FRONTEND_URL'
                  ? 'http://localhost:3000'
                  : 'secret',
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = {
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
      email: 'john@example.com',
      password: 'password123',
    };

    it('creates the user, issues a token, and returns the user without password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(baseUser);
      mockBcrypt.hash.mockResolvedValue('hashed_pw' as never);

      const result = await service.register(dto, mockRes as any);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: dto.email,
            username: dto.username,
            isOnboarded: true,
          }),
        }),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'boardman_token',
        'mock_token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          secure: false,
        }),
      );
      expect(result).not.toHaveProperty('password');
    });

    it('hashes the password with salt rounds 10 before storing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(baseUser);
      mockBcrypt.hash.mockResolvedValue('hashed_pw' as never);

      await service.register(dto, mockRes as any);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      const createData = prisma.user.create.mock.calls[0][0].data;
      expect(createData.password).toBe('hashed_pw');
    });

    it('throws ConflictException when the email is already registered', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(baseUser) // email taken
        .mockResolvedValueOnce(null); // username free

      await expect(service.register(dto, mockRes as any)).rejects.toThrow(
        new ConflictException('Email already in use'),
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the username is already taken', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // email free
        .mockResolvedValueOnce(baseUser); // username taken

      await expect(service.register(dto, mockRes as any)).rejects.toThrow(
        new ConflictException('Username already taken'),
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException on email P2002 when two registrations race', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // both checks pass
      prisma.user.create.mockRejectedValue(makeP2002('email'));

      await expect(service.register(dto, mockRes as any)).rejects.toThrow(
        new ConflictException('Email already in use'),
      );
    });

    it('throws ConflictException on username P2002 when two registrations race', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(makeP2002('username'));

      await expect(service.register(dto, mockRes as any)).rejects.toThrow(
        new ConflictException('Username already taken'),
      );
    });

    it('re-throws unexpected DB errors from create', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const unexpected = new Error('connection lost');
      prisma.user.create.mockRejectedValue(unexpected);

      await expect(service.register(dto, mockRes as any)).rejects.toThrow(
        'connection lost',
      );
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'john@example.com', password: 'password123' };

    it('returns the user without password and sets a cookie on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login(dto, mockRes as any);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'boardman_token',
        'mock_token',
        expect.objectContaining({ httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 }),
      );
      expect(result).not.toHaveProperty('password');
    });

    it('throws UnauthorizedException when the user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto, mockRes as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException with Google message when user has no password', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, password: null });

      await expect(service.login(dto, mockRes as any)).rejects.toThrow(
        'This account uses Google sign-in',
      );
    });

    it('throws UnauthorizedException when password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.login(dto, mockRes as any)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });
  });

  // ─── findOrCreateGoogleUser ───────────────────────────────────────────────────

  describe('findOrCreateGoogleUser', () => {
    const profile = {
      googleId: 'google-123',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      avatar: 'https://avatar.url/photo.jpg',
    };

    it('returns the existing user without password when googleId matches', async () => {
      const googleUser = { ...baseUser, googleId: 'google-123' };
      prisma.user.findUnique.mockResolvedValueOnce(googleUser);

      const result = await service.findOrCreateGoogleUser(profile);

      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({ id: 'user-1', googleId: 'google-123' });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('attaches googleId to an existing email-registered account', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // no match by googleId
        .mockResolvedValueOnce(baseUser); // match by email
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        googleId: 'google-123',
      });

      const result = await service.findOrCreateGoogleUser(profile);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { googleId: 'google-123' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('password');
    });

    it('creates a new user with isOnboarded: false when no existing user is found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const newUser = {
        ...baseUser,
        googleId: 'google-123',
        isOnboarded: false,
        password: null,
        username: null,
      };
      prisma.user.create.mockResolvedValue(newUser);

      const result = await service.findOrCreateGoogleUser(profile);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          googleId: 'google-123',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          avatar: 'https://avatar.url/photo.jpg',
          isOnboarded: false,
          password: null,
          username: null,
        }),
      });
      expect(result.isOnboarded).toBe(false);
      expect(result).not.toHaveProperty('password');
    });
  });

  // ─── handleGoogleCallback ────────────────────────────────────────────────────

  describe('handleGoogleCallback', () => {
    it('issues a token and returns the dashboard URL when user is onboarded', async () => {
      const user = { ...baseUser, isOnboarded: true };

      const url = await service.handleGoogleCallback(user, mockRes as any);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'boardman_token',
        'mock_token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(url).toBe('http://localhost:3000/dashboard');
    });

    it('issues a token and returns the complete-profile URL when user is not onboarded', async () => {
      const user = { ...baseUser, isOnboarded: false, username: null };

      const url = await service.handleGoogleCallback(user, mockRes as any);

      expect(mockRes.cookie).toHaveBeenCalled();
      expect(url).toBe('http://localhost:3000/auth/complete-profile');
    });
  });

  // ─── completeProfile ─────────────────────────────────────────────────────────

  describe('completeProfile', () => {
    const dto = { username: 'new_handle' };

    it('sets username and isOnboarded: true, returns user without password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const updated = { ...baseUser, username: 'new_handle' };
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.completeProfile('user-1', dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { username: 'new_handle', isOnboarded: true },
      });
      expect(result).not.toHaveProperty('password');
    });

    it('throws ConflictException when the username is already taken', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(service.completeProfile('user-1', dto)).rejects.toThrow(
        new ConflictException('Username already taken'),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException on username P2002 when two requests race', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // check passes
      prisma.user.update.mockRejectedValue(makeP2002('username'));

      await expect(service.completeProfile('user-1', dto)).rejects.toThrow(
        new ConflictException('Username already taken'),
      );
    });

    it('re-throws unexpected DB errors from update', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.update.mockRejectedValue(new Error('connection lost'));

      await expect(service.completeProfile('user-1', dto)).rejects.toThrow(
        'connection lost',
      );
    });
  });

  // ─── getMe ───────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('fetches the user by id and returns them without password', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.getMe('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({
        id: 'user-1',
        email: 'john@example.com',
        isOnboarded: true,
      });
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('user-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
