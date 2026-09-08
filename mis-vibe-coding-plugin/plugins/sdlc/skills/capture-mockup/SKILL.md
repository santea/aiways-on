---
name: capture-mockup
description: 기능 개발 전 화면을 캡처해 VibeCoding 참고자료를 만드는 범용 워크플로우. 실제 렌더된 화면(Before)을 스샷으로 캡처하고, 실제 UI 소스를 편집해 dev 서버에 라이브 렌더한 목표 상태(After)를 재캡처한다. 목업=실제 코드라 divergence 0. 실제 작업은 sdlc:capture-mockup-runner subagent에 위임되어 격리 실행되므로 메인 세션에는 요약만 남는다. "화면 캡처", "before after", "목업 생성", "vibe 참고자료", "변경될 화면 미리보기" 키워드로 트리거.
user-invocable: true
argument-hint: "<바꿀 화면·목표를 자연어로. 예: 공지사항 화면 폭 2배로 키워줘>"
---

# Capture Mockup — Before/After 캡처 → VibeCoding 워크플로우

## 목적

기능 개발 **전에** "바뀔 화면"을 시각적으로 확정해 VibeCoding 참고자료로 쓴다. **실제 캡처·소스 편집·git 격리·
커밋은 전부 `sdlc:capture-mockup-runner` subagent 안에서 격리 실행**되며, 이 skill(메인 세션)은 사용자 요청을 그대로
넘기고 최종 산출물(before.png·after.png·merged.png 경로 + mockup 브랜치)만 받아 전달하는 **얇은 진입점**이다 — 캡처·소스
탐색·DOM 등 컨텍스트 무거운 작업이 메인 세션에 쌓이지 않도록 하기 위함이다.

- **Before** = 현재 실제 렌더된 화면 (baseline, 코드 수정 X)
- **After** = 목표 시안 = 실제 소스를 편집해 dev 서버에 라이브 렌더한 목표 상태 스샷

절차 원문(all Before → edit all → all After → merge all 배치 흐름·git 격리·인증·상태 기반 UI 등)의
**SSOT는 `sdlc:capture-mockup-runner` agent**다. 여기 중복 서술하지 않는다.

## 언제 쓰나

- 사용자가 `/sdlc:capture-mockup <바꿀 화면·목표>`로 직접 트리거할 때 (예: `공지사항 화면 폭 2배로 키워줘`)
- SDLC 파이프라인에서 개발 전 "바뀔 화면"을 미리 확정하고 싶을 때
- 입력은 **자연어 목표 한 줄이면 충분** — 대상 화면들·URL·featureName은 subagent가 직접 판별한다.
  요구사항이 여러 페이지에 걸치거나 **사용자가 여러 화면을 열거하면**(예: "수정 팝업과 검색 입력창") subagent가
  관련 화면을 **모두 개별 화면으로** 판별해 각각 캡처한다.

## 절차

### 1. subagent에 위임

사용자가 넘긴 목표 문자열을 **그대로** `Task` 툴로 위임한다. 이 skill(메인 세션)은 이 호출 외에 어떤 파일도
직접 읽거나 쓰지 않는다 — dev 서버 확인·소스 탐색·캡처·git 조작을 메인 세션에서 미리 해보지 않는다.

```
Task(subagent_type="sdlc:capture-mockup-runner", prompt="<받은 목표 문자열 그대로>", run_in_background=False)
```

**foreground 실행** — `run_in_background=False`로 메인 세션이 subagent 종료를 기다린다(백그라운드 분기 금지).
subagent가 도는 동안 메인 세션은 블록되며, 완료 요약을 받으면 즉시 §2로 넘어간다.

subagent가 자연어 목표에서 **영향받는 페이지들**(screens[])·URL·featureName을 판별하고, dev 서버 구동 확인 →
**전 화면 Before 일괄 캡처(편집 전) → 전 화면 소스 편집 → 전 화면 After 재캡처 → 전 화면 merged 생성** →
일괄 전달·화면별 피드백 루프 → git 격리·인계/거부까지 수행한다.
요구사항이 여러 페이지에 걸쳐도 브랜치는 `mockup/<featureName>` 하나에 모은다.

### 2. 결과 전달

subagent가 리턴한 완료 요약(**화면별 before.png·after.png·merged.png 경로 목록**, `mockup/<featureName>` 브랜치 하나,
목표 1줄)을 그대로 사용자에게 전달한다. 다른 설명을 덧붙이지 않는다. 이미지 경로는 사용자가 열어 확인하거나
개발 착수 시 참고자료로 쓴다.
