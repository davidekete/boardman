import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const baseUser = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  username: 'janedoe',
  avatar: null as string | null,
};

const mockReq = (id = 'user-1') => ({ user: { id } } as any);

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { searchByUsername: jest.Mock; findByUsername: jest.Mock };

  beforeEach(async () => {
    usersService = {
      searchByUsername: jest.fn(),
      findByUsername: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── search ───────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('delegates to usersService.searchByUsername with the query and current user id', async () => {
      usersService.searchByUsername.mockResolvedValue([baseUser]);

      const result = await controller.search('jan', mockReq());

      expect(usersService.searchByUsername).toHaveBeenCalledWith('jan', 'user-1');
      expect(result).toEqual([baseUser]);
    });

    it('throws BadRequestException when the query is shorter than 2 characters', async () => {
      await expect(controller.search('j', mockReq())).rejects.toThrow(
        new BadRequestException('Query must be at least 2 characters'),
      );
      expect(usersService.searchByUsername).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the query is an empty string', async () => {
      await expect(controller.search('', mockReq())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the query is undefined', async () => {
      await expect(controller.search(undefined as any, mockReq())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('delegates to usersService.findByUsername with the route param', async () => {
      usersService.findByUsername.mockResolvedValue(baseUser);

      const result = await controller.findOne('janedoe');

      expect(usersService.findByUsername).toHaveBeenCalledWith('janedoe');
      expect(result).toEqual(baseUser);
    });
  });
});
