'use client';

import { useState } from 'react';

import type { ViewerProfile } from '@flicktips/shared';

import { Button } from '@/components/gui/Button';
import { Icon } from '@/components/gui/Icon';
import { Modal } from '@/components/gui/Modal';
import { ShareIcon } from '@/components/gui/ShareIcon';
import { useViewer } from '@/viewer/ViewerProvider';

import { TelegramBlock } from './TelegramBlock';

// the Telegram bot is tried out by the site owner first; nobody else sees the opener for now
const TELEGRAM_USER_IDS = [1];

export function canUseTelegram(viewer: ViewerProfile | null): boolean {
  return !!viewer && TELEGRAM_USER_IDS.includes(Number(viewer.id));
}

interface TelegramButtonProps {
  className?: string;
  // render the opener as a Telegram-blue button with these extra classes instead of a text link
  buttonClass?: string;
}

// A text link or a Telegram-colored button that opens the Telegram block in a popup. The block loads its data on
// mount, so nothing is requested until the popup is opened.
export function TelegramButton({ className, buttonClass }: TelegramButtonProps) {
  const viewer = useViewer();
  const [isOpen, setIsOpen] = useState(false);

  if (!canUseTelegram(viewer)) return null;

  return (
    <span>
      {buttonClass === undefined ? (
        <span className={className} onClick={() => setIsOpen(true)}>
          Оценки в Telegram
        </span>
      ) : (
        <Button onClick={() => setIsOpen(true)} className={'tg-open-btn ' + buttonClass}>
          <span className="btn__icn tg-open-btn__icn">
            <ShareIcon name="telegram" />
          </span>
          Оценки в Telegram
        </Button>
      )}

      {/* clicks in the popup portal bubble through React parents */}
      <span onClick={(e) => e.stopPropagation()}>
        <Modal isOpen={isOpen} onRequestClose={() => setIsOpen(false)} contentLabel="Telegram">
          <div className="p-signin">
            <Icon name="cross" className="ReactModal__Close" onClick={() => setIsOpen(false)} />
            <div className="p-signin__inn tg-popup">
              <TelegramBlock />
            </div>
          </div>
        </Modal>
      </span>
    </span>
  );
}
