#!/usr/bin/env node
/**
 * @aiways/contracts 가 런타임 코드를 담고 있지 않은지 검사한다.
 *
 * 왜 필요한가: contracts 는 6개 유닛 전부가 import 하는 유일한 공통 지점이다.
 * 여기에 실행 코드가 들어가기 시작하면 "선언만 두는 곳"이라는 경계가 조용히 무너지고,
 * PR #1 의 동결 대상이 커져 다른 유닛의 착수가 늦어진다.
 *
 * 방법: 타입만 있는 TS 는 컴파일하면 빈 모듈이 된다. 실제로 컴파일해 산출 JS 가
 * 주석과 `export {}` 외에 아무것도 없는지 본다.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const outDir = mkdtempSync(join(tmpdir(), 'contracts-emit-'));
let failed = false;

try {
  execFileSync(
    'node',
    [
      './node_modules/typescript/lib/tsc.js',
      '-p',
      'packages/contracts/tsconfig.json',
      '--outDir',
      outDir,
      '--noEmit',
      'false',
      '--declaration',
      'false',
      '--sourceMap',
      'false',
    ],
    { stdio: 'inherit' },
  );

  const walk = (dir) =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });

  const emitted = walk(outDir).filter((f) => f.endsWith('.js'));
  if (emitted.length === 0) {
    console.error('FAIL: 컴파일 산출물이 없다 — 검사가 무의미하므로 실패로 처리한다.');
    process.exit(1);
  }

  for (const file of emitted) {
    const stripped = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/^\s*export\s*\{\s*\}\s*;?\s*$/gm, '')
      .replace(/^\s*["']use strict["'];?\s*$/gm, '')
      .trim();
    if (stripped.length > 0) {
      failed = true;
      console.error(`FAIL: ${file.slice(outDir.length + 1)} 에 런타임 코드가 있다:`);
      console.error(stripped.split('\n').slice(0, 10).join('\n'));
    }
  }

  if (failed) {
    console.error(
      '\n@aiways/contracts 는 타입·인터페이스 선언만 둔다. ' +
        '실행이 필요한 상수·헬퍼는 @aiways/lib/domain 으로 옮겨라.',
    );
    process.exit(1);
  }
  console.log(`OK: contracts 런타임 코드 없음 (검사한 파일 ${emitted.length}개)`);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
