import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

// The empty-state block (.page-ph in styles/app.scss): a big icon, a line of text, an optional action.
export function PagePlaceholder({ icon, text, children }: { icon?: IconName; text: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-ph">
      {icon ? (
        <div className="page-ph__icn">
          <Icon name={icon} />
        </div>
      ) : null}
      <div className="page-ph__text">{text}</div>
      {children}
    </div>
  );
}
