import { apiFetch } from '../lib/api-client';

export type EmploymentType = 'MINIJOB' | 'PARTTIME' | 'FULLTIME';

export interface Employee {
  id: string;
  fullName: string;
  phone: string | null;
  employmentType: EmploymentType;
  startDate: string;
  canWorkAlone: boolean;
  experienceScore: number;
  isKeyHolder: boolean;
  targetShiftsPerWeek: number | null;
  isDefaultRosterMember: boolean;
  status: string;
  actualShiftsThisWeek?: number;
}

export interface EmployeeInput {
  fullName: string;
  phone?: string;
  employmentType: EmploymentType;
  startDate: string;
  canWorkAlone?: boolean;
  experienceScore?: number;
  isKeyHolder?: boolean;
  targetShiftsPerWeek?: number;
  isDefaultRosterMember?: boolean;
  status?: string;
}

export function listEmployees(branchId: string, weekStart?: string): Promise<Employee[]> {
  const query = weekStart
    ? `branchId=${branchId}&weekStart=${weekStart}`
    : `branchId=${branchId}`;
  return apiFetch<Employee[]>(`/employees?${query}`);
}

export function createEmployee(input: EmployeeInput): Promise<Employee> {
  return apiFetch<Employee>('/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEmployee(id: string, input: Partial<EmployeeInput>): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function assignEmployeeToBranch(employeeId: string, branchId: string): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${employeeId}/branches`, {
    method: 'POST',
    body: JSON.stringify({ branchId, action: 'ADD' }),
  });
}
