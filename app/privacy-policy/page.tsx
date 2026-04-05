import React from 'react';
import type { Metadata } from 'next';
import { markdownToSafeHtml } from '../../lib/markdown';
import ProseContent from '../components/ProseContent';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy outlining data collection, usage, and security practices for dhugs.com.',
  alternates: { canonical: '/privacy-policy' },
  openGraph: {
    title: 'Privacy Policy',
    description: 'Privacy Policy outlining data collection, usage, and security practices for dhugs.com.',
  },
};

const PRIVACY_POLICY_MD = `# Privacy Policy

_Last updated: 1 January 2025_

This Privacy Policy explains what personal data may be collected by our website, how we use that data, and the measures we take to protect your information, including data collection through services such as Cloudflare.

## Information We May Collect

- **Personal Information:** We may collect contact information such as your name and email address if you voluntarily provide it.
- **Usage Data:** Like many websites, we collect data regarding your interactions with the site, including pages visited and time spent on pages.
- **Log Data:** Our servers automatically record information that your browser sends whenever you visit our website. This may include information such as your computer's IP address, browser type, and the pages you visit.
- **Cloudflare Data:** In order to improve performance and security, Cloudflare may collect certain data related to your browsing behavior such as IP addresses, cookies, and device details.

## How We Use Your Information

- To provide, maintain, and improve our services.
- To monitor and analyze trends, user activities, and website usage.
- To enhance our website's performance and security.
- To communicate with users, if required, regarding updates and important information related to our services.

## Data Protection and Security

We take appropriate measures to protect your data from unauthorized access or disclosure. While Cloudflare assists in securing and optimizing our website, please be aware that no method of transmission over the internet or storage is 100% secure.

## Third-Party Services

Our website may include links to third-party services, which have their own privacy policies. We advise you to review the privacy policies of these third parties as we are not responsible for their practices.

## Changes to This Privacy Policy

We may update this Privacy Policy periodically. Any changes will be posted on this page with an updated revision date.

## Contact Us

If you have any questions regarding this Privacy Policy, please contact us at security@dhugs.com.`;

export default async function PrivacyPolicyPage() {
  const contentHtml = await markdownToSafeHtml(PRIVACY_POLICY_MD);
  return (
    <div className="mx-auto max-w-3xl px-4">
      <ProseContent
        contentHtml={contentHtml}
        className="w-full mx-auto max-w-none"
      />
    </div>
  );
}
