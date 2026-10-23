'use client';

import { IconBrandTelegram, IconBrandVk, IconBrandWhatsapp, IconCheck, IconCopy } from '@tabler/icons-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { openVkShare } from './vk';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ShareDialogProps {
  title: string;
  description: string;
  link: string;
  // the message that goes with the link in Telegram, WhatsApp and VK
  text: string;
  // the opener
  children: ReactNode;
}

// Figma «Поделиться профилем»: a QR code, the link with a copy button and VK / Telegram / WhatsApp.
export function ShareDialog({ title, description, link, text, children }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onCopied = () => {
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  // without the async clipboard (plain http) the link is selected for a manual copy
  const selectLink = () => {
    input.current?.select();
    try {
      if (document.execCommand('copy')) onCopied();
    } catch {
      // stays selected
    }
  };

  const copy = () => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(onCopied, selectLink);
    else selectLink();
  };

  const encodedLink = encodeURIComponent(link);
  const encodedText = encodeURIComponent(text);

  return (
    <Dialog onOpenChange={(open) => !open && setCopied(false)}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="flex max-w-[480px] flex-col gap-4 p-7 text-center"
        // focusing the link would select it right away
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-3.5">
          <DialogTitle className="px-8">{title}</DialogTitle>
          <DialogDescription className="type-caption">{description}</DialogDescription>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="rounded-md border border-border bg-white p-[7px]">
            <QRCodeSVG value={link} size={170} level="M" />
          </div>
          <p className="type-caption text-faint">Наведите камеру телефона, чтобы открыть ссылку</p>
        </div>

        <div className="flex h-12 items-center gap-2 rounded-md bg-muted pr-1.5 pl-3.5">
          <input
            ref={input}
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            aria-label="Ссылка"
            className="min-w-0 flex-1 bg-transparent type-mono text-foreground outline-none"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={copy}
            aria-label={copied ? 'Скопировано' : 'Скопировать ссылку'}
            title={copied ? 'Скопировано' : 'Скопировать ссылку'}
          >
            {copied ? <IconCheck className="text-positive" /> : <IconCopy />}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 max-[420px]:grid-cols-1">
          <Button variant="outline" size="s" onClick={() => openVkShare(link, text)}>
            <IconBrandVk />
            ВКонтакте
          </Button>
          <Button variant="outline" size="s" asChild>
            <a
              href={`https://t.me/share/url?url=${encodedLink}&text=${encodedText}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBrandTelegram />
              Telegram
            </a>
          </Button>
          <Button variant="outline" size="s" asChild>
            <a href={`https://wa.me/?text=${encodedText}%20${encodedLink}`} target="_blank" rel="noopener noreferrer">
              <IconBrandWhatsapp />
              WhatsApp
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
