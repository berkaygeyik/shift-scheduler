import { useDroppable } from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clearAssignment, updateAssignment } from '../api/schedule';
import type { DayOfWeek, ShiftAssignment } from '../api/schedule';
import styles from './ScheduleGrid.module.css';

const DAYS: { key: DayOfWeek; label: string; weekend: boolean }[] = [
  { key: 'MONDAY', label: 'Mon', weekend: false },
  { key: 'TUESDAY', label: 'Tue', weekend: false },
  { key: 'WEDNESDAY', label: 'Wed', weekend: false },
  { key: 'THURSDAY', label: 'Thu', weekend: false },
  { key: 'FRIDAY', label: 'Fri', weekend: false },
  { key: 'SATURDAY', label: 'Sat', weekend: true },
  { key: 'SUNDAY', label: 'Sun', weekend: true },
];

const ACCENTS = [styles.accent0, styles.accent1, styles.accent2, styles.accent3];

interface TemplateGroup {
  templateId: string;
  templateName: string;
  timeRange: string;
  slots: (ShiftAssignment | undefined)[][];
}

function buildGroups(assignments: ShiftAssignment[]): TemplateGroup[] {
  const byTemplate = new Map<string, ShiftAssignment[]>();
  for (const assignment of assignments) {
    const list = byTemplate.get(assignment.shiftTemplateId) ?? [];
    list.push(assignment);
    byTemplate.set(assignment.shiftTemplateId, list);
  }

  const groups: TemplateGroup[] = [];
  for (const list of byTemplate.values()) {
    const template = list[0].shiftTemplate;
    const byDay = new Map<DayOfWeek, ShiftAssignment[]>();
    for (const assignment of list) {
      const dayList = byDay.get(assignment.dayOfWeek) ?? [];
      dayList.push(assignment);
      byDay.set(assignment.dayOfWeek, dayList);
    }
    for (const dayList of byDay.values()) {
      dayList.sort((a, b) => a.id.localeCompare(b.id));
    }

    const slots: (ShiftAssignment | undefined)[][] = [];
    for (let slotIndex = 0; slotIndex < template.requiredStaffCount; slotIndex++) {
      slots.push(DAYS.map((day) => byDay.get(day.key)?.[slotIndex]));
    }

    groups.push({
      templateId: template.id,
      templateName: template.name,
      timeRange: `${template.startTime}–${template.endTime}`,
      slots,
    });
  }

  groups.sort((a, b) => a.templateName.localeCompare(b.templateName));
  return groups;
}

function ScheduleCell({
  assignment,
  weekend,
  onClear,
  onToggleLock,
}: {
  assignment: ShiftAssignment;
  weekend: boolean;
  onClear: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: assignment.id });

  return (
    <td className={`${styles.cell} ${weekend ? styles.weekendCell : ''}`}>
      <div
        ref={setNodeRef}
        className={`${styles.dropZone} ${isOver ? styles.dropZoneOver : ''}`}
      >
        {assignment.employee ? (
          <div className={styles.assignedRow}>
            <span className={styles.assignedName}>{assignment.employee.fullName}</span>
            <button
              className={styles.removeButton}
              onClick={() => onClear(assignment.id)}
              title="Unassign"
              type="button"
            >
              ×
            </button>
          </div>
        ) : (
          <span className={styles.dropZoneEmpty}>Drop here</span>
        )}
        <div className={styles.lockRow}>
          <input
            type="checkbox"
            checked={assignment.locked}
            onChange={(e) => onToggleLock(assignment.id, e.target.checked)}
          />
          <span className={styles.lockLabel}>Locked</span>
        </div>
      </div>
    </td>
  );
}

export function ScheduleGrid({
  assignments,
  queryKey,
}: {
  assignments: ShiftAssignment[];
  queryKey: unknown[];
}) {
  const queryClient = useQueryClient();

  const lockMutation = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) =>
      updateAssignment(id, { locked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const clearMutation = useMutation({
    mutationFn: (id: string) => clearAssignment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const groups = buildGroups(assignments);

  if (groups.length === 0) {
    return (
      <div className={styles.tableWrapper}>
        <p className={styles.emptyState}>
          This branch has no shift templates yet. Add one on the Branches page first.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            <th className={styles.shiftHeaderCell}>Shift</th>
            {DAYS.map((day) => (
              <th
                key={day.key}
                className={`${styles.headerCell} ${day.weekend ? styles.weekendHeader : ''}`}
              >
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group, groupIndex) =>
            group.slots.map((row, slotIndex) => (
              <tr key={`${group.templateId}-${slotIndex}`} className={styles.row}>
                {slotIndex === 0 && (
                  <th
                    className={`${styles.rowHeader} ${ACCENTS[groupIndex % ACCENTS.length]}`}
                    rowSpan={group.slots.length}
                  >
                    <span className={styles.shiftName}>
                      {group.templateName}
                      {group.slots.length > 1 ? ` (${group.slots.length} slots)` : ''}
                    </span>
                    <span className={styles.shiftTime}>{group.timeRange}</span>
                  </th>
                )}
                {row.map((assignment, dayIndex) =>
                  assignment ? (
                    <ScheduleCell
                      key={dayIndex}
                      assignment={assignment}
                      weekend={DAYS[dayIndex].weekend}
                      onClear={(id) => clearMutation.mutate(id)}
                      onToggleLock={(id, locked) => lockMutation.mutate({ id, locked })}
                    />
                  ) : (
                    <td
                      key={dayIndex}
                      className={`${styles.cell} ${DAYS[dayIndex].weekend ? styles.weekendCell : ''}`}
                    />
                  ),
                )}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
