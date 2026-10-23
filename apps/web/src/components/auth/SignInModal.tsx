'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { Logo } from '@/components/brand/Logo';
import { useUi } from '@/components/shell/UiProvider';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

import { SignInCard } from './SignInCard';

// The sign-in popup (the sidebar's «Войти», any 401); after signing in the API sends the browser back to the
// current page.
export function SignInModal() {
  const { signInOpen, closeSignIn } = useUi();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return (
    <Dialog open={signInOpen} onOpenChange={(open) => !open && closeSignIn()}>
      <DialogContent className="max-w-[420px] border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">Вход в FlickTips</DialogTitle>
        <SignInCard
          next={pathname + (query ? '?' + query : '')}
          top={<Logo />}
          title="Вход в FlickTips"
          text="Оценивайте фильмы и смотрите, что понравилось друзьям"
          className="bg-card"
        />
      </DialogContent>
    </Dialog>
  );
}
