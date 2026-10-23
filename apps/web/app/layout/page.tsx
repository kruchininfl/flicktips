import type { Metadata } from 'next';

import { LayoutShowcase } from './LayoutShowcase';

export const metadata: Metadata = { robots: { index: false } };

// /layout — the UI kit of the redesign
export default function LayoutPage() {
  return <LayoutShowcase />;
}
