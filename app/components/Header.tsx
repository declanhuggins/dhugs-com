// Header: Displays site branding, navigation, and social media links.
'use client';

import Link from 'next/link';
import styles from './Header.module.css';
import ClientTimestamp from './ClientTimestamp';
import HamburgerMenu from './HamburgerMenu';
import Search from './Search';
import Icon from './Icon';

export default function Header() {
  return (
    <div className={styles.headerContainer}>
      <div className={styles.innerWrapper}>
        <div className={styles.borderBox} />

        <div className={styles.headerTopRow}>
          <div className={styles.timestamp}>
            <ClientTimestamp />
          </div>
          <ul className="flex gap-2">
            <li>
              <Link href="https://linkedin.com/in/declanhuggins" target="_blank" rel="noopener noreferrer" className={styles.socialButton}>
                <span className="sr-only">LinkedIn</span>
                <Icon name="linkedin" size={20} className={styles.socialIcon} />
              </Link>
            </li>
            <li>
              <Link href="https://github.com/declanhuggins" target="_blank" rel="noopener noreferrer" className={styles.socialButton}>
                <span className="sr-only">GitHub</span>
                <Icon name="github" size={20} className={styles.socialIcon} />
              </Link>
            </li>
            <li>
              <Link href="https://www.instagram.com/declanhuggins/" target="_blank" rel="noopener noreferrer" className={styles.socialButton}>
                <span className="sr-only">Instagram</span>
                <Icon name="instagram" size={20} className={styles.socialIcon} />
              </Link>
            </li>
          </ul>
        </div>

        <div className={styles.middleRow}>
          <h1 className={styles.headerTitle}>
            <Link href="/" rel="home">Declan Huggins</Link>
          </h1>
          <p className={styles.tagline}>
            Photographer | Computer Scientist
          </p>
        </div>

        <div className={styles.headerBottomRow}>
          <nav className="flex gap-2">
            <Link href="/about" className={`${styles.navLink} ${styles.buttonBorder}`}>About</Link>
            <Link href="/portfolio" className={`${styles.navLink} ${styles.buttonBorder}`}>Portfolio</Link>
            <Link href="/resume" className={`${styles.navLink} ${styles.buttonBorder}`}>Resume</Link>
          </nav>
          <Search />
          {/* Hamburger menu for mobile */}
          <div className={`${styles.hamburgerWrapper} gap-2`}>
            <HamburgerMenu 
              menuItems={[
                { title: 'About', href: '/about', icon: 'user' },
                { title: 'Portfolio', href: '/portfolio', icon: 'camera' },
                { title: 'Resume', href: '/resume', icon: 'resume' },
                { title: 'LinkedIn', href: 'https://linkedin.com/in/declanhuggins', icon: 'linkedin' },
                { title: 'Github', href: 'https://github.com/declanhuggins', icon: 'github' }
              ]}
              orientation="horizontal"
              position="right"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
