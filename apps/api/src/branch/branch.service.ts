import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, userId: string, dto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        organizationId,
        name: dto.name,
        timezone: dto.timezone,
        managers: {
          create: { userId },
        },
      },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.branch.findMany({
      where: { managers: { some: { userId } } },
      orderBy: { name: 'asc' },
    });
  }

  async update(userId: string, branchId: string, dto: UpdateBranchDto) {
    await this.assertManagerHasAccess(userId, branchId);

    return this.prisma.branch.update({
      where: { id: branchId },
      data: dto,
    });
  }

  async assertManagerHasAccess(userId: string, branchId: string): Promise<void> {
    const membership = await this.prisma.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId } },
    });

    if (!membership) {
      const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
      throw new ForbiddenException('You do not have access to this branch');
    }
  }
}
