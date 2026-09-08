---
name: git-push
description: >
  Conventional Commits 형식 검증 후 안전하게 git push. main/master 직접 push 경고.
  $ARGUMENTS 로 커밋 메시지 직접 지정 가능.
  /dev-agent:create 의 git 단계에서 자동 호출됨.
---

# Git Push

사용자 입력: "$ARGUMENTS"

## 실행 지침

서브에이전트 없이 메인 스레드에서 직접 실행.

### 1단계 — 사전 검사

```bash
git config user.email
```
비어 있으면 중단: "git user.email 설정 필요 — git config user.email 'your@email.com'"

```bash
git branch --show-current
```
결과가 `main` 또는 `master`이면 경고 후 사용자 확인 요청:
"⚠️ 보호 브랜치 직접 push — 계속하려면 'yes' 입력"

### 2단계 — 스테이징 상태 확인

```bash
git status --short
```
변경 파일이 없으면: "커밋할 변경 사항 없음"

### 3단계 — 커밋 메시지 결정

`$ARGUMENTS`가 있으면 해당 텍스트를 커밋 메시지로 사용.
없으면 사용자에게 메시지 입력 요청.

**Conventional Commits 정규식 검증:**
```
^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .+
```
검증 실패 시 예시 제시:
```
올바른 형식 예:
  feat: 로그인 API 추가
  fix(auth): 토큰 만료 처리 수정
  docs: README 업데이트
```

### 4단계 — 커밋 & 푸시

스테이징되지 않은 변경 파일을 확인하고 명시적으로 `git add <files>` (절대 `git add -A` 또는 `git add .` 사용 금지).

```bash
git commit -m "$(cat <<'EOF'
{커밋 메시지}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push
```

실패 시 upstream 없으면: `git push --set-upstream origin {branch}` 시도.

### 5단계 — 결과 출력

```
GIT PUSH RESULT
━━━━━━━━━━━━━━━
branch : {branch}
commit : {short-hash}
message: {subject}
push   : SUCCESS | FAILED ({reason})
```

결과를 변수로 반환 (report-mail 스킬에서 사용).
