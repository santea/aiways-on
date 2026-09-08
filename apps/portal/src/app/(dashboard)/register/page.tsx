/** SR 등록 — US-U2-01 (`08-sr-registration-ui.md` §3). */
import { sessionGuards, u2Deps } from '@/features/u2-core-mgmt/deps';
import { RegisterForm } from '@/features/u2-core-mgmt/ui/register-form';
import { submitSdlcRequest } from './actions';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await sessionGuards.requireUser();
  const { devTypes } = await u2Deps().query.devTypes();

  return (
    <div className="flex max-w-3xl flex-col gap-6" data-testid="register-page">
      <h1 className="font-headline text-2xl font-extrabold tracking-tight text-ink">
        SR 신규 등록
      </h1>
      <RegisterForm
        action={submitSdlcRequest}
        submitter={{ name: user.login || user.id, login: user.login, email: user.email }}
        devTypes={devTypes}
        today={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
