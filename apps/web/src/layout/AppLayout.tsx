import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import styles from './AppLayout.module.css';

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.left}>
          <span className={styles.title}>Shift Scheduler</span>
          <nav className={styles.nav}>
            <NavLink to="/" end className={navLinkClassName}>
              Schedule
            </NavLink>
            <NavLink to="/employees" className={navLinkClassName}>
              Employees
            </NavLink>
            <NavLink to="/branches" className={navLinkClassName}>
              Branches
            </NavLink>
          </nav>
        </div>
        <div className={styles.userInfo}>
          <span className={styles.role}>Role: {user?.role}</span>
          <button className={styles.logout} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
