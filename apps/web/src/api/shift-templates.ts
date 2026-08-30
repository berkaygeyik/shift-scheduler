import { apiFetch } from '../lib/api-client';

export interface ShiftTemplate {
  id: string;
  branchId: string;
  name: string;
  startTime: string;
  endTime: string;
  requiredStaffCount: number;
  requiresKeyHolder: boolean;
  isOpening: boolean;
  isClosing: boolean;
  active: boolean;
}

export interface ShiftTemplateInput {
  name: string;
  startTime: string;
  endTime: string;
  requiredStaffCount: number;
  requiresKeyHolder?: boolean;
  isOpening?: boolean;
  isClosing?: boolean;
  active?: boolean;
}

export function listShiftTemplates(branchId: string): Promise<ShiftTemplate[]> {
  return apiFetch<ShiftTemplate[]>(`/branches/${branchId}/shift-templates`);
}

export function createShiftTemplate(
  branchId: string,
  input: ShiftTemplateInput,
): Promise<ShiftTemplate> {
  return apiFetch<ShiftTemplate>(`/branches/${branchId}/shift-templates`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateShiftTemplate(
  id: string,
  input: Partial<ShiftTemplateInput>,
): Promise<ShiftTemplate> {
  return apiFetch<ShiftTemplate>(`/shift-templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
