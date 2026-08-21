import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeService } from '../employee/employee.service';
import { UpsertAvailabilityDto } from './dto/upsert-availability.dto';
import { mergeAvailability } from './merge-availability';
import type { EmployeeAvailabilityModel } from '../generated/prisma/models/EmployeeAvailability';

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeService: EmployeeService,
  ) {}

  async upsertBulk(enteredByUserId: string, dto: UpsertAvailabilityDto) {
    const employeeIds = [...new Set(dto.entries.map((entry) => entry.employeeId))];
    for (const employeeId of employeeIds) {
      await this.employeeService.assertManagerCanAccessEmployee(enteredByUserId, employeeId);
    }

    return this.prisma.$transaction(async (tx) => {
      const results: EmployeeAvailabilityModel[] = [];
      for (const entry of dto.entries) {
        const weekStartDate = entry.weekStartDate ? new Date(entry.weekStartDate) : null;
        const shiftTemplateId = entry.shiftTemplateId ?? null;

        const existing = await tx.employeeAvailability.findFirst({
          where: {
            employeeId: entry.employeeId,
            dayOfWeek: entry.dayOfWeek,
            weekStartDate,
            shiftTemplateId,
          },
        });

        const data = {
          employeeId: entry.employeeId,
          weekStartDate,
          dayOfWeek: entry.dayOfWeek,
          shiftTemplateId,
          status: entry.status,
          note: entry.note,
          enteredByUserId,
        };

        const saved = existing
          ? await tx.employeeAvailability.update({ where: { id: existing.id }, data })
          : await tx.employeeAvailability.create({ data });

        results.push(saved);
      }
      return results;
    });
  }

  async getEffectiveAvailability(userId: string, employeeId: string, weekStart: string) {
    await this.employeeService.assertManagerCanAccessEmployee(userId, employeeId);
    return this.getEffectiveAvailabilityUnchecked(employeeId, weekStart);
  }

  async getEffectiveAvailabilityUnchecked(employeeId: string, weekStart: string) {
    const weekStartDate = new Date(weekStart);

    const [recurring, overrides] = await Promise.all([
      this.prisma.employeeAvailability.findMany({
        where: { employeeId, weekStartDate: null },
      }),
      this.prisma.employeeAvailability.findMany({
        where: { employeeId, weekStartDate },
      }),
    ]);

    return mergeAvailability(recurring, overrides);
  }
}
