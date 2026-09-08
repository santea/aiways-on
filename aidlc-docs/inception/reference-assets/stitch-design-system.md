# Stitch 디자인 시스템 — "Midnight Obsidian"

> **출처**: Stitch project `SDLC Portal V2 UI` (ID `12499844342546553876`), 조회 2026-09-08
> **역할**: `design/웹화면-디자인-요구사항_v1.md`가 **의미적 토큰명만** 정의하고 hex를 의도적으로
> 비워둔 자리를 채우는 **구체 토큰값 공급원**.

## ✅ 디자인 문서와의 정합성 — 완전 일치

| 원칙 | `design/` 문서 §2.1 | Stitch 테마 | 판정 |
|------|--------------------|------------|------|
| No Top Nav | "상단 네비게이션 바 없음" | "Elimination of top navigation in favor of an immovable left-rail" | ✅ |
| No-Line | "테두리 없이 배경색 명도 계층으로만" | "No-Line Constructivism… borders are forbidden" | ✅ |
| Cyan active blade | "좌측 4px Cyan blade + glow" | "Laser-Glow Indicator Blade, width 3px, `#06B6D4` + glow" | ✅ (폭 3px vs 4px — **경미한 불일치**) |
| 타이포 3종 | Manrope / Inter / JetBrains Mono | 동일 | ✅ |
| label-tech | "10px uppercase" | `telemetry-badge` 10px uppercase +0.08em | ✅ |
| 색상 모드 | 명시 없음 (다크 전제로 읽힘) | `colorMode: DARK` (absolute dark primacy) | ⚠️ **확인 필요** |

## 색상 토큰 (Material 3 시맨틱 네이밍)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `surface` / `background` | `#0f131c` | 뷰포트 기본 배경 |
| `surface-container-lowest` | `#0a0e16` | 최하위 계층 |
| `surface-container-low` | `#181c24` | 사이드바 레일, 캔버스 |
| `surface-container` | `#1c2028` | 표 헤더, 비활성 타임라인 노드 |
| `surface-container-high` | `#262a33` | 카드 본문, 모달, 팝오버 |
| `surface-container-highest` | `#31353e` | 마이크로 표면, hover |
| `on-surface` | `#dfe2ee` | 기본 텍스트 |
| `on-surface-variant` | `#bcc9cd` | 보조 텍스트, 중성 상태 |
| `outline` / `outline-variant` | `#869397` / `#3d494c` | (No-Line 원칙상 사용 최소화) |
| **`primary`** | `#4cd7f6` | 진행 중 / active blade |
| `primary-container` | `#06b6d4` | Cyan blade 본체 |
| `on-primary` | `#003640` | primary 위 텍스트 |
| **`secondary`** | `#adc6ff` | 구조적 하이라이트, commit SHA |
| `secondary-container` | `#0566d9` | |
| **`tertiary`** | `#4edea3` | 완료·성공 |
| `tertiary-container` | `#1bbd85` | |
| **`error`** | `#ffb4ab` | 실패·치명 |
| `error-container` | `#93000a` | |

### Override 원색 (디자인 문서의 accent 등급에 대응)

| 역할 | hex | `design/` 문서 매핑 |
|------|-----|-------------------|
| neutral | `#0b0f17` | 기본 배경 |
| **primary (Cyan)** | `#06b6d4` | **accent — 진행 중 상태** |
| **secondary (Blue)** | `#3b82f6` | 구조적 링크, Git SHA |
| **tertiary (Emerald)** | `#10b981` | **success accent — 완료** |
| Amber | `#f59e0b` | **warning accent — 사람 리뷰 대기** |
| Rose | `#ef4444` | **error accent — 실패** |

> ⚠️ Amber(`#f59e0b`)는 Material 토큰 세트에 없고 designMd 본문에만 서술됨.
> `design/` 문서의 warning accent에 대응하므로 **토큰으로 승격 필요**.

## 타이포그래피

| 토큰 | 폰트 | 크기 / 굵기 / 행간 / 자간 |
|------|------|-------------------------|
| `display-lg` | Manrope | 40px / 800 / 48px / -0.03em |
| `display-sm` | Manrope | 28px / 700 / 36px / -0.025em |
| `headline-lg` | Manrope | 22px / 700 / 28px / -0.02em |
| `headline-sm` | Manrope | 18px / 600 / 24px / -0.015em |
| `title-md` | Inter | 15px / 600 / 20px / -0.01em |
| `body-lg` | Inter | 14px / 400 / 22px / 0em |
| `body-sm` | Inter | 12px / 400 / 18px / 0.005em |
| `code-md` | JetBrains Mono | 13px / 500 / 20px / -0.01em |
| `code-sm` | JetBrains Mono | 11px / 500 / 16px / 0em |
| **`telemetry-badge`** | JetBrains Mono | **10px / 700 / 12px / +0.08em, uppercase** |

## 간격 · 라운딩

```
rail-width-expanded   16rem      space-2xs  0.25rem    rounded-sm       0.125rem
rail-width-collapsed  4.5rem     space-xs   0.5rem     rounded DEFAULT  0.25rem
gutter-canvas         1.5rem     space-sm   0.75rem    rounded-md       0.375rem
                                 space-md   1rem       rounded-lg       0.5rem
                                 space-lg   1.5rem     rounded-xl       0.75rem
                                 space-xl   2rem       rounded-full     9999px
                                 space-2xl  3rem
```

**라운딩 적용 규칙**: 버튼·배지·칩·입력 `4px` / 카드·패널·스테이지 블록 `8px` / 모달·드로어 `12px` / 상태 인디케이터·파이프라인 점 `full`

## Elevation — Phosphor Glow

```css
/* 사이드바 active blade */
box-shadow: 0 0 12px rgba(6,182,212,0.65), 0 0 24px rgba(6,182,212,0.25);
/* 실행 중 스테이지 카드 */
box-shadow: 0 8px 32px -4px rgba(6,182,212,0.12);
/* 장애 에스컬레이션 */
box-shadow: 0 0 16px rgba(239,68,68,0.35);
```

## 파이프라인 스테이지 상태 시각 (design 문서 §6과 직결)

| 상태 | 시각 |
|------|------|
| Completed | `#10b981` 노드 + 에메랄드 트레일 빔 |
| Running | 시안 레이더 펄스 + SVG 빔 스윕 애니메이션 |
| Failed | 끊어진 레일 + `#ef4444` 점멸 노드 + 에러코드 텔레메트리 |

## 참고 화면 (사용자 지정 3종 + 추가 발견분)

| 화면 | ID | 크기 | `design/` 문서 대응 |
|------|-----|------|-------------------|
| 장애 대응 상태 레일 및 분석 산출물 | `5a2061636d2647949cbfa4ba3b8600b6` | 2560×3434 | §4.6 장애 상세 + §6.4 |
| 자체개선 스캔 상세 및 Finding 검토 | `849ea9fb6ebe487b99c4686c267a8d6e` | 2560×2722 | §4.9 스캔 상세 + §6.5 |
| SR 상세 및 파이프라인 플로우 | `28e52501550c416d868a64f90b62c913` | 2560×3970 | §4.4 SR 상세 + §6.2·6.3 |
| SDLC 대시보드 *(추가 발견)* | `4210881d96834298b20d2db939089149` | 2560×1304 | §4.2 대시보드 |
| SDLC Portal Logo *(추가 발견)* | `0e63f4e701634ae9bb12535efce1bf59` | 48×48 SVG | 사이드바 로고 |
| SDLC Management Portal Flow *(추가)* | `94bb33089a2546e4af215926fbf057c1` | 1280×1024 | 플로우 개요 |

> HTML/스크린샷은 Stitch MCP `get_screen`으로 필요 시점(UI 구현 단계)에 조회한다.
> 지금 전량 내려받지 않는 이유: 화면당 2,700~4,000px 높이의 HTML은 컨텍스트 비용이 크고,
> 실제로 필요한 시점은 해당 화면을 구현하는 유닛의 Construction 단계다.

## 미해결 사항

| # | 항목 | 내용 |
|---|------|------|
| S-1 | 라이트 모드 | Stitch는 `DARK` 단일. `design/` 문서는 모드 언급 없음. 라이트 모드 지원 여부 결정 필요 |
| S-2 | blade 폭 | `design/` 4px vs Stitch 3px |
| S-3 | Amber 토큰 | warning accent(`#f59e0b`)가 Material 토큰 세트에 부재 — 승격 필요 |
| S-4 | 폰트 조달 | Manrope·Inter·JetBrains Mono — 사내망 self-host vs Google Fonts CDN |
