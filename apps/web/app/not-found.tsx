import { PagePlaceholder } from '@/components/gui/PagePlaceholder';

export const metadata = { title: { absolute: 'Страница не найдена — FlickTips' }, robots: { index: false } };

// 404 for unknown URLs and for notFound() / orNotFound() in pages (the legacy SSR answered a bare "Not found").
export default function NotFound() {
  return (
    <div className="content">
      <PagePlaceholder icon="film" text="Страница не найдена" />
    </div>
  );
}
