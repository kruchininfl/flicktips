import { TelegramPage } from '@/components/telegram/TelegramPage';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata({ title: 'Telegram · FlickTips', noindex: true });

// /telegram?code= — Figma «Telegram-бот»; the bot's code from a group is confirmed here
export default async function Telegram({ searchParams }: PageProps<'/telegram'>) {
  const { code } = await searchParams;
  return <TelegramPage code={(Array.isArray(code) ? code[0] : code) ?? ''} />;
}
