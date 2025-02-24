"use client";
import React from "react";
import { usePathname } from "next/navigation";

export default function Body({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const containerClass = pathname.startsWith("/portfolio")
    ? ""
    : "max-w-screen-xl mx-auto p-4";

  return <main className={containerClass}>{children}</main>;
}
