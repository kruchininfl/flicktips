// Extra share tags the legacy movie and person pages put into <Helmet> next to what pageMetadata() produces.
import type { Metadata } from 'next';

export function withShareTags(
  metadata: Metadata,
  { image, shareDescription }: { image: string; shareDescription?: string | null },
): Metadata {
  const title = metadata.openGraph?.title;
  const other: Record<string, string> = { ...(metadata.other as Record<string, string>), 'ya:ovs:allow_embed': 'true' };
  if (typeof title === 'string') other['mrc__share_title'] = title;
  if (shareDescription) other['mrc__share_description'] = shareDescription;

  return { ...metadata, other, icons: { other: [{ rel: 'image_src', url: image }] } };
}
