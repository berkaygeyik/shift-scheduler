import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignEmployeeToBranch,
  createEmployee,
  listEmployees,
  updateEmployee,
} from '../api/employees';
import type { Employee, EmployeeInput, EmploymentType } from '../api/employees';
import { ApiError } from '../lib/api-client';
import styles from './EmployeePanel.module.css';

interface FormState {
  fullName: string;
  phone: string;
  employmentType: EmploymentType;
  startDate: string;
  canWorkAlone: boolean;
  experienceScore: string;
  isKeyHolder: boolean;
  targetShiftsPerWeek: string;
  isDefaultRosterMember: boolean;
  status: string;
}

function emptyForm(): FormState {
  return {
    fullName: '',
    phone: '',
    employmentType: 'FULLTIME',
    startDate: new Date().toISOString().slice(0, 10),
    canWorkAlone: false,
    experienceScore: '5',
    isKeyHolder: false,
    targetShiftsPerWeek: '',
    isDefaultRosterMember: true,
    status: 'active',
  };
}

function toFormState(employee: Employee): FormState {
  return {
    fullName: employee.fullName,
    phone: employee.phone ?? '',
    employmentType: employee.employmentType,
    startDate: employee.startDate.slice(0, 10),
    canWorkAlone: employee.canWorkAlone,
    experienceScore: String(employee.experienceScore),
    isKeyHolder: employee.isKeyHolder,
    targetShiftsPerWeek:
      employee.targetShiftsPerWeek != null ? String(employee.targetShiftsPerWeek) : '',
    isDefaultRosterMember: employee.isDefaultRosterMember,
    status: employee.status,
  };
}

export function EmployeePanel({ branchId }: { branchId: string }) {
  const queryClient = useQueryClient();
  const employeesQueryKey = ['employees', branchId];
  const { data: employees, isLoading } = useQuery({
    queryKey: employeesQueryKey,
    queryFn: () => listEmployees(branchId),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (input: EmployeeInput) => {
      const employee = await createEmployee(input);
      await assignEmployeeToBranch(employee.id, branchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesQueryKey });
      setForm(emptyForm());
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<EmployeeInput> }) =>
      updateEmployee(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesQueryKey });
      setEditingId(null);
      setForm(emptyForm());
    },
  });

  function startEdit(employee: Employee) {
    setEditingId(employee.id);
    setForm(toFormState(employee));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const input: EmployeeInput = {
      fullName: form.fullName,
      phone: form.phone || undefined,
      employmentType: form.employmentType,
      startDate: form.startDate,
      canWorkAlone: form.canWorkAlone,
      experienceScore: form.experienceScore ? Number(form.experienceScore) : undefined,
      isKeyHolder: form.isKeyHolder,
      targetShiftsPerWeek: form.targetShiftsPerWeek ? Number(form.targetShiftsPerWeek) : undefined,
      isDefaultRosterMember: form.isDefaultRosterMember,
      status: form.status,
    };
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input });
      } else {
        await createMutation.mutateAsync(input);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save employee.');
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      {isLoading && <p className={styles.emptyState}>Loading employees...</p>}
      {!isLoading && employees?.length === 0 && (
        <p className={styles.emptyState}>No employees yet for this branch.</p>
      )}
      {!isLoading && employees && employees.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th className={styles.headerCell}>Name</th>
              <th className={styles.headerCell}>Type</th>
              <th className={styles.headerCell}>Start date</th>
              <th className={styles.headerCell}>Target/week</th>
              <th className={styles.headerCell}>Flags</th>
              <th className={styles.headerCell}></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr
                key={employee.id}
                className={`${styles.row} ${employee.status === 'active' ? '' : styles.inactive}`}
              >
                <td className={styles.cell}>{employee.fullName}</td>
                <td className={styles.cell}>{employee.employmentType}</td>
                <td className={styles.cell}>{employee.startDate.slice(0, 10)}</td>
                <td className={styles.cell}>{employee.targetShiftsPerWeek ?? '—'}</td>
                <td className={styles.cell}>
                  <div className={styles.badges}>
                    {employee.isKeyHolder && <span className={styles.badge}>Key holder</span>}
                    {employee.canWorkAlone && <span className={styles.badge}>Works alone</span>}
                    <span className={styles.badge}>Exp {employee.experienceScore}</span>
                    {employee.status !== 'active' && <span className={styles.badge}>Inactive</span>}
                  </div>
                </td>
                <td className={styles.cell}>
                  <button className={styles.editButton} onClick={() => startEdit(employee)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.label} htmlFor="emp-name">
            Full name
          </label>
          <input
            className={styles.input}
            id="emp-name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="emp-phone">
            Phone
          </label>
          <input
            className={styles.input}
            id="emp-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="emp-type">
            Employment type
          </label>
          <select
            className={styles.select}
            id="emp-type"
            value={form.employmentType}
            onChange={(e) =>
              setForm({ ...form, employmentType: e.target.value as EmploymentType })
            }
          >
            <option value="FULLTIME">Full-time</option>
            <option value="PARTTIME">Part-time</option>
            <option value="MINIJOB">Minijob</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="emp-start">
            Start date
          </label>
          <input
            className={styles.input}
            id="emp-start"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="emp-target">
            Target shifts/week
          </label>
          <input
            className={styles.input}
            id="emp-target"
            type="number"
            min={0}
            value={form.targetShiftsPerWeek}
            onChange={(e) => setForm({ ...form, targetShiftsPerWeek: e.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="emp-experience">
            Experience (1-10)
          </label>
          <input
            className={styles.input}
            id="emp-experience"
            type="number"
            min={1}
            max={10}
            value={form.experienceScore}
            onChange={(e) => setForm({ ...form, experienceScore: e.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="emp-status">
            Status
          </label>
          <select
            className={styles.select}
            id="emp-status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className={styles.checkboxField}>
          <input
            id="emp-can-work-alone"
            type="checkbox"
            checked={form.canWorkAlone}
            onChange={(e) => setForm({ ...form, canWorkAlone: e.target.checked })}
          />
          <label className={styles.checkboxLabel} htmlFor="emp-can-work-alone">
            Can work alone
          </label>
        </div>

        <div className={styles.checkboxField}>
          <input
            id="emp-key-holder"
            type="checkbox"
            checked={form.isKeyHolder}
            onChange={(e) => setForm({ ...form, isKeyHolder: e.target.checked })}
          />
          <label className={styles.checkboxLabel} htmlFor="emp-key-holder">
            Key holder
          </label>
        </div>

        <div className={styles.checkboxField}>
          <input
            id="emp-default-roster"
            type="checkbox"
            checked={form.isDefaultRosterMember}
            onChange={(e) => setForm({ ...form, isDefaultRosterMember: e.target.checked })}
          />
          <label className={styles.checkboxLabel} htmlFor="emp-default-roster">
            Default roster member
          </label>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.formActions}>
          <button className={styles.submit} type="submit" disabled={isSubmitting}>
            {editingId ? 'Save changes' : 'Add employee'}
          </button>
          {editingId && (
            <button className={styles.cancel} type="button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
