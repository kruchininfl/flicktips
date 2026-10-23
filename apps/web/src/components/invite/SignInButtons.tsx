import { OAuthButton } from '@/components/auth/OAuthButton';

// The two provider buttons of the invite and Telegram landing pages.
export function SignInButtons({ next }: { next: string }) {
  return (
    <>
      <div>
        <OAuthButton provider="vkontakte" next={next}>
          Войти через Вконтакте
        </OAuthButton>
      </div>
      <div>
        <OAuthButton provider="yandex" next={next}>
          Войти с Яндекс ID
        </OAuthButton>
      </div>
    </>
  );
}
