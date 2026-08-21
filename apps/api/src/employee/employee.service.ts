import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchService } from '../branch/branch.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AssignBranchDto } from './dto/assign-branch.dto';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchService: BranchService,
  ) {}

  async create(organizationId: string, dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        organizationId,
        fullName: dto.fullName,
        phone: dto.phone,
        employmentType: dto.employmentType,
        startDate: new Date(dto.startDate),
        canWorkAlone: dto.canWorkAlone,
        experienceScore: dto.experienceScore,
        isKeyHolder: dto.isKeyHolder,
        targetShiftsPerWeek: dto.targetShiftsPerWeek,
        isDefaultRosterMember: dto.isDefaultRosterMember,
        status: dto.status,
      },
    });
  }

  async findAllForBranch(userId: string, branchId: string, weekStart?: string) {
    await this.branchService.assertManagerHasAccess(userId, branchId);
    const employees = await this.prisma.employee.findMany({
      where: { branches: { some: { branchId } } },
      orderBy: { fullName: 'asc' },
    });

    if (!weekStart) {
      return employees;
    }

    const counts = await this.prisma.shiftAssignment.groupBy({
      by: ['employeeId'],
      where: {
        branchId,
        weekStartDate: new Date(weekStart),
        employeeId: { in: employees.map((e) => e.id) },
      },
      _count: { employeeId: true },
    });
    const countByEmployeeId = new Map(counts.map((c) => [c.employeeId, c._count.employeeId]));

    return employees.map((employee) => ({
      ...employee,
      actualShiftsThisWeek: countByEmployeeId.get(employee.id) ?? 0,
    }));
  }

  async update(userId: string, employeeId: string, dto: UpdateEmployeeDto) {
    await this.assertManagerCanAccessEmployee(userId, employeeId);

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      },
    });
  }

  async assignBranch(userId: string, employeeId: string, dto: AssignBranchDto) {
    await this.branchService.assertManagerHasAccess(userId, dto.branchId);

    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.action === 'ADD') {
      await this.prisma.employeeBranch.upsert({
        where: { employeeId_branchId: { employeeId, branchId: dto.branchId } },
        create: { employeeId, branchId: dto.branchId, isHomeBranch: dto.isHomeBranch ?? false },
        update: { isHomeBranch: dto.isHomeBranch ?? undefined },
      });
    } else {
      await this.prisma.employeeBranch.deleteMany({
        where: { employeeId, branchId: dto.branchId },
      });
    }

    return this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { branches: true },
    });
  }

  async assertManagerCanAccessEmployee(userId: string, employeeId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { branches: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.branches.length === 0) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.organizationId !== employee.organizationId) {
        throw new ForbiddenException('You do not have access to this employee');
      }
      return;
    }

    const accessible = await this.prisma.userBranch.findFirst({
      where: {
        userId,
        branchId: { in: employee.branches.map((b) => b.branchId) },
      },
    });
    if (!accessible) {
      throw new ForbiddenException('You do not have access to this employee');
    }
  }
}
