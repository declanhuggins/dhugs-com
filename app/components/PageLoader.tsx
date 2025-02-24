"use client";
import React, { useContext, useEffect, useState } from 'react';
import { PriorityImageProvider, PriorityImageContext } from './PriorityImageContext';
import styles from './PageLoader.module.css';

export default function PageLoader({ children }: { children: React.ReactNode }) {
  const [hideLoader, setHideLoader] = useState(false);
  const { total, loaded } = useContext(PriorityImageContext);

  useEffect(() => {
    // If no priority images registered, or all loaded, hide loader.
    if (total === 0 || loaded === total) {
      setHideLoader(true);
    }
  }, [total, loaded]);

  return (
    <PriorityImageProvider>
      <div className={styles.wrapper}>
        {children}
        {!hideLoader && (
          <div className={styles.overlay}>
            Loading...
          </div>
        )}
      </div>
    </PriorityImageProvider>
  );
}
