'use client';

// Stand-in for react-modal 3 with the same DOM, class names and inline default styles, so the legacy
// .ReactModal__* rules in styles/app.scss apply unchanged: a portal div.ReactModalPortal on <body>, an overlay
// and a content box that get --after-open once mounted, body.ReactModal__Body--open while open.
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.75)',
};

const CONTENT_STYLE: CSSProperties = {
  position: 'absolute',
  top: '40px',
  left: '40px',
  right: '40px',
  bottom: '40px',
  border: '1px solid #ccc',
  background: '#fff',
  overflow: 'auto',
  WebkitOverflowScrolling: 'touch',
  borderRadius: '4px',
  outline: 'none',
  padding: '20px',
};

interface ModalProps {
  isOpen: boolean;
  onRequestClose?: () => void;
  // react-modal's default; only works with onRequestClose
  shouldCloseOnOverlayClick?: boolean;
  contentLabel?: string;
  children?: ReactNode;
}

// open modals, so the body class stays while any of them is open
let openCount = 0;

export function Modal({
  isOpen,
  onRequestClose,
  shouldCloseOnOverlayClick = true,
  contentLabel,
  children,
}: ModalProps) {
  const [afterOpen, setAfterOpen] = useState(false);
  // callers pass inline functions; the effect below must not re-run for each of them
  const closeRef = useRef(onRequestClose);
  useEffect(() => {
    closeRef.current = onRequestClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    openCount += 1;
    document.body.classList.add('ReactModal__Body--open');
    // a frame later, so the --after-open transitions run
    const frame = requestAnimationFrame(() => setAfterOpen(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      setAfterOpen(false);
      openCount -= 1;
      if (!openCount) document.body.classList.remove('ReactModal__Body--open');
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const onOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget && shouldCloseOnOverlayClick) onRequestClose?.();
  };

  return createPortal(
    <div className="ReactModalPortal">
      <div
        className={'ReactModal__Overlay' + (afterOpen ? ' ReactModal__Overlay--after-open' : '')}
        style={OVERLAY_STYLE}
        onClick={onOverlayClick}
      >
        <div
          className={'ReactModal__Content' + (afterOpen ? ' ReactModal__Content--after-open' : '')}
          style={CONTENT_STYLE}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={contentLabel}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
