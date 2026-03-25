import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const safeUser = {
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  username: 'johndoe',
  googleId: null as string | null,
  avatar: null as string | null,
  walletBalance: 0,
  isOnboarded: true,
  emailVerified: false,
  createdAt: new Date(),
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let mockRes: { cookie: jest.Mock; clearCookie: jest.Mock; redirect: jest.Mock };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      getMe: jest.fn(),
      completeProfile: jest.fn(),
      handleGoogleCallback: jest.fn(),
      findOrCreateGoogleUser: jest.fn(),
    } as any;

    mockRes = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── register ────────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('delegates to authService.register and returns the result', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        email: 'john@example.com',
        password: 'password123',
      };
      authService.register.mockResolvedValue(safeUser);

      const result = await controller.register(dto, mockRes as any);

      expect(authService.register).toHaveBeenCalledWith(dto, mockRes);
      expect(result).toEqual(safeUser);
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('delegates to authService.login and returns the result', async () => {
      const dto = { email: 'john@example.com', password: 'password123' };
      authService.login.mockResolvedValue(safeUser);

      const result = await controller.login(dto, mockRes as any);

      expect(authService.login).toHaveBeenCalledWith(dto, mockRes);
      expect(result).toEqual(safeUser);
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('clears the boardman_token cookie', () => {
      controller.logout(mockRes as any);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('boardman_token');
    });

    it('returns a logged-out confirmation message', () => {
      const result = controller.logout(mockRes as any);

      expect(result).toEqual({ message: 'Logged out' });
    });
  });

  // ─── getMe ───────────────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('passes the user id from the request to authService.getMe', async () => {
      const req = { user: safeUser } as any;
      authService.getMe.mockResolvedValue(safeUser);

      const result = await controller.getMe(req);

      expect(authService.getMe).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(safeUser);
    });

    it('is protected by JwtAuthGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        AuthController.prototype.getMe,
      );
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  // ─── completeProfile ─────────────────────────────────────────────────────────

  describe('POST /auth/complete-profile', () => {
    it('passes the user id and dto to authService.completeProfile', async () => {
      const req = { user: safeUser } as any;
      const dto = { username: 'new_handle' };
      const updated = { ...safeUser, username: 'new_handle' };
      authService.completeProfile.mockResolvedValue(updated);

      const result = await controller.completeProfile(req, dto);

      expect(authService.completeProfile).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(updated);
    });

    it('is protected by JwtAuthGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        AuthController.prototype.completeProfile,
      );
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  // ─── google callback ─────────────────────────────────────────────────────────

  describe('GET /auth/google/callback', () => {
    it('delegates to handleGoogleCallback and redirects to the returned URL', async () => {
      const req = { user: safeUser } as any;
      authService.handleGoogleCallback.mockResolvedValue(
        'http://localhost:3000/dashboard',
      );

      await controller.googleCallback(req, mockRes as any);

      expect(authService.handleGoogleCallback).toHaveBeenCalledWith(
        safeUser,
        mockRes,
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/dashboard',
      );
    });

    it('redirects to complete-profile when handleGoogleCallback returns that URL', async () => {
      const req = { user: { ...safeUser, isOnboarded: false } } as any;
      authService.handleGoogleCallback.mockResolvedValue(
        'http://localhost:3000/auth/complete-profile',
      );

      await controller.googleCallback(req, mockRes as any);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/complete-profile',
      );
    });
  });

  // ─── guard coverage ───────────────────────────────────────────────────────────

  describe('guard coverage', () => {
    it('register does not require JwtAuthGuard', () => {
      const guards =
        Reflect.getMetadata('__guards__', AuthController.prototype.register) ??
        [];
      expect(guards).not.toContain(JwtAuthGuard);
    });

    it('login does not require JwtAuthGuard', () => {
      const guards =
        Reflect.getMetadata('__guards__', AuthController.prototype.login) ?? [];
      expect(guards).not.toContain(JwtAuthGuard);
    });

    it('logout does not require JwtAuthGuard', () => {
      const guards =
        Reflect.getMetadata('__guards__', AuthController.prototype.logout) ?? [];
      expect(guards).not.toContain(JwtAuthGuard);
    });
  });
});
