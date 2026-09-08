---
name: setup
description: repo(들)이 vibe-coding(요구사항 인터뷰→설계→개발)에 필요한 최소 문서/구조를 갖췄는지 검사하고, 부족하면 실제 코드 분석 기반으로 보완한다. 실제 작업은 vibe-coding-setup:setup-runner subagent에 위임되어 격리 실행되므로 메인 세션에는 요약만 남는다. SDLC 파이프라인 여부와 무관하게 독립적으로 호출 가능.
argument-hint: "<repo 경로 1개 이상, 공백 또는 줄바꿈 구분>"
---

# Vibe Coding Setup

<Purpose>
Vibe Coding Setup은 repo(들)이 AI가 요구사항 인터뷰→설계→개발을 시작하기 전 필요한 최소 문서/구조를 갖췄는지 검사하고, 부족한 부분을 실제 코드 분석 기반으로 채워넣는다. **실제 검사·파일 읽기/쓰기·커밋은 전부 `vibe-coding-setup:setup-runner` subagent 안에서 격리 실행**되며, 이 skill(메인 세션)은 입력을 그대로 넘기고 최종 요약만 받아 전달하는 얇은 진입점이다 — repo 전체를 훑는 과정에서 나오는 방대한 탐색/파일 내용이 메인 세션 컨텍스트에 쌓이지 않도록 하기 위함이다.
</Purpose>

<Use_When>
- WF-A(SDLC Intake & Stage Driver)의 `Vibe Coding Setup` 노드가 이번 SR에서 clone한 repo 경로들과 함께 이 스킬을 자동 invoke할 때
- 사람이 SDLC 과정 없이 특정 repo(들)의 vibe-coding 준비 상태만 점검/보완하고 싶을 때 (자기 repo에 `vibe-coding-setup@mvc` plugin만 설치하고 `/vibe-coding-setup:setup <repo 경로>`로 직접 호출하는 경우 포함)
- 입력으로 repo 절대경로가 하나 이상 주어졌을 때(그 외 정보는 필요 없음 — subagent가 직접 검사한다)
</Use_When>

<Do_Not_Use_When>
- 요구사항 인터뷰, 설계, 개발 등 SDLC 본 단계 작업 (이 스킬은 그 이전 준비 단계로 한정)
</Do_Not_Use_When>

<Steps>

## 1. subagent에 위임

입력으로 받은 repo 절대경로들(공백 또는 줄바꿈 구분, 1개 이상)을 **그대로** `Task` 툴에 넘겨 위임한다. 이 skill(메인 세션)은 이 호출 외에 어떤 파일도 직접 읽거나 쓰지 않는다 — repo 존재 확인이나 baseline 체크 등을 메인 세션에서 미리 해보지 않는다.

```
Task(subagent_type="vibe-coding-setup:setup-runner", prompt="<받은 repo 경로들 그대로>")
```

## 2. 결과 전달

subagent가 리턴한 완료 요약(repo별 스킵 여부/보완 내용)을 그대로 사용자에게 전달한다. 다른 설명을 덧붙이지 않는다.

</Steps>
