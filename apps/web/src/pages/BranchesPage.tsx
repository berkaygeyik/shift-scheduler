import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBranch, listBranches } from '../api/branches';
import { ApiError } from '../lib/api-client';
import { ShiftTemplatePanel } from './ShiftTemplatePanel';
import styles from './BranchesPage.module.css';

export function BranchesPage() {
  const queryClient = useQueryClient();
  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: listBranches,
  });

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Europe/Berlin');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createBranch,
    onSuccess: (branch) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setName('');
      setSelectedBranchId(branch.id);
    },
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({ name, timezone });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create branch.');
    }
  }

  const selectedBranch = branches?.find((b) => b.id === selectedBranchId);

  return (
    <div className={styles.layout}>
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Branches</h2>

        {isLoading && <p className={styles.emptyState}>Loading branches...</p>}
        {!isLoading && branches?.length === 0 && (
          <p className={styles.emptyState}>No branches yet — create one to get started.</p>
        )}
        {!isLoading && branches && branches.length > 0 && (
          <div className={styles.branchList}>
            {branches.map((branch) => (
              <div
                key={branch.id}
                className={`${styles.branchItem} ${
                  branch.id === selectedBranchId ? styles.branchItemActive : ''
                }`}
                onClick={() => setSelectedBranchId(branch.id)}
              >
                {branch.name}
              </div>
            ))}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="branch-name">
              Name
            </label>
            <input
              className={styles.input}
              id="branch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="branch-timezone">
              Timezone
            </label>
            <input
              className={styles.input}
              id="branch-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Europe/Berlin"
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submit} type="submit" disabled={createMutation.isPending}>
            Add branch
          </button>
        </form>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>
          Shift templates{selectedBranch ? ` — ${selectedBranch.name}` : ''}
        </h2>
        {!selectedBranch && (
          <p className={styles.emptyState}>Select a branch to manage its shift templates.</p>
        )}
        {selectedBranch && <ShiftTemplatePanel branchId={selectedBranch.id} />}
      </section>
    </div>
  );
}
