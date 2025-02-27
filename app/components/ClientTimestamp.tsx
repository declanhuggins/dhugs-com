// ClientTimestamp: Computes and displays the current timestamp in a specific format.
'use client';

import { useEffect, useState } from 'react';

function computeTimestamp() {
  const now = new Date();
  const pad = (num: number) => String(num).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());
  const base = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const offsetMinutes = now.getTimezoneOffset() * -1;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
  const offsetMins = pad(Math.abs(offsetMinutes) % 60);
  return `${base}${sign}${offsetHours}:${offsetMins}`;
}

export default function ClientTimestamp() {
  const placeholder = "YYYY-MM-DDTHH:MM:SS±HH:MM";
  const [timestamp, setTimestamp] = useState(placeholder);

  useEffect(() => {
    setTimestamp(computeTimestamp());
  }, []);

  return <span style={{ opacity: timestamp === placeholder ? 0 : 1 }}>{timestamp}</span>;
}
