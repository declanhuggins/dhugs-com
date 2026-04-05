import { CDN_BASE } from '../../lib/constants';
import PretextAbout from '../components/PretextAbout';

export default function AboutPage() {
  const cdn = CDN_BASE;
  return (
    <div className="max-w-5xl mx-auto">
      <PretextAbout
        img1Src={`${cdn}/l/about/AboutOne.avif`}
        img2Src={`${cdn}/l/about/AboutTwo.avif`}
        img1Alt="Declan Huggins at Notre Dame"
        img2Alt="Declan Huggins with family"
      />
    </div>
  );
}

import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'About',
  description: 'Learn more about Declan Huggins, a computer scientist and photographer at Notre Dame.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About',
    description: 'Learn more about Declan Huggins, a computer scientist and photographer at Notre Dame.',
  },
};
