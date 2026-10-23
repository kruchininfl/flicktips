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
