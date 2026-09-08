# 복원력(Resiliency) 확장 필수 질문 — AIways-On

Q2에서 복원력 기준을 적용(A)하기로 하셨습니다. `resiliency-baseline.md`의
RESILIENCY-02 / 03 / 04 / 08 / 14 / 15 규칙은 **사용자가 직접 결정해야 하는 항목**을
모델이 추측하지 못하도록 명시적으로 질문하도록 규정하고 있습니다.

> **⏱️ 빠른 처리를 위해**: 2일 일정과 사내 K8s 환경을 전제로 각 질문에 **(권장)** 을 표시했습니다.
> 이견이 없으시면 권장안 문자만 적어주시면 됩니다. 8문항 전부 권장안이면 `"전부 권장"` 이라고만 쓰셔도 됩니다.

---

## Question 1 — RTO/RPO 목표 및 재해복구 전략 (RESILIENCY-02, 11)
AIways-On의 복구 목표를 어느 수준으로 설정할까요?

A) **(권장)** 사내 개발 지원 도구 수준 — RTO 4시간 / RPO 24시간.
   일일 DB 백업, 단일 리전, 장애 시 재배포로 복구. SR 진행 이력은 유실 시 재등록 가능

B) 업무 중요 시스템 수준 — RTO 1시간 / RPO 1시간. 시간별 백업 + 대기 환경 준비

C) 미션 크리티컬 수준 — RTO 15분 / RPO 5분. 다중 리전 + 실시간 복제

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2 — 변경 관리 프로세스 (RESILIENCY-03)
이미 조직에 존재하는 변경 관리 프로세스가 있나요? (없는 것을 새로 만들라는 규칙이 아니라, 있는 것에 맞추라는 규칙입니다)

A) **(권장)** GitHub PR 리뷰 + merge 승인이 곧 변경 관리 — 별도 프로세스 없음
   (이 프로젝트 자체가 SDLC 자동화 도구이므로 자기 파이프라인을 따름)

B) 사내 공식 변경관리(RSCCB 등) 프로세스가 있고 이를 따라야 함

C) 아직 없음 — 이번에 정의 필요

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3 — CI/CD 및 배포 도구 (RESILIENCY-04)
배포 파이프라인은 무엇을 사용하나요?

A) **(권장)** Skaffold (로컬 개발) + GitHub Actions (CI) — 참고자산의 `skaffold.yaml` 구조 재사용

B) GitHub Actions 단독 — Helm으로 직접 배포

C) 사내 CI/CD 시스템 (Jenkins, ArgoCD 등)

D) 2일 일정상 CI/CD 없이 로컬 Skaffold만

X) Other (please describe after [Answer]: tag below)

[Answer]: D + GitHub Actions CI 까지만 진행

## Question 4 — 롤백 메커니즘 (RESILIENCY-04)
배포 실패 시 롤백 방식은?

A) **(권장)** `helm rollback` — Helm 리비전 기반 즉시 롤백

B) 이전 이미지 태그로 재배포 (K8s Deployment rollout undo)

C) Blue/Green 또는 Canary 전환

D) 수동 복구만 (자동 롤백 없음)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 5 — 배포 방식 (RESILIENCY-04)
프로덕션 배포 스타일은?

A) **(권장)** Rolling Update — K8s 기본. Portal `replicas: 2+`이므로 무중단 가능

B) Blue/Green — 전환 후 검증, 문제 시 즉시 되돌림

C) Canary — 일부 트래픽부터 점진 확대

D) Recreate — 중단 후 재기동 (개발 환경에 적합)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6 — 리전 토폴로지 (RESILIENCY-08)
장애 격리 범위를 어디까지 잡을까요?

A) **(권장)** 단일 클러스터 / 단일 존 — 사내 개발 지원 도구. Q1의 RTO 4시간과 정합

B) 단일 리전 / 다중 존(AZ) — 존 장애 대응

C) 다중 리전 — 리전 장애 대응 (Q1에서 C를 고른 경우에만 의미 있음)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 7 — 복원력 테스트 방식 (RESILIENCY-14)
복원력 메커니즘을 어떻게 검증할까요?

A) **(권장)** 수동 시나리오 테스트 — Pod 강제 종료, DB 재기동, n8n 다운 시
   보상 트랜잭션(`X_FAILED`)과 고아 세션 resume이 동작하는지 수동 확인

B) 자동화된 장애 주입 테스트를 CI에 포함

C) Chaos Engineering 도구 도입 (Chaos Mesh 등)

D) 2일 일정상 복원력 테스트 생략 — 설계 원칙만 준수

X) Other (please describe after [Answer]: tag below)

[Answer]: D

## Question 8 — 장애 대응 프로세스 (RESILIENCY-15)
운영 중 장애 발생 시 대응 프로세스는?

A) **(권장)** 이 시스템의 장애대응 Agent(`11-incident-response-agent.md`)를 자기 자신에게 적용 —
   AIways-On 장애도 incident SR로 승격해 처리 (도그푸딩)

B) 사내 기존 장애 대응 프로세스를 따름

C) Slack 채널 알림 + 담당자 수동 대응

D) 아직 정의하지 않음 — v2로 연기

X) Other (please describe after [Answer]: tag below)

[Answer]: D
