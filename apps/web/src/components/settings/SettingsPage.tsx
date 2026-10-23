'use client';

import { useState } from 'react';

import type { LoginService, LoginServices, ViewerProfile } from '@flicktips/shared';

import { useViewer } from '@/viewer/ViewerProvider';

import { DeleteAccount } from './DeleteAccount';
import { LinkedServices } from './LinkedServices';
import { ProfileCard } from './ProfileCard';
import { SignInMethods } from './SignInMethods';

// Figma «Настройки»: sign-in methods and services on the left, the profile and the deletion on the right (one
// column below 1280px).
export function SettingsPage({
  viewer: initialViewer,
  services: initialServices,
  avatars,
  linkProof,
  linkError,
}: {
  viewer: ViewerProfile;
  services: LoginServices;
  avatars: Record<LoginService, string | null>;
  linkProof: string | null;
  linkError: string | null;
}) {
  const viewer = useViewer() ?? initialViewer;
  const [services, setServices] = useState(initialServices);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="type-h1-mobile sm:type-h1">Настройки</h1>
        <p className="text-muted-foreground">Профиль, способы входа и связанные сервисы</p>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <SignInMethods
            services={services}
            onServicesChange={setServices}
            linkProof={linkProof}
            linkError={linkError}
          />
          <LinkedServices />
        </div>
        <div className="flex flex-col gap-6">
          <ProfileCard key={viewer.id} viewer={viewer} avatars={avatars} />
          <DeleteAccount />
        </div>
      </div>
    </div>
  );
}
