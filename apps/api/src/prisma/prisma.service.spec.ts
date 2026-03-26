jest.mock('@prisma/adapter-neon', () => ({
  PrismaNeon: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@prisma/client', () => {
  class PrismaClient {
    constructor(_opts?: unknown) {}
    async $connect() {}
  }
  return { PrismaClient };
});

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('calls $connect during onModuleInit', async () => {
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('constructs without throwing even when DATABASE_URL is unset', () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    expect(() => new PrismaService()).not.toThrow();

    process.env.DATABASE_URL = original;
  });
});
