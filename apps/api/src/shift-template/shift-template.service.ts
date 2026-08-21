import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchService } from '../branch/branch.service';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';

@Injectable()
export class ShiftTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchService: BranchService,
  ) {}

  async create(userId: string, branchId: string, dto: CreateShiftTemplateDto) {
    await this.branchService.assertManagerHasAccess(userId, branchId);
    return this.prisma.shiftTemplate.create({
      data: { branchId, ...dto },
    });
  }

  async findAllForBranch(userId: string, branchId: string) {
    await this.branchService.assertManagerHasAccess(userId, branchId);
    return this.prisma.shiftTemplate.findMany({
      where: { branchId },
      orderBy: { name: 'asc' },
    });
  }

  async update(userId: string, templateId: string, dto: UpdateShiftTemplateDto) {
    const template = await this.prisma.shiftTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException('Shift template not found');
    }

    await this.branchService.assertManagerHasAccess(userId, template.branchId);

    return this.prisma.shiftTemplate.update({
      where: { id: templateId },
      data: dto,
    });
  }
}
