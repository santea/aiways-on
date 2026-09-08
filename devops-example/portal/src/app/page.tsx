export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">🚀 DDT</h1>
      <p className="mt-2 text-muted-foreground">
        프로젝트가 성공적으로 실행되었습니다.22
      </p>
      <div className="mt-8 rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">서비스 현황</h2>
        <ul className="space-y-2 text-sm">
          <li>✅ App Server — <code className="rounded bg-muted px-1.5 py-0.5">http://localhost:3000</code></li>
          <li>✅ PostgreSQL — <code className="rounded bg-muted px-1.5 py-0.5">localhost:5432</code></li>
          <li>✅ n8n — <code className="rounded bg-muted px-1.5 py-0.5">http://localhost:5678</code></li>
          <li>✅ MCP Server — <code className="rounded bg-muted px-1.5 py-0.5">http://localhost:3001</code></li>
        </ul>
      </div>
    </main>
  );
}
