import { apiFetch } from '../lib/api-client';

export interface Branch {
  id: string;
  name: string;
  timezone: string;
}

export interface CreateBranchInput {
  name: string;
  timezone: string;
}

export interface UpdateBranchInput {
  name?: string;
  timezone?: string;
}

export function listBranches(): Promise<Branch[]> {
  return apiFetch<Branch[]>('/branches');
}

export function createBranch(input: CreateBranchInput): Promise<Branch> {
  return apiFetch<Branch>('/branches', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateBranch(id: string, input: UpdateBranchInput): Promise<Branch> {
  return apiFetch<Branch>(`/branches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
