import { signIn } from '@/auth';

export const metadata = { title: '로그인 · AIways-On' };

/**
 * GitHub OAuth 로그인 — US-U1-01.
 * 근거: design/ §4.1
 */
export default function LoginPage() {
  return (
    <main className="login-shell" data-testid="login-page">
      <section className="surface-card login-card">
        <p className="label-tech">AIways-On</p>
        <h1>GitHub 계정으로 로그인</h1>
        <p className="login-lede">
          사내 GitHub 계정으로 인증합니다. 최초 로그인 시 기본 권한은 <code>user</code>입니다.
        </p>
        <form
          action={async () => {
            'use server';
            await signIn('github', { redirectTo: '/' });
          }}
        >
          <button type="submit" className="login-button" data-testid="login-github-button">
            GitHub로 계속하기
          </button>
        </form>
      </section>
    </main>
  );
}
