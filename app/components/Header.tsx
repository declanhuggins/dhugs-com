'use client';

import Link from 'next/link';
import Image from 'next/image';
import styles from './Header.module.css';
import ClientTimestamp from './ClientTimestamp';

export default function Header() {
  return (
    <div className={styles.headerContainer}>
      <div className={styles.innerWrapper}>
        {/* Inner border box */}
        <div className={styles.borderBox} />

        {/* Top Row: Timestamp & Social Icons */}
        <div className={styles.headerTopRow}>
          <div className={styles.timestamp}>
            <ClientTimestamp />
          </div>
          <ul className="flex gap-2">
            <li>
              <Link href="https://www.instagram.com/declanhuggins/" target="_blank" className={styles.socialButton}>
                <span className="sr-only">Instagram</span>
                <Image
                  src="/instagram.svg"
                  alt="Instagram"
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
                  src="/github.svg"
                  alt="GitHub"
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
                  src="/linkedin.svg"
                  alt="LinkedIn"
                  width={20}
                  height={20}
                  className={`svg-foreground ${styles.socialIcon}`}
                />
              </Link>
            </li>
          </ul>
        </div>

        {/* Middle Row: Branding */}
        <div className={styles.middleRow}>
          <h1 className={styles.headerTitle}>
            <Link href="/" rel="home">Declan Huggins</Link>
          </h1>
          <p className={styles.tagline}>
            Photographer | Computer Scientist
          </p>
        </div>

        {/* Bottom Row: Navigation & Search */}
        <div className={styles.headerBottomRow}>
          <nav className="flex gap-2">
            <Link href="/about" className={`${styles.navLink} ${styles.buttonBorder}`}>About</Link>
            <Link href="/portfolio" className={`${styles.navLink} ${styles.buttonBorder}`}>Portfolio</Link>
            <Link href="/minecraft" className={`${styles.navLink} ${styles.buttonBorder}`}>Minecraft</Link>
            <Link href="/map" className={`${styles.navLink} ${styles.buttonBorder}`}>Map</Link>
          </nav>
          <Link href="#" title="Search" className={styles.searchButton}>
            <Image
              src="/magnifying.svg"
              alt="Search"
              width={20}
              height={20}
              className={`svg-foreground ${styles.socialIcon}`}
            />
          </Link>
        </div>
      </div>
    </div>
  );
}