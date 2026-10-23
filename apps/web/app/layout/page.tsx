import type { Metadata } from 'next';

import { LayoutShowcase } from './LayoutShowcase';

export const metadata: Metadata = { robots: { index: false } };

// /layout — the GUI kit page of the legacy site (web/src/components/LayoutPage)
export default function LayoutPage() {
  return <LayoutShowcase />;
}
