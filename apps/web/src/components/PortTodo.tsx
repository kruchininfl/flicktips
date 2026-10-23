import type { ReactNode } from 'react';

// Placeholder of a page that is not ported yet (see apps/web/PORTING.md). Remove with the last page.
export function PortTodo({ legacy, children }: { legacy: string; children?: ReactNode }) {
  return (
    <div className="content" data-port-todo={legacy}>
      <div className="page-ph">
        <div className="page-ph__text">TODO: port web/src/components/{legacy}</div>
        {children}
      </div>
    </div>
  );
}
