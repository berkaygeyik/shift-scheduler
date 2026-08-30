import { apiFetch } from '../lib/api-client';
import type { Employee } from './employees';
import type { ShiftTemplate } from './shift-templates';

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface ShiftAssignment {
  id: string;
  branchId: string;
  weekStartDate: string;
  dayOfWeek: DayOfWeek;
  shiftTemplateId: string;
  employeeId: string | null;
  locked: boolean;
  createdBy: 'MANUAL' | 'AUTO';
  employee: Employee | null;
  shiftTemplate: ShiftTemplate;
}

export type AutoFillMode = 'fill_empty' | 'randomize_all';

export function getSchedule(branchId: string, weekStart: string): Promise<ShiftAssignment[]> {
  return apiFetch<ShiftAssignment[]>(
    `/schedule?branchId=${branchId}&weekStart=${weekStart}`,
  );
}

export function updateAssignment(
  id: string,
  input: { employeeId?: string | null; locked?: boolean },
): Promise<ShiftAssignment> {
  return apiFetch<ShiftAssignment>(`/schedule/assignments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function clearAssignment(id: string): Promise<ShiftAssignment> {
  return apiFetch<ShiftAssignment>(`/schedule/assignments/${id}`, {
    method: 'DELETE',
  });
}

export function autoFill(input: {
  branchId: string;
  weekStart: string;
  mode: AutoFillMode;
}): Promise<ShiftAssignment[]> {
  return apiFetch<ShiftAssignment[]>('/schedule/auto-fill', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
