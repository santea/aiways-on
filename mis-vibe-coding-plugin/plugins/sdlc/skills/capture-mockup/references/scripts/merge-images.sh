#!/usr/bin/env bash
# 결정적 Before/After 병합 러너 (Unix 전용 보조 도구 — Linux/WSL/macOS).
#
# Usage:
#   bash merge-images.sh <before.png> <after.png> <out.png>
#
# 원본 픽셀을 리사이즈하지 않고 좌우로 붙인 비교 이미지를 만든다:
#   [흰 여백] before [흰 거터][빨강 구분선][흰 거터] after [흰 여백]
#   + 하단 순수 검정 밴드에 흰 BEFORE/AFTER 라벨(각 패널 정중앙).
# 높이가 다르면 상단 정렬 + 짧은 쪽 하단을 흰색으로 패딩(회색 dead-space 방지).
# 패널 사이 흰 거터로 테마 무관하게 두 스샷을 분리(라이트 페이지 흰 여백 ↔ 다크 사이드바 융합 방지).
#
# exit code: 0=성공 · 1=병합 실패 · 2=인자 오류 · 3=ImageMagick 미설치(병합 생략)
#            · 4=before/after 픽셀 동일(After 미반영 — 편집 전 캡처/Before 덮어씀/file 오설정 의심)
set -euo pipefail

MARGIN=24    # 좌우 바깥 흰 여백
GUTTER=40    # 패널 사이 흰 거터 (빨강 구분선 좌우 각각)
DIV=6        # 중앙 빨강 구분선 두께

usage() {
  echo "usage: bash merge-images.sh <before.png> <after.png> <out.png>" >&2
}

# 인자 검증 — 3개, before/after 실재·크기>0
if [ "$#" -ne 3 ]; then
  usage; exit 2
fi
BEFORE="$1"; AFTER="$2"; OUT="$3"
for f in "$BEFORE" "$AFTER"; do
  if [ ! -s "$f" ]; then
    echo "입력 파일 없음/빈 파일: $f" >&2
    usage; exit 2
  fi
done

# ImageMagick 탐색 — v7 magick 우선, 없으면 v6 convert
IM="$(command -v magick || command -v convert || true)"
if [ -z "$IM" ]; then
  echo "merged 생략: ImageMagick 미설치" >&2
  exit 3
fi
# identify/compare: v7은 `magick identify`·`magick compare`, v6은 별개 바이너리
if command -v magick >/dev/null 2>&1; then
  ident() { magick identify "$@"; }
  cmp_im() { magick compare "$@"; }
else
  ident() { identify "$@"; }
  cmp_im() { compare "$@"; }
fi

# 실측 — fullPage 캡처라 높이가 화면마다 가변, before/after 높이도 다를 수 있음
BW=$(ident -format '%w' "$BEFORE")
BH=$(ident -format '%h' "$BEFORE")
AW=$(ident -format '%w' "$AFTER")
AH=$(ident -format '%h' "$AFTER")
H=$(( BH > AH ? BH : AH ))   # 캔버스 높이 = 큰 쪽

# before==after 동일 이미지 탐지 (After 미반영 방지). 크기 같을 때만 픽셀 비교.
# 완전 동일이면 병합하지 않고 exit 4 — 러너가 After 재캡처를 유도한다.
if [ "$BW" = "$AW" ] && [ "$BH" = "$AH" ]; then
  DIFF=$(cmp_im -metric AE "$BEFORE" "$AFTER" null: 2>&1 || true)
  case "$DIFF" in
    0|0.0|0.00)
      echo "before/after 픽셀 동일 — After 미반영 의심(편집 전 캡처/Before 덮어씀/file 오설정)" >&2
      exit 4 ;;
  esac
fi

# 밴드/폰트 크기 — 이미지 높이 비례로 스케일(풀 높이 페이지에서도 프로미넌트하게)
BAND=$(( H / 12 > 90 ? H / 12 : 90 ))   # 하단 라벨 밴드 높이, 최소 90
PT=$(( BAND * 5 / 10 ))                  # 라벨 폰트 = 밴드 높이의 절반

# 폰트 — DejaVu-Sans-Bold 있으면 쓰고, 없으면 기본 폰트
FONT_ARGS=()
if "$IM" -list font 2>/dev/null | grep -q "DejaVu-Sans-Bold"; then
  FONT_ARGS=(-font DejaVu-Sans-Bold)
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1) 각 이미지를 상단 정렬 + 흰 하단 패딩으로 높이 H에 맞춤 (리사이즈 금지 — extent는 캔버스만 확장)
"$IM" "$BEFORE" -background white -gravity North -extent "${BW}x${H}" "$TMP/b.png"
"$IM" "$AFTER"  -background white -gravity North -extent "${AW}x${H}" "$TMP/a.png"

# 2) [여백] before [거터][빨강 구분선][거터] after [여백] 좌우 연결 (원본 픽셀 그대로)
"$IM" \
  \( -size "${MARGIN}x${H}" xc:white \) "$TMP/b.png" \
  \( -size "${GUTTER}x${H}" xc:white \) \
  \( -size "${DIV}x${H}" xc:red \) \
  \( -size "${GUTTER}x${H}" xc:white \) \
  "$TMP/a.png" \
  \( -size "${MARGIN}x${H}" xc:white \) \
  +append "$TMP/raw.png"

# 3) 하단 라벨 밴드 — 컬럼 스트립 방식. 각 패널 폭과 동일한 검정 스트립을 만들어
#    -gravity center -annotate 로 라벨을 정중앙에 넣고, 레이아웃 컬럼 폭 그대로 +append.
#    좌표 추정/짤림 없음(글자폭 계산 불필요, 컬럼 폭이 패널 폭과 정확히 일치).
MID=$(( GUTTER + DIV + GUTTER ))   # 중앙 거터+구분선+거터 = raw.png의 패널 사이 폭
"$IM" \
  \( -size "${MARGIN}x${BAND}" xc:black \) \
  \( -size "${BW}x${BAND}" xc:black -gravity center -fill white "${FONT_ARGS[@]}" \
     -pointsize "$PT" -annotate 0 'BEFORE' \) \
  \( -size "${MID}x${BAND}" xc:black \) \
  \( -size "${AW}x${BAND}" xc:black -gravity center -fill white "${FONT_ARGS[@]}" \
     -pointsize "$PT" -annotate 0 'AFTER' \) \
  \( -size "${MARGIN}x${BAND}" xc:black \) \
  +append "$TMP/band.png"

# 4) 패널 위에 라벨 밴드를 세로 결합 (raw.png ↔ band.png 폭 동일 → -append 안전)
"$IM" "$TMP/raw.png" "$TMP/band.png" -append "$OUT"

# 5) 결과 실증
if [ ! -s "$OUT" ]; then
  echo "병합 실패: 출력 파일 없음 $OUT" >&2
  exit 1
fi
ident -format 'merged: %wx%h\n' "$OUT"
