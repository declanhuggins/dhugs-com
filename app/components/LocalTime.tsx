'use client';

import { useEffect, useState } from 'react';

interface LocalTimeProps {
  dateTime: string; // ISO 8601 UTC string
  prefix?: string;  // e.g. "Updated on"
}

export default function LocalTime({ dateTime, prefix }: LocalTimeProps) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date(dateTime);
    if (isNaN(d.getTime())) return;
    setFormatted(
      d.toLocaleString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    );
  }, [dateTime]);

  if (!formatted) return null;

  return <>{prefix ? `${prefix} ${formatted}` : formatted}</>;
}
