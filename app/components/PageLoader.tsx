"use client";
import React from 'react';
import { PriorityImageProvider } from './PriorityImageContext';
import styles from './PageLoader.module.css';

export default function PageLoader({ children }: { children: React.ReactNode }) {
  // Loading overlay is temporarily disabled.
  return (
    <PriorityImageProvider>
      <div className={styles.wrapper}>
        {children}
        {/*
        // ...previous loading overlay code disabled...
        {!hideLoader && (
          <div className={styles.overlay}>
            Loading...
          </div>
        )}
        */}
      </div>
    </PriorityImageProvider>
  );
}
