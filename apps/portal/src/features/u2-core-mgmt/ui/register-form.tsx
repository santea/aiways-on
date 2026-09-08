'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';
import type { RegisterFormState } from '@/app/(dashboard)/register/actions';

export interface SubmitterView {
  readonly name: string;
  readonly login: string;
  readonly email: string | null;
}

interface RegisterFormProps {
  readonly action: (state: RegisterFormState, formData: FormData) => Promise<RegisterFormState>;
  readonly submitter: SubmitterView;
  readonly devTypes: readonly string[];
  readonly today: string;
}

/**
 * SR 등록 폼 — US-U2-01 (`08-sr-registration-ui.md` §3).
 *
 * 필수 항목이 비면 제출 버튼이 눌리지 않고 사유가 표시된다. 브라우저 기본 검증
 * (`required`)에 더해 제출 버튼 자체를 비활성화해, 인수 조건의 "동작하지 않는다"를
 * 문자 그대로 만족시킨다. 서버도 같은 규칙을 다시 검증한다 (NFR-11).
 */
export function RegisterForm({ action, submitter, devTypes, today }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [required, setRequired] = useState({
    srTitle: '',
    requestSystem: '',
    requestSite: '',
    problemDescription: '',
    requestDate: today,
  });
  const [members, setMembers] = useState<string[]>([]);
  const [memberDraft, setMemberDraft] = useState('');

  const missing = Object.entries(required)
    .filter(([, value]) => !value.trim())
    .map(([key]) => key);
  const canSubmit = missing.length === 0 && !pending;

  const set = (key: keyof typeof required) => (value: string) =>
    setRequired((prev) => ({ ...prev, [key]: value }));

  const addMember = () => {
    const value = memberDraft.trim();
    if (!value || members.includes(value)) return;
    setMembers((prev) => [...prev, value]);
    setMemberDraft('');
  };

  return (
    <form action={formAction} className="flex flex-col gap-6" data-testid="register-form">
      <Card className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-ink">{submitter.name}</span>
          <span className="font-mono-id text-[11.5px] text-ink-faint">
            @{submitter.login}
            {submitter.email ? ` · ${submitter.email}` : ''}
          </span>
        </div>
        <span className="rounded bg-accent-wash px-1.5 py-0.5 font-mono-id text-[10px] font-bold uppercase tracking-[0.05em] text-accent">
          제출자 (자동)
        </span>
      </Card>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-headline text-[15px] font-bold tracking-tight text-ink">
          기본 정보
        </legend>
        <Field label="제목" htmlFor="srTitle" required>
          <Input
            id="srTitle"
            name="srTitle"
            required
            value={required.srTitle}
            onChange={(e) => set('srTitle')(e.target.value)}
            data-testid="register-form-title-input"
          />
        </Field>
        <Field label="개발 유형" htmlFor="devType" required>
          <NativeSelect
            id="devType"
            name="devType"
            defaultValue={devTypes[0]}
            data-testid="register-form-devtype-select"
          >
            {devTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="요청 시스템" htmlFor="requestSystem" required>
          <Input
            id="requestSystem"
            name="requestSystem"
            required
            value={required.requestSystem}
            onChange={(e) => set('requestSystem')(e.target.value)}
            data-testid="register-form-system-input"
          />
        </Field>
        <Field label="메뉴 경로" htmlFor="module" hint="예: 대시보드 > 분석">
          <Input id="module" name="module" data-testid="register-form-module-input" />
        </Field>
        <Field label="요청 사이트" htmlFor="requestSite" required>
          <Input
            id="requestSite"
            name="requestSite"
            required
            value={required.requestSite}
            onChange={(e) => set('requestSite')(e.target.value)}
            data-testid="register-form-site-input"
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-headline text-[15px] font-bold tracking-tight text-ink">
          상세 내용
        </legend>
        <Field label="문제점·개발의뢰" htmlFor="problemDescription" required>
          <Textarea
            id="problemDescription"
            name="problemDescription"
            required
            value={required.problemDescription}
            onChange={(e) => set('problemDescription')(e.target.value)}
            data-testid="register-form-problem-textarea"
          />
        </Field>
        <Field label="기대효과" htmlFor="expectedEffect">
          <Textarea
            id="expectedEffect"
            name="expectedEffect"
            data-testid="register-form-effect-textarea"
          />
        </Field>
        <Field label="테스트 시나리오" htmlFor="testScenario">
          <Textarea
            id="testScenario"
            name="testScenario"
            data-testid="register-form-scenario-textarea"
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-headline text-[15px] font-bold tracking-tight text-ink">
          일정 및 참여자
        </legend>
        <Field label="요청일" htmlFor="requestDate" required>
          <Input
            id="requestDate"
            name="requestDate"
            type="date"
            required
            value={required.requestDate}
            onChange={(e) => set('requestDate')(e.target.value)}
            data-testid="register-form-requestdate-input"
          />
        </Field>
        <Field label="목표 완료일" htmlFor="dueDate">
          <Input id="dueDate" name="dueDate" type="date" data-testid="register-form-duedate-input" />
        </Field>
        <Field label="PI 관리자" htmlFor="piManager">
          <Input id="piManager" name="piManager" data-testid="register-form-pimanager-input" />
        </Field>
        <Field label="부서" htmlFor="department">
          <Input id="department" name="department" data-testid="register-form-department-input" />
        </Field>

        <Field
          label="Slack 멤버"
          htmlFor="memberDraft"
          hint="Slack 에 등록된 이메일만 초대된다. 제출자 본인은 자동 포함된다."
        >
          <div className="flex flex-col gap-2">
            <ul className="flex flex-wrap gap-1.5" data-testid="register-form-member-list">
              {members.map((member) => (
                <li
                  key={member}
                  className="flex items-center gap-1.5 rounded bg-surface-3 px-2 py-1 font-mono-id text-[11.5px] text-ink"
                >
                  {member}
                  <input type="hidden" name="members" value={member} />
                  <button
                    type="button"
                    aria-label={`${member} 제거`}
                    onClick={() => setMembers((prev) => prev.filter((m) => m !== member))}
                    className="text-ink-faint hover:text-error"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                id="memberDraft"
                type="email"
                value={memberDraft}
                onChange={(e) => setMemberDraft(e.target.value)}
                placeholder="user@example.com"
                data-testid="register-form-member-input"
              />
              <Button
                type="button"
                variant="subtle"
                onClick={addMember}
                data-testid="register-form-member-add"
              >
                추가
              </Button>
            </div>
          </div>
        </Field>
      </fieldset>

      {missing.length > 0 ? (
        <Alert tone="warning">필수 항목이 비어 있다: {missing.join(', ')}</Alert>
      ) : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit} data-testid="register-form-submit-button">
          {pending ? '등록하는 중' : 'SDLC 요청 등록'}
        </Button>
        <Button asChild variant="ghost" data-testid="register-form-cancel-link">
          <a href="/">취소</a>
        </Button>
      </div>
    </form>
  );
}
