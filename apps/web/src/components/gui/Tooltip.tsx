'use client';

// Hover tooltip replacing react-tippy (dark theme, arrow, "shift" animation) for the few places that used it.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import './Tooltip.scss';

interface TooltipProps {
  title: string;
  children: ReactNode;
  // only 'bottom' is used on the site
  position?: 'bottom';
  // gap between the element and the arrow, px (react-tippy `distance`)
  distance?: number;
  delay?: number;
  hideDelay?: number;
}

interface Placement {
  top: number;
  left: number;
}

export function Tooltip({ title, children, distance = 10, delay = 0, hideDelay = 0 }: TooltipProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      setPlacement({ top: rect.bottom + window.scrollY, left: rect.left + rect.width / 2 + window.scrollX });
      requestAnimationFrame(() => setShown(true));
    }, delay);
  };

  const hide = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setShown(false);
      timer.current = setTimeout(() => setPlacement(null), 350);
    }, hideDelay);
  };

  return (
    <div ref={anchor} className="tooltip-anchor" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {placement
        ? createPortal(
            <div
              className="tippy-popper"
              role="tooltip"
              style={{ top: placement.top + distance - 10, left: placement.left }}
              data-placement="bottom"
            >
              <div className={'tippy-tooltip' + (shown ? ' enter' : ' leave')}>
                <div className="tippy-arrow" />
                <div className="tippy-tooltip-content">{title}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
