"use client";
import { usePathname } from "next/navigation";
import React from "react";

interface ContainerProps {
  children: React.ReactNode;
}

export default function Container({ children }: ContainerProps) {
  const pathname = usePathname();
  const isPortfolio = pathname.startsWith("/portfolio");
  return (
    <main className={isPortfolio ? "" : "max-w-screen-xl mx-auto p-4"}>
      {children}
    </main>
  );
}
