'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './Header.module.css';

export interface MenuItem {
  title: string;
  href: string;
  icon: string;
}

interface HamburgerMenuProps {
  menuItems: MenuItem[];
  orientation?: 'vertical' | 'horizontal';
  position?: 'above' | 'right' | 'below';
}

export default function HamburgerMenu({ menuItems, orientation = 'vertical', position = 'below' }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const dropdownClass = `${styles.hamburgerMenuDropdown} ${styles[position]} ${orientation === 'horizontal' ? styles.horizontalDropdown : ''}`;
  return (
    <div className="hamburgerContainer" style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} className={styles.searchButton}>
        <span className="sr-only">Menu</span>
        <Image 
          key={open ? "cross" : "burger"}
          src={open ? "/icons/cross.svg" : "/icons/burger.svg"} 
          alt="Menu" 
          width={30} 
          height={30} 
          className="svg-foreground" 
        />
      </button>
      {open && (
        <div className={dropdownClass}>
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${styles.buttonBorder}`}
              onClick={() => setOpen(false)}
              target={item.href.includes('instagram.com') || item.href.includes('linkedin.com') ? '_blank' : '_self'}
            >
              <Image
                src={item.icon}
                alt={item.title}
                width={20}
                height={20}
                className={`svg-foreground ${styles.socialIcon}`}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
