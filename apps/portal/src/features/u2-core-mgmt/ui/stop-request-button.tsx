'use client';

import type { Stage } from '@aiways/contracts';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/surface';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * "중지" 버튼 — `08-sr-registration-ui.md` §6.3. non-terminal 상태에서만 보인다.
 *
 * **U2 는 상태를 직접 전이시키지 않는다** (B-3). 이 버튼은 U3 소유 엔드포인트
 * `POST /api/v1/sdlc/advance` 를 호출할 뿐이다. U3 가 그 라우트를 만들기 전에는
 * 404 가 돌아오며, 그 사실을 화면에 그대로 알린다 — 성공한 척하지 않는다.
 *
 * 역방향 전이 버튼은 만들지 않는다. 상태 머신에 역전이가 0개다.
 */
export function StopRequestButton({ requestId, from }: { requestId: string; from: Stage }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    setError(null);
    startTransition(async () => {
      const response = await fetch('/api/v1/sdlc/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, from, to: 'X_STOPPED' }),
      });
      if (response.ok) {
        router.refresh();
        return;
      }
      setError(
        response.status === 404
          ? '전이 엔드포인트가 아직 배포되지 않았다 (U3 담당)'
          : '중지하지 못했다. 잠시 후 다시 시도해 달라',
      );
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="danger" data-testid="request-stop-button" className="self-start">
            중지
          </Button>
        </DialogTrigger>
        <DialogContent
          title="이 요청을 중지할까?"
          description="중지한 요청은 되돌릴 수 없다. 재작업이 필요하면 새 SR 을 등록한다."
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" data-testid="request-stop-cancel">
                취소
              </Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={stop}
              disabled={pending}
              data-testid="request-stop-confirm"
            >
              {pending ? '중지하는 중' : '중지한다'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
