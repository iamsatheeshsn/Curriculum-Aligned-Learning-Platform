import type { ReactNode } from 'react';
import { useResolvedTenant } from '@stemora/ui';

export function PageShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  const tenant = useResolvedTenant();
  const brand = tenant?.name || 'School';

  return (
    <div className="sw-page">
      <div className="sw-page-hero">
        <div className="sw-wrap stem-animate-rise">
          <p className="sw-eyebrow">{brand}</p>
          <h1>{title}</h1>
          <p>{lead}</p>
        </div>
      </div>
      <div className="sw-wrap stem-animate-rise">{children}</div>
    </div>
  );
}
