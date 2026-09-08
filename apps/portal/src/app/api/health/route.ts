/** 헬스체크. 인증 예외 경로다 (RESILIENCY-06). */
export function GET() {
  return Response.json({ status: 'ok', service: 'portal' });
}
