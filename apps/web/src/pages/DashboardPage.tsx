import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Welcome</h1>
      <p className={styles.subtitle}>Role: {user?.role}</p>
      <button className={styles.logout} onClick={handleLogout}>
        Log out
      </button>
    </div>
  );
}
