// PriorityImageContext: Provides functions to register and track the loading of priority images.
"use client";
import React, { createContext, useState, useCallback } from 'react';

interface IPriorityImageContext {
  register: () => void;
  markLoaded: () => void;
  total: number;
  loaded: number;
}

export const PriorityImageContext = createContext<IPriorityImageContext>({
  register: () => {},
  markLoaded: () => {},
  total: 0,
  loaded: 0,
});

export const PriorityImageProvider = ({ children }: { children: React.ReactNode }) => {
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(0);

  const register = useCallback(() => {
    setTotal(prev => prev + 1);
  }, []);

  const markLoaded = useCallback(() => {
    setLoaded(prev => prev + 1);
  }, []);

  return (
    <PriorityImageContext.Provider value={{ register, markLoaded, total, loaded }}>
      {children}
    </PriorityImageContext.Provider>
  );
};
