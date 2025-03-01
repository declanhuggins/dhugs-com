'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from './Header.module.css';

export default function Search() {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search/?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className={styles.searchContainer}>
      {isExpanded ? (
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className={styles.searchInput}
          />
          <button type="submit" className={`${styles.searchButton} ${styles.searchButtonExtra}`}>
            <Image
              src="/icons/magnifying.svg"
              alt="Search"
              width={20}
              height={20}
              className={`svg-foreground ${styles.socialIcon}`}
            />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className={`${styles.searchButton} ${styles.searchButtonExtra}`}
          >
            <Image
              src="/icons/cross.svg"
              alt="Close"
              width={20}
              height={20}
              className={`svg-foreground ${styles.socialIcon} ${styles.closeIcon}`}
            />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className={styles.searchButton}
        >
          <Image
            src="/icons/magnifying.svg"
            alt="Search"
            width={20}
            height={20}
            className={`svg-foreground ${styles.socialIcon}`}
          />
        </button>
      )}
    </div>
  );
}
