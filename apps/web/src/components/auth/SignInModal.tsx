'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { Modal } from '@/components/gui/Modal';
import { useUi } from '@/components/shell/UiProvider';

import { SignInPanel } from './SignInPanel';

// The sign-in popup (opened by the header button, the tab bar, the "join" banner and any 401); after signing
// in the API sends the browser back to the current page.
export function SignInModal() {
  const { signInOpen, closeSignIn } = useUi();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return (
    <Modal isOpen={signInOpen} contentLabel="Sign in">
      <SignInPanel next={pathname + (query ? '?' + query : '')} onClose={closeSignIn} />
    </Modal>
  );
}
