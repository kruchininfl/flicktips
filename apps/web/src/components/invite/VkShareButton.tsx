'use client';

import type { ReactNode } from 'react';

// VK's share dialog in a centered popup window.
export function openVkShare(url: string, title?: string) {
  const params = new URLSearchParams({ url });
  if (title) params.set('title', title);
  const width = 660;
  const height = 460;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  window.open(
    'https://vk.com/share.php?' + params,
    'vk-share',
    `width=${width},height=${height},left=${left},top=${top},location=no,toolbar=no,status=no,directories=no,menubar=no,scrollbars=yes,resizable=no,centerscreen=yes,chrome=yes`,
  );
}

// react-share's VKShareButton: a div that opens VK's share dialog.
export function VkShareButton({ url, title, children }: { url: string; title?: string; children: ReactNode }) {
  const open = () => openVkShare(url, title);

  return (
    <div
      role="button"
      tabIndex={0}
      className="SocialMediaShareButton SocialMediaShareButton--vk"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open();
      }}
    >
      {children}
    </div>
  );
}
