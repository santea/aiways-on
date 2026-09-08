'use server';

import { redirect } from 'next/navigation';
import { toApiErrorPayload } from '@aiways/lib/http';
import { sessionGuards, u2Deps } from '@/features/u2-core-mgmt/deps';
import { buildDedupKey } from '@/features/u2-core-mgmt/request-no';

export interface RegisterFormState {
  readonly error: string | null;
}

/**
 * SR 등록 제출 — US-U2-01 (`08-sr-registration-ui.md` §4.1).
 *
 * **제출자 정보는 세션에서 서버가 주입한다.** 폼이 보낸 `submitter*` 값은 읽지 않는다 —
 * 그것을 신뢰하면 남의 이름으로 SR 을 만들 수 있다 (NFR-12).
 *
 * `dedupKey` 도 서버가 만든다. 새로고침·이중 클릭으로 같은 폼이 두 번 와도
 * 같은 키가 나오므로 SR 이 하나만 생긴다 (B-1 멱등).
 */
export async function submitSdlcRequest(
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const user = await sessionGuards.requireUser();
  const deps = u2Deps();

  const text = (name: string): string => String(formData.get(name) ?? '').trim();
  const optional = (name: string): string | undefined => text(name) || undefined;

  const { requestNo } = await deps.query.nextRequestNo();
  const devType = text('devType');

  let created: { requestNo: string };
  try {
    created = await deps.intake.intake({
      requestNo,
      submitter: user.login || user.id,
      submitterId: user.id,
      submitterEmail: user.email,
      submitterGithubLogin: user.login,
      requestSite: text('requestSite'),
      devType,
      requestSystem: text('requestSystem'),
      module: optional('module') ?? null,
      dedupKey: buildDedupKey({ requestNo, submitterId: user.id, devType }),
      metadata: {
        srTitle: text('srTitle'),
        requestDate: text('requestDate'),
        dueDate: optional('dueDate'),
        piManager: optional('piManager'),
        department: optional('department'),
        problemDescription: text('problemDescription'),
        expectedEffect: optional('expectedEffect'),
        testScenario: optional('testScenario'),
        // 제출자 본인 이메일은 항상 포함한다 (`08-sr-registration-ui.md` §3.4).
        members: [
          ...new Set(
            [user.email, ...formData.getAll('members').map((m) => String(m).trim())].filter(
              (m): m is string => Boolean(m),
            ),
          ),
        ],
      },
    });
  } catch (error) {
    // 내부 정보를 화면에 싣지 않는다 (NFR-16). 표준 오류의 메시지만 보여준다.
    const { status, body } = toApiErrorPayload(error);
    return {
      error:
        status === 400
          ? body.message
          : 'SDLC 요청을 등록하지 못했다. 잠시 후 다시 시도해 달라',
    };
  }

  redirect(`/requests?search=${encodeURIComponent(created.requestNo)}`);
}
