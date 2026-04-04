'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Header.module.css';
import Icon from './Icon';

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
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            autoComplete="off"
            aria-label="Search posts and albums"
            className={styles.searchInput}
          />
          <button type="submit" className={`${styles.searchButton} ${styles.searchButtonExtra}`}>
            <Icon name="magnifying" size={20} label="Search" className={styles.socialIcon} />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className={`${styles.searchButton} ${styles.searchButtonExtra}`}
          >
            <Icon name="cross" size={20} label="Close" className={`${styles.socialIcon} ${styles.closeIcon}`} />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className={styles.searchButton}
        >
          <Icon name="magnifying" size={20} label="Search" className={styles.socialIcon} />
        </button>
      )}
    </div>
  );
}
