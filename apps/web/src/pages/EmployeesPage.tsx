import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listBranches } from '../api/branches';
import { EmployeePanel } from './EmployeePanel';
import styles from './EmployeesPage.module.css';

export function EmployeesPage() {
  const [branchId, setBranchId] = useState('');
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: listBranches });

  useEffect(() => {
    if (!branchId && branches && branches.length > 0) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId]);

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="employees-branch-select">
            Branch
          </label>
          <select
            className={styles.select}
            id="employees-branch-select"
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
      </div>

      {!branchId && <p className={styles.emptyState}>Create a branch first on the Branches page.</p>}
      {branchId && (
        <div className={styles.panel}>
          <EmployeePanel branchId={branchId} />
        </div>
      )}
    </div>
  );
}
