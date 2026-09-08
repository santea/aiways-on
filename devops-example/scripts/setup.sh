#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo "  DDT 개발 환경 셋업"
echo "============================================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# OS 및 아키텍처 식별
OS_NAME="$(uname -s)"
case "$OS_NAME" in
  Linux*)               OS_TYPE="linux" ;;
  Darwin*)              OS_TYPE="darwin" ;;
  CYGWIN*|MINGW*|MSYS*) OS_TYPE="windows" ;;
  *)                    OS_TYPE="unknown" ;;
esac

ARCH_NAME="$(uname -m)"
case "$ARCH_NAME" in
  x86_64|amd64) ARCH_TYPE="amd64" ;;
  aarch64|arm64) ARCH_TYPE="arm64" ;;
  *)             ARCH_TYPE="unknown" ;;
esac

# 1. conda 확인 및 자동 설치
if ! command -v conda &> /dev/null; then
  echo -e "${YELLOW}📦 Conda가 설치되어 있지 않습니다. 자동 설치를 진행합니다...${NC}"
  
  MINICONDA_URL=""
  if [ "$OS_TYPE" = "darwin" ]; then
    if [ "$ARCH_TYPE" = "arm64" ]; then
      MINICONDA_URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh"
    else
      MINICONDA_URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh"
    fi
  elif [ "$OS_TYPE" = "linux" ]; then
    if [ "$ARCH_TYPE" = "arm64" ]; then
      MINICONDA_URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh"
    else
      MINICONDA_URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh"
    fi
  elif [ "$OS_TYPE" = "windows" ]; then
    MINICONDA_URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe"
  fi

  if [ -n "$MINICONDA_URL" ]; then
    if [ "$OS_TYPE" = "windows" ]; then
      echo "Windows용 Miniconda 다운로드 중..."
      curl -Lo miniconda.exe "$MINICONDA_URL"
      echo "Miniconda 설치 중 (약 1~2분 소요)..."
      
      if command -v cygpath &> /dev/null; then
        WIN_DEST="$(cygpath -w "$HOME/miniconda3")"
      else
        WIN_DEST="${USERPROFILE}\\miniconda3"
      fi
      
      ./miniconda.exe /InstallationType=JustMe /RegisterPython=0 /AddToPath=0 /S /D="$WIN_DEST"
      rm miniconda.exe
      
      export PATH="$HOME/miniconda3/Scripts:$HOME/miniconda3/condabin:$HOME/miniconda3:$PATH"
      "$HOME/miniconda3/Scripts/conda.exe" init bash > /dev/null 2>&1 || true
    else
      echo "Miniconda 다운로드 중..."
      curl -Lo miniconda.sh "$MINICONDA_URL"
      echo "Miniconda 설치 중..."
      bash miniconda.sh -b -p "$HOME/miniconda3"
      rm miniconda.sh
      
      export PATH="$HOME/miniconda3/bin:$PATH"
      "$HOME/miniconda3/bin/conda" init bash > /dev/null 2>&1 || true
      "$HOME/miniconda3/bin/conda" init zsh > /dev/null 2>&1 || true
    fi
    
    echo -e "${GREEN}✅ Conda 자동 설치 완료!${NC}"
    echo -e "${YELLOW}⚠️ 지금 바로 환경을 적용하려면 아래 명령어 중 하나를 터미널에 실행하세요:${NC}"
    echo "   source ~/.zshrc    (Mac 사용자)"
    echo "   source ~/.bashrc   (Linux / Git Bash 사용자)"
    echo -e "${YELLOW}적용 후 본 스크립트를 다시 실행해 주세요!${NC}"
    exit 0
  else
    echo -e "${RED}❌ 이 운영체제 아키텍처에서는 자동 설치를 지원하지 않습니다.${NC}"
    echo "   수동 설치: https://docs.conda.io/en/latest/miniconda.html"
    exit 1
  fi
fi
echo -e "${GREEN}✅ conda 준비됨${NC}"

# 1.5 Conda ToS 자동 동의 (최초 실행 시 에러 방지)
echo -e "${YELLOW}📜 Conda 채널 ToS 자동 동의 처리 중...${NC}"
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main >/dev/null 2>&1 || true
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r >/dev/null 2>&1 || true

# 2. conda 환경 생성/업데이트
if conda env list | grep -q "^ddt "; then
  echo -e "${YELLOW}📦 conda 환경 'ddt' 업데이트 중...${NC}"
  conda env update -f environment.yml --prune
else
  echo -e "${YELLOW}📦 conda 환경 'ddt' 생성 중...${NC}"
  conda env create -f environment.yml
fi

echo ""
echo -e "${YELLOW}⚠️  conda 환경을 활성화하세요:${NC}"
echo "   conda activate ddt"
echo ""

if [[ "${CONDA_DEFAULT_ENV:-}" != "ddt" ]]; then
  echo -e "${YELLOW}현재 conda 환경이 'ddt'가 아닙니다. 활성화 후 다시 실행해주세요.${NC}"
  exit 0
fi

# OS 및 아키텍처 식별
OS_NAME="$(uname -s)"
case "$OS_NAME" in
  Linux*)               OS_TYPE="linux" ;;
  Darwin*)              OS_TYPE="darwin" ;;
  CYGWIN*|MINGW*|MSYS*) OS_TYPE="windows" ;;
  *)                    OS_TYPE="unknown" ;;
esac

ARCH_NAME="$(uname -m)"
case "$ARCH_NAME" in
  x86_64|amd64) ARCH_TYPE="amd64" ;;
  aarch64|arm64) ARCH_TYPE="arm64" ;;
  *)             ARCH_TYPE="unknown" ;;
esac

# 2.5 Skaffold 설치
echo ""
echo -e "${YELLOW}📦 Skaffold 설치 확인 중...${NC}"
if ! command -v skaffold &> /dev/null; then
  if [ "$OS_TYPE" = "windows" ]; then
    echo "Windows용 Skaffold 바이너리를 다운로드합니다."
    curl -Lo skaffold.exe "https://storage.googleapis.com/skaffold/releases/latest/skaffold-windows-${ARCH_TYPE}.exe"
    mkdir -p "$HOME/bin"
    mv skaffold.exe "$HOME/bin/"
    echo -e "${YELLOW}⚠️ PATH에 $HOME/bin 이 추가되어 있어야 합니다.${NC}"
    export PATH="$HOME/bin:$PATH"
  elif [ "$OS_TYPE" = "darwin" ] && command -v brew &> /dev/null; then
    echo "brew로 skaffold를 설치합니다."
    brew install skaffold
  else
    echo "Google 공식 바이너리로 skaffold를 설치합니다."
    curl -Lo skaffold "https://storage.googleapis.com/skaffold/releases/latest/skaffold-${OS_TYPE}-${ARCH_TYPE}"
    sudo install skaffold /usr/local/bin/
    rm skaffold
  fi
  echo -e "${GREEN}✅ Skaffold 설치 완료${NC}"
else
  echo -e "${GREEN}✅ Skaffold 이미 설치됨${NC}"
fi

# 3. Docker 및 OS별 K8s 확인
if [ "$OS_TYPE" = "linux" ]; then
  echo -e "${YELLOW}🐧 Linux 환경을 감지했습니다.${NC}"
  
  if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}📦 Docker Engine을 자동 설치합니다...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh || { echo -e "${RED}❌ Docker 설치 실패. 수동으로 설치해주세요.${NC}"; exit 1; }
    sudo usermod -aG docker "$USER"
    rm get-docker.sh
    echo -e "${YELLOW}⚠️ Docker 권한 부여를 위해 로그아웃 후 다시 로그인해야 할 수 있습니다.${NC}"
  else
    echo -e "${GREEN}✅ Docker 설치됨${NC}"
  fi

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
else
  # Mac / Windows(Git Bash)
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker가 설치되어 있지 않습니다.${NC}"
    echo "   설치: https://docker.com (Docker Desktop 설치 후 Kubernetes를 Enable 해주세요)"
    exit 1
  fi
  echo -e "${GREEN}✅ Docker 설치됨${NC}"
fi

# 4. 의존성 설치
echo ""
echo "📦 앱 의존성 설치 중..."
(cd portal && pnpm install)

echo ""
echo "📦 MCP Server 의존성 설치 중..."
(cd mcp-server && pnpm install)

echo ""
echo "📦 SDLC Pod Runner 의존성 설치 중..."
(cd sdlc-pod-runner && npm install)

echo ""
echo "📦 Prisma 클라이언트 생성 중..."
(cd portal && pnpm db:generate)

# 5. Husky 설정
echo ""
echo "🔧 Husky git hooks 설정 중..."
(cd portal && pnpm exec husky init) 2>/dev/null || true
echo 'pnpm --dir portal exec lint-staged' > portal/.husky/pre-commit
echo 'pnpm --dir portal exec commitlint --edit $1' > portal/.husky/commit-msg

# 6. .env 생성
if [ ! -f portal/.env ]; then
  cp portal/.env.example portal/.env
  echo -e "${YELLOW}📝 .env 파일이 생성되었습니다. GitHub OAuth 설정을 입력해주세요.${NC}"
fi

# 7. kubectl 자동 완성(Autocompletion) 설정
echo ""
echo -e "${YELLOW}⚙️  kubectl 자동 완성(Autocompletion) 설정 중...${NC}"
if command -v kubectl &> /dev/null; then
  # Bash
  if [ -f ~/.bashrc ] && ! grep -q "kubectl completion bash" ~/.bashrc; then
    echo -e "\n# kubectl autocompletion & alias" >> ~/.bashrc
    echo 'source <(kubectl completion bash)' >> ~/.bashrc
    echo 'alias k=kubectl' >> ~/.bashrc
    echo 'complete -o default -F __start_kubectl k' >> ~/.bashrc
  fi
  # Zsh
  if [ -f ~/.zshrc ] && ! grep -q "kubectl completion zsh" ~/.zshrc; then
    echo -e "\n# kubectl autocompletion & alias" >> ~/.zshrc
    echo 'source <(kubectl completion zsh)' >> ~/.zshrc
    echo 'alias k=kubectl' >> ~/.zshrc
    echo 'compdef __start_kubectl k' >> ~/.zshrc
  fi
  echo -e "${GREEN}✅ 터미널 재시작 시 kubectl 자동 완성이 적용됩니다.${NC}"
else
  echo -e "${RED}❌ kubectl을 찾을 수 없어 자동 완성 설정을 건너뜁니다.${NC}"
fi

echo ""
echo "============================================"
echo -e "${GREEN}🎉 셋업 완료!${NC}"
echo ""
echo "개발 환경 시작:"
echo "  conda activate ddt"
echo "  skaffold dev"
echo ""
echo "접속 주소:"
echo "  App:        http://localhost:3000"
echo "  n8n:        http://localhost:5678"
echo "  MCP:        http://localhost:3001"
echo "  PostgreSQL: localhost:5432"
echo "  Minio (S3): http://localhost:9001 (API: 9000)"
echo "============================================"
