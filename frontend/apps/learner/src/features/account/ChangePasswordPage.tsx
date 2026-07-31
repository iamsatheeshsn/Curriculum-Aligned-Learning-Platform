import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { ChangePasswordPanel, type ChangePasswordValues } from '@stemora/ui';
import { LearnerShell } from '../shared/shared';

export function ChangePasswordPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api, session } = useAuth();
  const navigate = useNavigate();
  const roles = session?.user.roles ?? [];
  const isParent = roles.includes('parent');
  const home = isParent ? 'parent' : 'student';

  async function onSubmit(values: ChangePasswordValues) {
    await api.post('/auth/change-password', values);
  }

  return (
    <LearnerShell
      title="Change password"
      subtitle="Update your account credentials"
      mode={isParent ? 'parent' : 'student'}
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">{isParent ? 'Parent' : 'Student'} portal · Security</p>
            <h2 className="lp-hero-title">Change password</h2>
            <p className="lp-hero-lead">Choose a strong password you have not used elsewhere.</p>
          </div>
        </section>
        <ChangePasswordPanel
          email={session?.user.email}
          onSubmit={onSubmit}
          onCancel={() => navigate(`/${tenantSlug}/${home}`)}
        />
      </div>
    </LearnerShell>
  );
}
