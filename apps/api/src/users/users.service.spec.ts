import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const baseUser = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  username: 'janedoe',
  avatar: null as string | null,
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { findMany: jest.Mock; findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── searchByUsername ─────────────────────────────────────────────────────────

  describe('searchByUsername', () => {
    it('returns matching users excluding the requesting user', async () => {
      prisma.user.findMany.mockResolvedValue([baseUser]);

      const result = await service.searchByUsername('jane', 'other-user');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          username: { contains: 'jane', mode: 'insensitive' },
          id: { not: 'other-user' },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatar: true,
        },
        take: 5,
      });
      expect(result).toEqual([baseUser]);
    });

    it('returns an empty array when no users match', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.searchByUsername('zzz', 'user-1');

      expect(result).toEqual([]);
    });

    it('limits results to 5', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.searchByUsername('j', 'user-1');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  // ─── findByUsername ───────────────────────────────────────────────────────────

  describe('findByUsername', () => {
    it('returns the user when found by exact username', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.findByUsername('janedoe');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'janedoe' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatar: true,
        },
      });
      expect(result).toEqual(baseUser);
    });

    it('throws NotFoundException when no user matches the username', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findByUsername('ghost')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });
  });
});
