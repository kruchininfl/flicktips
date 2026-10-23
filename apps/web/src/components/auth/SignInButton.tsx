'use client';

import { Button } from '@/components/gui/Button';
import { useUi } from '@/components/shell/UiProvider';
import { useViewer } from '@/viewer/ViewerProvider';

// "Войти" in the header for guests (web/src/partitions/AuthButtons/SignInButton); the popup is SignInModal.
export function SignInButton() {
  const viewer = useViewer();
  const { openSignIn } = useUi();

  if (viewer) return null;

  return (
    <div className="header__right-item">
      <Button onClick={openSignIn} size="big" color="gray">
        Войти
      </Button>
    </div>
  );
}
