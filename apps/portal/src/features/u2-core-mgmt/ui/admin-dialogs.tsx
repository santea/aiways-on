'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { Alert } from '@/components/ui/surface';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

const API = '/api/v1/sdlc';

/** 관리 화면의 등록 모달이 공통으로 쓰는 제출 훅. */
function useApiSubmit(path: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submit = (body: unknown) => {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? '저장하지 못했다');
    });
  };

  return { submit, pending, error, open, setOpen };
}

export function CreateOrgDialog() {
  const { submit, pending, error, open, setOpen } = useApiSubmit('/orgs');
  const [form, setForm] = useState({ orgUrl: '', orgName: '', credentialId: '' });
  const change = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="admin-orgs-create-button">
          Org 등록
        </Button>
      </DialogTrigger>
      <DialogContent title="GitHub Org 등록" description="SDLC 를 열어 줄 Org 를 등록한다.">
        <div className="flex flex-col gap-4">
          <Field label="Org URL" htmlFor="orgUrl" required>
            <Input
              id="orgUrl"
              value={form.orgUrl}
              onChange={(e) => change('orgUrl')(e.target.value)}
              placeholder="https://github.com/org"
              data-testid="admin-orgs-url-input"
            />
          </Field>
          <Field label="Org 이름" htmlFor="orgName" required>
            <Input
              id="orgName"
              value={form.orgName}
              onChange={(e) => change('orgName')(e.target.value)}
              data-testid="admin-orgs-name-input"
            />
          </Field>
          <Field
            label="자격증명 ID"
            htmlFor="credentialId"
            hint="비워 두면 나중에 연결할 수 있다"
          >
            <Input
              id="credentialId"
              value={form.credentialId}
              onChange={(e) => change('credentialId')(e.target.value)}
              data-testid="admin-orgs-credential-input"
            />
          </Field>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button
            onClick={() =>
              submit({
                orgUrl: form.orgUrl,
                orgName: form.orgName,
                credentialId: form.credentialId || null,
              })
            }
            disabled={pending || !form.orgUrl || !form.orgName}
            data-testid="admin-orgs-save-button"
          >
            {pending ? '저장하는 중' : '등록'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CreateRepoDialog({
  orgs,
}: {
  orgs: readonly { id: string; orgName: string }[];
}) {
  const { submit, pending, error, open, setOpen } = useApiSubmit('/repos');
  const [form, setForm] = useState({
    orgId: orgs[0]?.id ?? '',
    repoUrl: '',
    repoName: '',
    defaultBranch: 'main',
    autoPrMerge: false,
    isUi: false,
    runnable: false,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={orgs.length === 0} data-testid="admin-repos-create-button">
          Repo 등록
        </Button>
      </DialogTrigger>
      <DialogContent title="GitHub Repo 등록" description="등록 시 초기 셋업 잡이 함께 만들어진다.">
        <div className="flex flex-col gap-4">
          <Field label="Org" htmlFor="orgId" required>
            <NativeSelect
              id="orgId"
              value={form.orgId}
              onChange={(e) => setForm((p) => ({ ...p, orgId: e.target.value }))}
              data-testid="admin-repos-org-select"
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.orgName}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Repo URL" htmlFor="repoUrl" required>
            <Input
              id="repoUrl"
              value={form.repoUrl}
              onChange={(e) => setForm((p) => ({ ...p, repoUrl: e.target.value }))}
              placeholder="https://github.com/org/portal"
              data-testid="admin-repos-url-input"
            />
          </Field>
          <Field label="Repo 이름" htmlFor="repoName" required>
            <Input
              id="repoName"
              value={form.repoName}
              onChange={(e) => setForm((p) => ({ ...p, repoName: e.target.value }))}
              data-testid="admin-repos-name-input"
            />
          </Field>
          <Field label="기본 브랜치" htmlFor="defaultBranch">
            <Input
              id="defaultBranch"
              value={form.defaultBranch}
              onChange={(e) => setForm((p) => ({ ...p, defaultBranch: e.target.value }))}
              data-testid="admin-repos-branch-input"
            />
          </Field>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ['autoPrMerge', '자동 PR 머지'],
                ['isUi', 'UI repo'],
                ['runnable', '실행 가능'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-[12.5px] text-ink-variant">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
                  data-testid={`admin-repos-${key}-checkbox`}
                />
                {label}
              </label>
            ))}
          </div>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button
            onClick={() => submit(form)}
            disabled={pending || !form.repoUrl || !form.repoName}
            data-testid="admin-repos-save-button"
          >
            {pending ? '저장하는 중' : '등록'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
