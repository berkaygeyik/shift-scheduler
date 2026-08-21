import { mergeAvailability } from './merge-availability';
import type { EmployeeAvailabilityModel } from '../generated/prisma/models/EmployeeAvailability';

function makeEntry(overrides: Partial<EmployeeAvailabilityModel>): EmployeeAvailabilityModel {
  return {
    id: 'id',
    employeeId: 'employee-1',
    weekStartDate: null,
    dayOfWeek: 'MONDAY',
    shiftTemplateId: null,
    status: 'AVAILABLE',
    note: null,
    enteredByUserId: 'user-1',
    ...overrides,
  } as EmployeeAvailabilityModel;
}

describe('mergeAvailability', () => {
  it('returns the recurring entry when there is no override', () => {
    const recurring = [makeEntry({ id: 'r1', dayOfWeek: 'MONDAY' })];
    const result = mergeAvailability(recurring, []);
    expect(result).toEqual([{ ...recurring[0], isOverride: false }]);
  });

  it('lets a week-specific override replace the recurring rule for the same slot', () => {
    const recurring = [makeEntry({ id: 'r1', dayOfWeek: 'MONDAY', status: 'AVAILABLE' })];
    const overrides = [
      makeEntry({ id: 'o1', dayOfWeek: 'MONDAY', status: 'UNAVAILABLE', weekStartDate: new Date('2026-01-05') }),
    ];

    const result = mergeAvailability(recurring, overrides);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('o1');
    expect(result[0].isOverride).toBe(true);
  });

  it('does not let an override for one shiftTemplateId affect a different one on the same day', () => {
    const recurring = [
      makeEntry({ id: 'r1', dayOfWeek: 'TUESDAY', shiftTemplateId: 'shift-a' }),
      makeEntry({ id: 'r2', dayOfWeek: 'TUESDAY', shiftTemplateId: 'shift-b' }),
    ];
    const overrides = [
      makeEntry({ id: 'o1', dayOfWeek: 'TUESDAY', shiftTemplateId: 'shift-a', status: 'UNAVAILABLE' }),
    ];

    const result = mergeAvailability(recurring, overrides);

    expect(result.map((r) => r.id).sort()).toEqual(['o1', 'r2']);
  });

  it('treats a null shiftTemplateId (whole day) as its own slot, distinct from per-shift entries', () => {
    const recurring = [
      makeEntry({ id: 'r1', dayOfWeek: 'WEDNESDAY', shiftTemplateId: null }),
      makeEntry({ id: 'r2', dayOfWeek: 'WEDNESDAY', shiftTemplateId: 'shift-a' }),
    ];
    const overrides = [
      makeEntry({ id: 'o1', dayOfWeek: 'WEDNESDAY', shiftTemplateId: null, status: 'UNAVAILABLE' }),
    ];

    const result = mergeAvailability(recurring, overrides);

    expect(result.map((r) => r.id).sort()).toEqual(['o1', 'r2']);
  });
});
