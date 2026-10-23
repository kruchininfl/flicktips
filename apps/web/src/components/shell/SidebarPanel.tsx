import type { ReactNode } from 'react';

import { Icon } from '@/components/gui/Icon';

import './SidebarPanel.scss';

interface SidebarPanelProps {
  opened?: boolean;
  title?: string;
  children?: ReactNode;
  closeSidebar: () => void;
}

// The slide-in panel from the right edge (web/src/partitions/SidebarPanel). No page of the legacy site uses it
// now (HeaderNotifications, its only user, is not in the header).
export function SidebarPanel({ opened, title, children, closeSidebar }: SidebarPanelProps) {
  return (
    <div className={'sidepanel' + (opened ? ' m-opened' : '')}>
      <div onClick={closeSidebar} className="sidepanel__overlay overlay" />

      <div className="sidepanel__wrap">
        <div className="sidepanel__inn">
          <div className="sidepanel__head">
            {title ? <div className="sidepanel__head-title">{title}</div> : null}
            <span onClick={closeSidebar} className="sidepanel__head-close">
              <Icon name="cross" />
            </span>
          </div>
          <div className="sidepanel__content">{children}</div>
        </div>
      </div>
    </div>
  );
}
