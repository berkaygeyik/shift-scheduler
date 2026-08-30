import { useEffect, useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listBranches } from '../api/branches';
import { listEmployees } from '../api/employees';
import { autoFill, clearAssignment, getSchedule, updateAssignment } from '../api/schedule';
import type { AutoFillMode } from '../api/schedule';
import { getMonday } from '../lib/date';
import { ApiError } from '../lib/api-client';
import { EmployeeRoster, EmployeeDragPreview } from './EmployeeRoster';
import { ScheduleGrid } from './ScheduleGrid';
import styles from './SchedulePage.module.css';

export function SchedulePage() {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState<string>('');
  const [weekStart, setWeekStart] = useState<string>(() => getMonday(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [draggingEmployeeId, setDraggingEmployeeId] = useState<string | null>(null);

  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: listBranches });

  useEffect(() => {
    if (!branchId && branches && branches.length > 0) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId]);

  const scheduleQueryKey = ['schedule', branchId, weekStart];
  const { data: assignments, isLoading: isScheduleLoading } = useQuery({
    queryKey: scheduleQueryKey,
    queryFn: () => getSchedule(branchId, weekStart),
    enabled: !!branchId,
  });

  const employeesQueryKey = ['employees', branchId, weekStart];
  const { data: employees } = useQuery({
    queryKey: employeesQueryKey,
    queryFn: () => listEmployees(branchId, weekStart),
    enabled: !!branchId,
  });

  const assignMutation = useMutation({
    mutationFn: ({ assignmentId, employeeId }: { assignmentId: string; employeeId: string }) =>
      updateAssignment(assignmentId, { employeeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKey });
      queryClient.invalidateQueries({ queryKey: employeesQueryKey });
    },
  });

  const autoFillMutation = useMutation({
    mutationFn: (mode: AutoFillMode) => autoFill({ branchId, weekStart, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKey });
      queryClient.invalidateQueries({ queryKey: employeesQueryKey });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not auto-fill schedule.');
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const toClear = (assignments ?? []).filter((a) => a.employeeId && !a.locked);
      await Promise.all(toClear.map((a) => clearAssignment(a.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKey });
      queryClient.invalidateQueries({ queryKey: employeesQueryKey });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not clear schedule.');
    },
  });

  function handleDragStart(event: DragStartEvent) {
    setDraggingEmployeeId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingEmployeeId(null);
    const assignmentId = event.over?.id;
    if (!assignmentId) return;
    assignMutation.mutate({ assignmentId: String(assignmentId), employeeId: String(event.active.id) });
  }

  const draggingEmployee = employees?.find((employee) => employee.id === draggingEmployeeId);

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="branch-select">
            Branch
          </label>
          <select
            className={styles.select}
            id="branch-select"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="week-start">
            Week starting
          </label>
          <input
            className={styles.input}
            id="week-start"
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button
            className={styles.button}
            disabled={!branchId || autoFillMutation.isPending}
            onClick={() => autoFillMutation.mutate('fill_empty')}
          >
            Fill empty slots
          </button>
          <button
            className={styles.button}
            disabled={!branchId || autoFillMutation.isPending}
            onClick={() => autoFillMutation.mutate('randomize_all')}
          >
            Randomize all
          </button>
          <button
            className={styles.button}
            disabled={!branchId || clearAllMutation.isPending}
            onClick={() => clearAllMutation.mutate()}
          >
            Clear all
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>

      {!branchId && <p className={styles.emptyState}>Create a branch first on the Branches page.</p>}
      {branchId && (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className={styles.layout}>
            <EmployeeRoster employees={employees ?? []} />
            {isScheduleLoading && <p className={styles.emptyState}>Loading schedule...</p>}
            {assignments && <ScheduleGrid assignments={assignments} queryKey={scheduleQueryKey} />}
          </div>
          <DragOverlay>
            {draggingEmployee && <EmployeeDragPreview employee={draggingEmployee} />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
