import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createShiftTemplate,
  listShiftTemplates,
  updateShiftTemplate,
} from '../api/shift-templates';
import type { ShiftTemplate, ShiftTemplateInput } from '../api/shift-templates';
import { ApiError } from '../lib/api-client';
import styles from './ShiftTemplatePanel.module.css';

interface FormState {
  name: string;
  startTime: string;
  endTime: string;
  requiredStaffCount: string;
  requiresKeyHolder: boolean;
  isOpening: boolean;
  isClosing: boolean;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  startTime: '',
  endTime: '',
  requiredStaffCount: '1',
  requiresKeyHolder: false,
  isOpening: false,
  isClosing: false,
  active: true,
};

function toFormState(template: ShiftTemplate): FormState {
  return {
    name: template.name,
    startTime: template.startTime,
    endTime: template.endTime,
    requiredStaffCount: String(template.requiredStaffCount),
    requiresKeyHolder: template.requiresKeyHolder,
    isOpening: template.isOpening,
    isClosing: template.isClosing,
    active: template.active,
  };
}

export function ShiftTemplatePanel({ branchId }: { branchId: string }) {
  const queryClient = useQueryClient();
  const { data: templates, isLoading } = useQuery({
    queryKey: ['shift-templates', branchId],
    queryFn: () => listShiftTemplates(branchId),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: ShiftTemplateInput) => createShiftTemplate(branchId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-templates', branchId] });
      setForm(EMPTY_FORM);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ShiftTemplateInput> }) =>
      updateShiftTemplate(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-templates', branchId] });
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
  });

  function startEdit(template: ShiftTemplate) {
    setEditingId(template.id);
    setForm(toFormState(template));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const input: ShiftTemplateInput = {
      name: form.name,
      startTime: form.startTime,
      endTime: form.endTime,
      requiredStaffCount: Number(form.requiredStaffCount),
      requiresKeyHolder: form.requiresKeyHolder,
      isOpening: form.isOpening,
      isClosing: form.isClosing,
      active: form.active,
    };
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input });
      } else {
        await createMutation.mutateAsync(input);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save shift template.');
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      {isLoading && <p className={styles.emptyState}>Loading shift templates...</p>}
      {!isLoading && templates?.length === 0 && (
        <p className={styles.emptyState}>No shift templates yet for this branch.</p>
      )}
      {!isLoading && templates && templates.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th className={styles.headerCell}>Name</th>
              <th className={styles.headerCell}>Hours</th>
              <th className={styles.headerCell}>Staff</th>
              <th className={styles.headerCell}>Flags</th>
              <th className={styles.headerCell}></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr
                key={template.id}
                className={`${styles.row} ${template.active ? '' : styles.inactive}`}
              >
                <td className={styles.cell}>{template.name}</td>
                <td className={styles.cell}>
                  {template.startTime}–{template.endTime}
                </td>
                <td className={styles.cell}>{template.requiredStaffCount}</td>
                <td className={styles.cell}>
                  <div className={styles.badges}>
                    {template.requiresKeyHolder && <span className={styles.badge}>Key holder</span>}
                    {template.isOpening && <span className={styles.badge}>Opening</span>}
                    {template.isClosing && <span className={styles.badge}>Closing</span>}
                    {!template.active && <span className={styles.badge}>Inactive</span>}
                  </div>
                </td>
                <td className={styles.cell}>
                  <button className={styles.editButton} onClick={() => startEdit(template)}>
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
          <label className={styles.label} htmlFor="st-name">
            Name
          </label>
          <input
            className={styles.input}
            id="st-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="st-start">
            Start time
          </label>
          <input
            className={styles.input}
            id="st-start"
            type="text"
            inputMode="numeric"
            placeholder="14:30"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="st-end">
            End time
          </label>
          <input
            className={styles.input}
            id="st-end"
            type="text"
            inputMode="numeric"
            placeholder="22:00"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="st-staff">
            Required staff
          </label>
          <input
            className={styles.input}
            id="st-staff"
            type="number"
            min={1}
            value={form.requiredStaffCount}
            onChange={(e) => setForm({ ...form, requiredStaffCount: e.target.value })}
            required
          />
        </div>

        <div className={styles.checkboxField}>
          <input
            id="st-key-holder"
            type="checkbox"
            checked={form.requiresKeyHolder}
            onChange={(e) => setForm({ ...form, requiresKeyHolder: e.target.checked })}
          />
          <label className={styles.checkboxLabel} htmlFor="st-key-holder">
            Requires key holder
          </label>
        </div>

        <div className={styles.checkboxField}>
          <input
            id="st-opening"
            type="checkbox"
            checked={form.isOpening}
            onChange={(e) => setForm({ ...form, isOpening: e.target.checked })}
          />
          <label className={styles.checkboxLabel} htmlFor="st-opening">
            Opening shift
          </label>
        </div>

        <div className={styles.checkboxField}>
          <input
            id="st-closing"
            type="checkbox"
            checked={form.isClosing}
            onChange={(e) => setForm({ ...form, isClosing: e.target.checked })}
          />
          <label className={styles.checkboxLabel} htmlFor="st-closing">
            Closing shift
          </label>
        </div>

        <div className={styles.checkboxField}>
          <input
            id="st-active"
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          <label className={styles.checkboxLabel} htmlFor="st-active">
            Active
          </label>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.formActions}>
          <button className={styles.submit} type="submit" disabled={isSubmitting}>
            {editingId ? 'Save changes' : 'Add shift template'}
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
