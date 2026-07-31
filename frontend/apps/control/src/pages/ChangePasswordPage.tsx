import { useNavigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { ChangePasswordPanel, type ChangePasswordValues } from '@stemora/ui';
import { ControlLayout } from '../layout/ControlLayout';

export function ChangePasswordPage() {
  const { api, session } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(values: ChangePasswordValues) {
    await api.post('/auth/change-password', values);
  }

  return (
    <ControlLayout
      title="Change password"
      subtitle="Update your Control portal credentials securely"
    >
      <ChangePasswordPanel
        email={session?.user.email}
        onSubmit={onSubmit}
        onCancel={() => navigate('/')}
      />
    </ControlLayout>
  );
}
