'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import NoChromeStyle from './NoChromeStyle';

function pickRandom<T>(arr: T[]): T | undefined {
  return arr.length ? arr[Math.floor(Math.random()*arr.length)] : undefined;
}

async function loadUrlList(): Promise<string[] | null> {
  try {
    const res = await fetch('/random-image.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data.filter(u => typeof u === 'string' && u.startsWith('http')) as string[];
  } catch { return null; }
}

export default function RandomImagePage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
  const urls = await loadUrlList();
      if (!mounted) return;
  const chosen = urls ? pickRandom(urls) : undefined;
  if (chosen) setImageUrl(chosen);
      setLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  if (!loaded) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!imageUrl) return <div className="flex items-center justify-center min-h-screen">No image</div>;

  return (
    <>
      <NoChromeStyle />
      <div className="flex items-center justify-center min-h-screen w-screen h-screen">
        {/* Intrinsic size unknown from URL list; use fill container with object-contain */}
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src={imageUrl}
            alt="Random image"
            fill
            sizes="100vw"
            className="object-contain"
            priority
            unoptimized
          />
        </div>
      </div>
    </>
  );
}
