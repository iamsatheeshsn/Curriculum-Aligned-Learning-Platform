import { useLocation } from 'react-router-dom';
import { ModuleWorkspace } from '@stemora/ui';
import { ControlLayout } from '../layout/ControlLayout';

export function ControlModulePage({ title, description }: { title?: string; description?: string }) {
  const location = useLocation();
  return (
    <ControlLayout title={title ?? 'Module'} subtitle={description ?? 'Role-based workspace'}>
      <ModuleWorkspace pathname={location.pathname} homeTo="/" title={title} description={description} />
    </ControlLayout>
  );
}
