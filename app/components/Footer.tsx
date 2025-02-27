// Footer: Displays copyright information and a theme toggle.
import ThemeToggle from './ThemeToggle';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        {new Date().getFullYear()} © Declan Huggins
      </div>
      <div className={styles.themeToggle}>
        <ThemeToggle />
      </div>
    </footer>
  );
}