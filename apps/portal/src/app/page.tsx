/**
 * 대시보드 자리 — U2 가 US-U2-02 에서 구현한다 (경로 소유: U2).
 * U1 은 레이아웃이 붙는 것만 확인할 수 있게 최소 화면을 둔다.
 */
export default function HomePage() {
  return (
    <section data-testid="dashboard-placeholder">
      <p className="label-tech">Dashboard</p>
      <h1>AIways-On</h1>
      <p style={{ color: 'var(--on-surface-variant)' }}>
        대시보드는 U2 가 구현합니다. 이 화면은 공용 레이아웃 확인용입니다.
      </p>
    </section>
  );
}
