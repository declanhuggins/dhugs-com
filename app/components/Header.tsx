// app/components/Header.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './Header.module.css';

export default function Header() {
  const [timestamp, setTimestamp] = useState('YYYY-MM-DDTHH:MM:SS±HH:MM');

  useEffect(() => {
    const now = new Date();
  
    // Helper to pad numbers with a leading zero
    const pad = (num: number) => String(num).padStart(2, '0');
  
    // Build the local date string in ISO format (without timezone)
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1); // Months are 0-indexed
    const day = pad(now.getDate());
    const hour = pad(now.getHours());
    const minute = pad(now.getMinutes());
    const second = pad(now.getSeconds());
    const base = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  
    // Calculate the timezone offset
    // getTimezoneOffset() returns the offset in minutes from local time to UTC.
    // Multiplying by -1 gives the correct sign.
    const offsetMinutes = now.getTimezoneOffset() * -1;
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
    const offsetMins = pad(Math.abs(offsetMinutes) % 60);
  
    // Combine the local date string with the offset
    const localIso = `${base}${sign}${offsetHours}:${offsetMins}`;
    setTimestamp(localIso);
  }, []);

  return (
    <div className={styles.headerContainer}>
      <div className={styles.innerWrapper}>
        {/* Inner border box */}
        <div className={styles.borderBox} />

        {/* Top Row: Timestamp & Social Icons */}
        <div className={styles.headerTopRow}>
          <div className={styles.timestamp}>{timestamp}</div>
          <ul className="flex gap-2">
            <li>
              <Link
                href="https://www.instagram.com/declanhuggins/"
                target="_blank"
                className={styles.socialButton}
              >
                <span className="sr-only">Instagram</span>
                <Image
                  src="/instagram.svg"
                  alt="Instagram"
                  width={20}
                  height={20}
                  className={`invert ${styles.socialIcon}`}
                />
              </Link>
            </li>
            <li>
              <Link
                href="https://github.com/declanhuggins"
                target="_blank"
                className={styles.socialButton}
              >
                <span className="sr-only">GitHub</span>
                <Image
                  src="/github.svg"
                  alt="GitHub"
                  width={20}
                  height={20}
                  className={`invert ${styles.socialIcon}`}
                />
              </Link>
            </li>
            <li>
              <Link
                href="https://linkedin.com/in/declanhuggins"
                target="_blank"
                className={styles.socialButton}
              >
                <span className="sr-only">LinkedIn</span>
                <Image
                  src="/linkedin.svg"
                  alt="LinkedIn"
                  width={20}
                  height={20}
                  className={`invert ${styles.socialIcon}`}
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
          <p className={`${styles.tagline}`}>
            Photographer | Computer Scientist
          </p>
        </div>

        {/* Bottom Row: Navigation & Search */}
        <div className={styles.headerBottomRow}>
          <nav className="flex gap-2">
            <Link href="/about" className={`${styles.navLink} ${styles.buttonBorder}`}>
              About
            </Link>
            <Link href="/portfolio" className={`${styles.navLink} ${styles.buttonBorder}`}>
              Portfolio
            </Link>
            <Link href="/minecraft" className={`${styles.navLink} ${styles.buttonBorder}`}>
              Minecraft
            </Link>
            <Link href="/map" className={`${styles.navLink} ${styles.buttonBorder}`}>
              Map
            </Link>
          </nav>
          <Link href="#" title="Search" className={styles.searchButton}>
            <Image
              src="/magnifying.svg"
              alt="Search"
              width={20}
              height={20}
              className="invert"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}