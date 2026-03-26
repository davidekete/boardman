import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async searchByUsername(query: string, excludeUserId: string) {
    return this.prisma.user.findMany({
      where: {
        username: { contains: query, mode: 'insensitive' },
        id: { not: excludeUserId },
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
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        avatar: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
