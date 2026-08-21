import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchService } from '../branch/branch.service';
import { AvailabilityService } from '../availability/availability.service';
import { DayOfWeek } from '../generated/prisma/enums';
import { pickCandidate } from '../scheduling-engine/pick-candidate';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { AutoFillDto } from './dto/auto-fill.dto';

const DAY_ORDER: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchService: BranchService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async findSchedule(userId: string, branchId: string, weekStart: string) {
    await this.branchService.assertManagerHasAccess(userId, branchId);
    const weekStartDate = new Date(weekStart);

    await this.ensureWeekGenerated(branchId, weekStartDate);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { branchId, weekStartDate },
      include: { employee: true, shiftTemplate: true },
    });

    return assignments.sort((a, b) => {
      const dayDiff = DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
      if (dayDiff !== 0) return dayDiff;
      return a.shiftTemplate.name.localeCompare(b.shiftTemplate.name);
    });
  }

  async updateAssignment(userId: string, assignmentId: string, dto: UpdateAssignmentDto) {
    const assignment = await this.getAssignmentOrThrow(assignmentId);
    await this.branchService.assertManagerHasAccess(userId, assignment.branchId);

    if (dto.employeeId) {
      await this.assertEmployeeBelongsToBranch(dto.employeeId, assignment.branchId);
    }

    return this.prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: {
        employeeId: dto.employeeId,
        locked: dto.locked,
        createdBy: dto.employeeId !== undefined ? 'MANUAL' : undefined,
      },
    });
  }

  async clearAssignment(userId: string, assignmentId: string) {
    const assignment = await this.getAssignmentOrThrow(assignmentId);
    await this.branchService.assertManagerHasAccess(userId, assignment.branchId);

    return this.prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: { employeeId: null, createdBy: 'MANUAL' },
    });
  }

  async autoFill(userId: string, dto: AutoFillDto) {
    await this.branchService.assertManagerHasAccess(userId, dto.branchId);
    const weekStartDate = new Date(dto.weekStart);

    await this.ensureWeekGenerated(dto.branchId, weekStartDate);

    if (dto.mode === 'randomize_all') {
      await this.prisma.shiftAssignment.updateMany({
        where: { branchId: dto.branchId, weekStartDate, locked: false },
        data: { employeeId: null },
      });
    }

    const branchEmployees = await this.prisma.employeeBranch.findMany({
      where: { branchId: dto.branchId },
      select: { employeeId: true },
    });
    const employeeIds = branchEmployees.map((e) => e.employeeId);

    const availabilityByEmployee = new Map<
      string,
      Awaited<ReturnType<AvailabilityService['getEffectiveAvailabilityUnchecked']>>
    >();
    for (const employeeId of employeeIds) {
      availabilityByEmployee.set(
        employeeId,
        await this.availabilityService.getEffectiveAvailabilityUnchecked(employeeId, dto.weekStart),
      );
    }

    const emptySlots = await this.prisma.shiftAssignment.findMany({
      where: {
        branchId: dto.branchId,
        weekStartDate,
        employeeId: null,
        locked: false,
      },
    });

    for (const slot of emptySlots) {
      const eligible = employeeIds.filter((employeeId) =>
        this.isAvailableForSlot(
          availabilityByEmployee.get(employeeId) ?? [],
          slot.dayOfWeek,
          slot.shiftTemplateId,
        ),
      );

      const chosen = pickCandidate(eligible);
      if (chosen) {
        await this.prisma.shiftAssignment.update({
          where: { id: slot.id },
          data: { employeeId: chosen, createdBy: 'AUTO' },
        });
      }
    }

    return this.prisma.shiftAssignment.findMany({
      where: { branchId: dto.branchId, weekStartDate },
      include: { employee: true, shiftTemplate: true },
    });
  }

  private isAvailableForSlot(
    entries: Array<{ dayOfWeek: string; shiftTemplateId: string | null; status: string }>,
    dayOfWeek: string,
    shiftTemplateId: string,
  ): boolean {
    const forDay = entries.filter((e) => e.dayOfWeek === dayOfWeek);
    const specific = forDay.find((e) => e.shiftTemplateId === shiftTemplateId);
    if (specific) return specific.status === 'AVAILABLE';

    const wholeDay = forDay.find((e) => e.shiftTemplateId === null);
    if (wholeDay) return wholeDay.status === 'AVAILABLE';

    return true;
  }

  private async ensureWeekGenerated(branchId: string, weekStartDate: Date): Promise<void> {
    const existing = await this.prisma.shiftAssignment.findFirst({
      where: { branchId, weekStartDate },
    });
    if (existing) return;

    const templates = await this.prisma.shiftTemplate.findMany({
      where: { branchId, active: true },
    });

    const rows = templates.flatMap((template) =>
      DAY_ORDER.flatMap((dayOfWeek) =>
        Array.from({ length: template.requiredStaffCount }, () => ({
          branchId,
          weekStartDate,
          dayOfWeek,
          shiftTemplateId: template.id,
        })),
      ),
    );

    if (rows.length > 0) {
      await this.prisma.shiftAssignment.createMany({ data: rows });
    }
  }

  private async getAssignmentOrThrow(assignmentId: string) {
    const assignment = await this.prisma.shiftAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('Shift assignment not found');
    }
    return assignment;
  }

  private async assertEmployeeBelongsToBranch(employeeId: string, branchId: string): Promise<void> {
    const membership = await this.prisma.employeeBranch.findUnique({
      where: { employeeId_branchId: { employeeId, branchId } },
    });
    if (!membership) {
      throw new BadRequestException('Employee is not assigned to this branch');
    }
  }
}
