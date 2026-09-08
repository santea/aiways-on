#!/usr/bin/env node
/**
 * Slack Gateway(SVC-4)가 워크스페이스 공유 패키지에 의존하지 않는지 검사한다.
 *
 * 왜 필요한가: 명세와 컴포넌트 설계는 Gateway 가 Portal 과 코드·타입을 공유하지 않는다고
 * 못 박는다 — Slack 원본 봉투를 가공 없이 릴레이하므로 공유 타입이 필요 없고,
 * replicas 1 고정이라 Portal 과 생명주기도 다르다.
 * 그런데 워크스페이스에서는 `@aiways/contracts` 를 import 하는 것이 한 줄이면 되는 일이라
 * 이 규약이 쉽게 깨진다. **이 위험은 평면 구조에서는 없었고 워크스페이스 도입이 만든 것이다.**
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const GATEWAY = 'apps/sdlc-slack-gateway';
const FORBIDDEN = /@aiways\/(contracts|lib)/;

if (!existsSync(GATEWAY)) {
  console.log(`SKIP: ${GATEWAY} 아직 없음 (U3 가 만든다). 생성되면 이 검사가 활성화된다.`);
  process.exit(0);
}

const problems = [];

const pkgPath = join(GATEWAY, 'package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const dep of Object.keys(pkg[field] ?? {})) {
      if (FORBIDDEN.test(dep)) problems.push(`${pkgPath}: ${field}.${dep}`);
    }
  }
}

const walk = (dir) =>
  readdirSync(dir).flatMap((e) => {
    if (e === 'node_modules' || e === 'dist' || e === '.next') return [];
    const full = join(dir, e);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

for (const file of walk(GATEWAY).filter((f) => /\.(ts|tsx|js|mjs)$/.test(f))) {
  const src = readFileSync(file, 'utf8');
  src.split('\n').forEach((line, i) => {
    if (FORBIDDEN.test(line) && /\b(import|require|from)\b/.test(line)) {
      problems.push(`${file}:${i + 1}: ${line.trim()}`);
    }
  });
}

if (problems.length > 0) {
  console.error('FAIL: Slack Gateway 가 공유 패키지에 의존한다:');
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    '\nGateway 는 Slack 원본 봉투를 가공 없이 릴레이하므로 공유 타입이 필요 없다.\n' +
      '필요해 보인다면 릴레이가 아니라 가공을 하고 있는 것이므로 설계를 다시 본다.',
  );
  process.exit(1);
}
console.log('OK: Slack Gateway 는 공유 패키지에 의존하지 않는다');
