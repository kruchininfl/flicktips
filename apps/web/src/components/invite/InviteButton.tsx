'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';

import { api } from '@/api/browser';
import { Button } from '@/components/gui/Button';
import { Icon } from '@/components/gui/Icon';
import { Modal } from '@/components/gui/Modal';
import { ShareIcon } from '@/components/gui/ShareIcon';
import { SITE_URL } from '@/lib/config';
import { useViewer } from '@/viewer/ViewerProvider';

import { VkShareButton } from './VkShareButton';
import './InviteButton.scss';

const SHARE_TEXT = 'Делюсь оценками фильмов на FlickTips — подписывайся!';

// the viewer's own invite code, loaded once per page load
let cached: { viewerId: number; code: string } | null = null;

interface InviteButtonProps {
  // render the opener as an inline text link with this text instead of a button
  linkText?: string;
  linkClass?: string;
  // replaces the default classes of the button opener
  buttonClass?: string;
}

// Signed-in users get a button that opens a popup with their personal invite link: whoever signs in through it
// and the inviter follow each other. Guests just share the site (web/src/partitions/InviteButton).
export function InviteButton({ linkText, linkClass, buttonClass }: InviteButtonProps) {
  const viewer = useViewer();
  const [loadedCode, setCode] = useState<string | null>(null);
  const code = loadedCode ?? (cached && cached.viewerId === viewer?.id ? cached.code : null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  if (!viewer) {
    return (
      <div className="share-buttons">
        <VkShareButton url={SITE_URL}>
          <Button className="invite-btn p-signin__btn p-signin__btn_vk" icn="soc_vk">
            Рассказать во Вконтакте
          </Button>
        </VkShareButton>
      </div>
    );
  }

  const link = `${SITE_URL}/invite/${code}`;

  const handleOpen = () => {
    if (loading) return;
    if (code) {
      setIsOpen(true);
      return;
    }
    setLoading(true);
    api.me
      .invite()
      .then((response) => {
        cached = { viewerId: viewer.id, code: response.code };
        setCode(response.code);
        setIsOpen(!!response.code);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  const handleClose = () => {
    setIsOpen(false);
    setCopied(false);
  };

  const onCopied = () => {
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const copyWithSelection = () => {
    input.current?.select();
    try {
      if (document.execCommand('copy')) onCopied();
    } catch {
      // the link stays selected for a manual copy
    }
  };

  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(onCopied, copyWithSelection);
    } else {
      copyWithSelection();
    }
  };

  const encodedLink = encodeURIComponent(link);
  const encodedText = encodeURIComponent(SHARE_TEXT);

  // clicks in the popup portal bubble through React parents (e.g. the header menu toggle)
  const popup = (
    <span onClick={(e) => e.stopPropagation()}>
      <Modal isOpen={isOpen && !!code} onRequestClose={handleClose} contentLabel="Invite friends">
        <div className="p-signin">
          <Icon name="cross" className="ReactModal__Close" onClick={handleClose} />

          <div className="p-signin__inn invite">
            <div className="invite__title">Пригласите друзей</div>
            <div className="invite__text">
              Отправьте личную ссылку — когда друг войдёт по ней, вы подпишетесь друг на друга.
            </div>

            <div className="invite__qr">
              <QRCodeSVG value={link} size={160} level="M" />
              <div className="invite__qr-text">Наведите камеру телефона, чтобы открыть ссылку</div>
            </div>

            <div className="invite__link">
              <input
                ref={input}
                className="invite__link-input"
                type="text"
                value={link}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <span
                className={'invite__link-copy' + (copied ? ' m-copied' : '')}
                onClick={handleCopy}
                title={copied ? 'Скопировано' : 'Скопировать ссылку'}
              >
                <ShareIcon name={copied ? 'check' : 'copy'} />
              </span>
            </div>
            <div className="invite__link-status">{copied ? 'Ссылка скопирована' : ''}</div>

            <div className="invite__share">
              <VkShareButton url={link} title={SHARE_TEXT}>
                <Button className="p-signin__btn p-signin__btn_vk invite__share-btn" icn="soc_vk">
                  ВКонтакте
                </Button>
              </VkShareButton>
              <a
                href={`https://t.me/share/url?url=${encodedLink}&text=${encodedText}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="p-signin__btn invite__share-btn invite__share-btn_tg">
                  <span className="btn__icn invite__share-icn">
                    <ShareIcon name="telegram" />
                  </span>
                  Telegram
                </Button>
              </a>
              <a href={`https://wa.me/?text=${encodedText}%20${encodedLink}`} target="_blank" rel="noopener noreferrer">
                <Button className="p-signin__btn invite__share-btn invite__share-btn_wa">
                  <span className="btn__icn invite__share-icn">
                    <ShareIcon name="whatsapp" />
                  </span>
                  WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </div>
      </Modal>
    </span>
  );

  if (linkText) {
    return (
      <span>
        <span className={linkClass || 'link'} onClick={handleOpen}>
          {linkText}
        </span>
        {popup}
      </span>
    );
  }

  return (
    <div className={buttonClass ? '' : 'share-buttons'}>
      <Button
        onClick={handleOpen}
        loading={loading}
        color="blue"
        className={buttonClass || 'invite-btn invite__open-btn'}
      >
        Пригласить друзей
      </Button>
      {popup}
    </div>
  );
}
