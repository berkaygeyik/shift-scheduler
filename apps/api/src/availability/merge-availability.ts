import type { EmployeeAvailabilityModel } from '../generated/prisma/models/EmployeeAvailability';

export interface MergedAvailabilityEntry extends EmployeeAvailabilityModel {
  isOverride: boolean;
}

function slotKey(entry: Pick<EmployeeAvailabilityModel, 'dayOfWeek' | 'shiftTemplateId'>): string {
  return `${entry.dayOfWeek}:${entry.shiftTemplateId ?? 'ALL_DAY'}`;
}

export function mergeAvailability(
  recurring: EmployeeAvailabilityModel[],
  overrides: EmployeeAvailabilityModel[],
): MergedAvailabilityEntry[] {
  const overriddenSlots = new Set(overrides.map(slotKey));

  const effectiveRecurring = recurring
    .filter((entry) => !overriddenSlots.has(slotKey(entry)))
    .map((entry) => ({ ...entry, isOverride: false }));

  const effectiveOverrides = overrides.map((entry) => ({ ...entry, isOverride: true }));

  return [...effectiveRecurring, ...effectiveOverrides];
}
