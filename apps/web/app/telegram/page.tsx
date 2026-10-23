import { TelegramConfirm } from '@/components/telegram/TelegramConfirm';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata({ title: 'Telegram · FlickTips', noindex: true });

// /telegram?code= — web/src/components/TelegramPage: confirms the bot's code, or remembers it for guests
export default async function TelegramPage({ searchParams }: PageProps<'/telegram'>) {
  const { code } = await searchParams;
  return (
    <div className="p-invite">
      <TelegramConfirm code={(Array.isArray(code) ? code[0] : code) ?? ''} />
    </div>
  );
}
