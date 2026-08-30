import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Employee } from '../api/employees';
import styles from './EmployeeRoster.module.css';

function initials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function EmployeeCard({ employee }: { employee: Employee }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: employee.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      {...listeners}
      {...attributes}
    >
      <span className={styles.avatar}>{initials(employee.fullName)}</span>
      <div className={styles.info}>
        <span className={styles.name}>{employee.fullName}</span>
        {employee.targetShiftsPerWeek != null && (
          <span className={styles.count}>
            {employee.actualShiftsThisWeek ?? 0} / {employee.targetShiftsPerWeek} shifts
          </span>
        )}
      </div>
    </div>
  );
}

export function EmployeeRoster({ employees }: { employees: Employee[] }) {
  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Employees</h2>
      {employees.length === 0 ? (
        <p className={styles.emptyState}>No employees yet — add one on the Employees page.</p>
      ) : (
        <>
          <p className={styles.hint}>Drag a name onto a shift slot to assign it.</p>
          <div className={styles.list}>
            {employees.map((employee) => (
              <EmployeeCard key={employee.id} employee={employee} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function EmployeeDragPreview({ employee }: { employee: Employee }) {
  return (
    <div className={styles.overlayCard}>
      <span className={styles.avatar}>{initials(employee.fullName)}</span>
      <span className={styles.name}>{employee.fullName}</span>
    </div>
  );
}
