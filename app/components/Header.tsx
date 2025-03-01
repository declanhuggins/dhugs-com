// Header: Displays site branding, navigation, and social media links.
'use client';

import Link from 'next/link';
import Image from 'next/image';
import styles from './Header.module.css';
import ClientTimestamp from './ClientTimestamp';
import HamburgerMenu from './HamburgerMenu';
import Search from './Search';

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
              <Link href="https://www.instagram.com/declanhuggins/" target="_blank" className={styles.socialButton}>
                <span className="sr-only">Instagram</span>
                <Image
                  src="/icons/instagram.svg"
                  alt="Instagram"
                  width={20}
                  height={20}
                  className={`svg-foreground ${styles.socialIcon}`}
                />
              </Link>
            </li>
            <li>
              <Link href="https://linkedin.com/in/declanhuggins" target="_blank" className={styles.socialButton}>
                <span className="sr-only">LinkedIn</span>
                <Image
                  src="/icons/linkedin.svg"
                  alt="LinkedIn"
                  width={20}
                  height={20}
                  className={`svg-foreground ${styles.socialIcon}`}
                />
              </Link>
            </li>
            <li>
              <Link href="https://github.com/declanhuggins" target="_blank" className={styles.socialButton}>
                <span className="sr-only">GitHub</span>
                <Image
                  src="/icons/github.svg"
                  alt="GitHub"
                  width={20}
                  height={20}
                  className={`svg-foreground ${styles.socialIcon}`}
                />
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
            <Link href="https://map.dhugs.com" className={`${styles.navLink} ${styles.buttonBorder}`}>Map</Link>
          </nav>
          <Search />
          {/* Hamburger menu for mobile */}
          <div className={`${styles.hamburgerWrapper} gap-2`}>
            <HamburgerMenu 
              menuItems={[
                { title: 'About', href: '/about', icon: '/icons/user.svg' },
                { title: 'Portfolio', href: '/portfolio', icon: '/icons/camera.svg' },
                { title: 'Map', href: 'https://map.dhugs.com', icon: '/icons/map.svg' },
                { title: 'Instagram', href: 'https://www.instagram.com/declanhuggins/', icon: '/icons/instagram.svg' },
                { title: 'LinkedIn', href: 'https://linkedin.com/in/declanhuggins', icon: '/icons/linkedin.svg' }
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