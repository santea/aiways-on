#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

OS="Linux"
if [ "$OS" = "Linux" ]; then
  echo -e "${YELLOW}🐧 Linux 환경을 감지했습니다.${NC}"
  if ! command -v k3d &> /dev/null; then
    echo -e "${YELLOW}📦 k3d(가벼운 쿠버네티스)를 설치합니다...${NC}"
    curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
  else
    echo -e "${GREEN}✅ k3d 설치됨${NC}"
  fi

  if ! k3d cluster list | grep -q "^ddt-cluster "; then
    echo -e "${YELLOW}📦 k3d 클러스터(ddt-cluster)를 생성합니다...${NC}"
    k3d cluster create ddt-cluster
  else
    echo -e "${GREEN}✅ k3d 클러스터가 이미 실행 중입니다.${NC}"
  fi

  kubectl config use-context k3d-ddt-cluster
fi
