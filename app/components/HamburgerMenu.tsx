'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import styles from './Header.module.css';
import Icon from './Icon';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Icon>['name'];

export interface MenuItem {
  title: string;
  href: string;
  icon: IconName;
}

interface HamburgerMenuProps {
  menuItems: MenuItem[];
  orientation?: 'vertical' | 'horizontal';
  position?: 'above' | 'right' | 'below';
}

export default function HamburgerMenu({ menuItems, orientation = 'vertical', position = 'below' }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, close]);

  const allowedDomains = ['instagram.com', 'linkedin.com'];
  function shouldOpenInNewTab(href: string): boolean {
    const url = new URL(href, window.location.origin);
    return allowedDomains.some(domain =>
      url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );
  }

  const dropdownClass = `${styles.hamburgerMenuDropdown} ${styles[position]} ${orientation === 'horizontal' ? styles.horizontalDropdown : ''}`;
  
  return (
    <div ref={containerRef} className="hamburgerContainer" style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className={styles.searchButton}>
        <span className="sr-only">Menu</span>
        <Icon name={open ? "cross" : "burger"} size={30} />
      </button>
      {open && (
        <div className={dropdownClass}>
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${styles.buttonBorder}`}
              onClick={() => setOpen(false)}
              target={shouldOpenInNewTab(item.href) ? '_blank' : '_self'}
            >
              <Icon name={item.icon} size={20} className={styles.socialIcon} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
