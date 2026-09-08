/**
 * SR 상세 — US-U2-03 (`08-sr-registration-ui.md` §6).
 *
 * 표시되는 상태·substage·전이 이력은 전부 U3 가 생산하고 U2 는 읽기만 한다 (B-3).
 * 액션 버튼은 "중지" 하나뿐이다 — `design/` §4.4 의 "재개발 / 테스트 진행" 버튼은
 * 존재하지 않는 Stage 7 에 걸려 있고 FR·스토리에도 없다 (F-6).
 */
import { notFound } from 'next/navigation';
import { Alert, Card, Section } from '@/components/ui/surface';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th } from '@/components/ui/table';
import { u2Deps } from '@/features/u2-core-mgmt/deps';
import { DevSubStageSteps, StageFlow, StatusBadge } from '@/features/u2-core-mgmt/ui/pipeline';
import { StopRequestButton } from '@/features/u2-core-mgmt/ui/stop-request-button';
import { stageLabel } from '@/features/u2-core-mgmt/status-badge';
import { ApiHttpError } from '@aiways/lib/http';

export const dynamic = 'force-dynamic';

const TERMINAL = new Set(['9_COMPLETE', 'X_STOPPED', 'X_FAILED']);
const dateTime = (iso: string) => iso.replace('T', ' ').slice(0, 16);

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await u2Deps()
    .query.getRequest(id)
    .catch((error: unknown) => {
      if (error instanceof ApiHttpError && error.status === 404) notFound();
      throw error;
    });

  const metadata = detail.metadata as { srTitle?: string; dueDate?: string; failureReason?: string };

  return (
    <div className="flex flex-col gap-8" data-testid="request-detail-page">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono-id text-xl font-bold tracking-tight text-ink">
          {detail.requestNo}
        </h1>
        <StatusBadge stage={detail.status} />
        <Badge tone="neutral">{detail.profile}</Badge>
      </header>

      <Section title="단계 진행">
        <StageFlow current={detail.status} profile={detail.profile} />
        {detail.status === '4_DEV_IN_PROGRESS' ? (
          <div className="flex flex-col gap-2">
            <p className="font-mono-id text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint">
              개발 서브스테이지
            </p>
            <DevSubStageSteps state={detail.devSubStage} />
          </div>
        ) : null}
        {detail.status === 'X_FAILED' ? (
          <Alert tone="error">
            실패 사유: {metadata.failureReason ?? '기록된 사유가 없다'}
          </Alert>
        ) : null}
      </Section>

      <Section title="기본 정보">
        <Card className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-4">
          <Detail label="제목" value={metadata.srTitle ?? '-'} />
          <Detail
            label="제출자"
            value={`${detail.submitter}${detail.submitterGithubLogin ? ` @${detail.submitterGithubLogin}` : ''}`}
          />
          <Detail label="시스템" value={detail.requestSystem} />
          <Detail label="개발 유형" value={detail.devType} />
          <Detail label="메뉴 경로" value={detail.module ?? '-'} />
          <Detail label="목표일" value={metadata.dueDate ?? '-'} />
        </Card>
      </Section>

      <Section title="Slack 채널">
        {detail.channels.length === 0 ? (
          <p className="text-[12.5px] text-ink-faint">생성된 채널이 없다</p>
        ) : (
          <ul className="flex flex-col gap-1.5" data-testid="request-channels">
            {detail.channels.map((channel) => (
              <li key={channel.channelId} className="flex items-center gap-2">
                <span className="font-mono-id text-[12px] text-ink">#{channel.channelName}</span>
                <Badge tone={channel.archived ? 'neutral' : 'success'}>
                  {channel.archived ? '아카이브됨' : '활성'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Pod 상태">
        {detail.pod ? (
          <p className="flex items-center gap-2" data-testid="request-pod">
            <span className="font-mono-id text-[12px] text-ink">{detail.pod.podName}</span>
            <Badge tone={detail.pod.status === 'RUNNING' ? 'success' : 'neutral'}>
              {detail.pod.status}
            </Badge>
          </p>
        ) : (
          <p className="text-[12.5px] text-ink-faint">Pod 세션이 없다</p>
        )}
      </Section>

      <Section title="GitHub">
        <ul className="flex flex-col gap-1.5" data-testid="request-github-links">
          {detail.github.issues.map((issue) => (
            <LinkRow
              key={`i-${issue.repo}-${issue.number}`}
              label={`Issue #${issue.number}`}
              repo={issue.repo}
              state={issue.state}
              href={issue.htmlUrl}
            />
          ))}
          {detail.github.pullRequests.map((pr) => (
            <LinkRow
              key={`p-${pr.repo}-${pr.prNumber}`}
              label={`PR #${pr.prNumber}`}
              repo={pr.repo}
              state={pr.state}
              href={pr.htmlUrl}
            />
          ))}
          {detail.github.issues.length + detail.github.pullRequests.length === 0 ? (
            <li className="text-[12.5px] text-ink-faint">연결된 Issue·PR 이 없다</li>
          ) : null}
        </ul>
      </Section>

      <Section title="단계 이력">
        <TableWrap>
          <Table data-testid="request-stage-history">
            <thead>
              <tr>
                <Th>전이</Th>
                <Th>시각</Th>
                <Th>주체</Th>
              </tr>
            </thead>
            <tbody>
              {detail.stageHistory.map((t) => (
                <tr key={t.id}>
                  <Td className="font-mono-id text-[11.5px] text-ink">
                    {stageLabel(t.fromStatus)} → {stageLabel(t.toStatus)}
                  </Td>
                  <Td className="tabular-nums">{dateTime(t.createdAt)}</Td>
                  <Td>{t.actor}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Section>

      {TERMINAL.has(detail.status) ? null : (
        <StopRequestButton requestId={detail.id} from={detail.status} />
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono-id text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint">
        {label}
      </span>
      <span className="text-[13px] text-ink">{value}</span>
    </div>
  );
}

function LinkRow({
  label,
  repo,
  state,
  href,
}: {
  label: string;
  repo: string;
  state: string;
  href: string | null;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono-id text-[12px] font-bold text-accent hover:underline"
        >
          {label}
        </a>
      ) : (
        <span className="font-mono-id text-[12px] font-bold text-ink">{label}</span>
      )}
      <span className="text-[12px] text-ink-variant">{repo}</span>
      <Badge tone={state === 'merged' ? 'success' : state === 'closed' ? 'neutral' : 'accent'}>
        {state}
      </Badge>
    </li>
  );
}
