# syntax=docker/dockerfile:1.7
#
# sdlc-pod-runner image.
#
# Base: miniconda3. The Pod runner provisions a per-session conda env at
# <workspace>/.conda when CreateSessionRequest.conda_env_spec is set, so the
# system-wide `conda` binary must be available. The Claude Code CLI is installed
# via npm; if your base ships `claude` already, set CLAUDE_BIN and drop the npm
# layer.
#
# Runs as the non-root `runner` user.

FROM continuumio/miniconda3:26.3.2 AS base

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    WORKSPACE_ROOT=/workspaces \
    CONDA_BIN=/opt/conda/bin/conda

# git, nodejs, npm, conda 모두 단일 RUN 에서 처리 (layer 최소화)
# /etc/npmrc 와 /opt/conda/.condarc 를 생성하고 runner 도 읽기 가능하도록 chmod
# APT GPG 검증 우회: --allow-unauthenticated + trusted=yes 설정
# Node.js 는 conda-forge 에서 설치 (내부 conda 미러 사용, .condarc 파일 직접 생성)
# NPM registry 는 install 전에 먼저 설정
RUN echo 'APT::Get::AllowUnauthenticated "true";' > /etc/apt/apt.conf.d/99allow-unauthenticated \
    && echo 'deb http://repository.domain.net/repository/proxy-apt-mirror.kakao.com-debian trixie main' > /etc/apt/sources.list \
    && echo 'deb http://repository.domain.net/repository/proxy-apt-mirror.kakao.com-debian trixie-updates main' >> /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates gh jq \
      vim nano curl htop unzip tar iputils-ping dnsutils imagemagick \
      chromium fonts-noto-cjk fonts-noto-color-emoji net-tools coreutils \
    && update-ca-certificates \
    && echo 'channel_alias: http://repository.domain.net/repository/proxy-conda-conda.anaconda.org/' > /opt/conda/.condarc \
    && echo 'ssl_verify: false' >> /opt/conda/.condarc \
    && echo 'channels:' >> /opt/conda/.condarc \
    && echo '  - conda-forge' >> /opt/conda/.condarc \
    && echo '  - nvidia' >> /opt/conda/.condarc \
    && echo '  - pytorch' >> /opt/conda/.condarc \
    && echo '  - rapidsai' >> /opt/conda/.condarc \
    && conda install -y -c conda-forge nodejs=20 gh jq conda-pack \
    && echo "registry=http://repository.domain.net/repository/proxy-npm-registry.npmjs.org/" > /etc/npmrc \
    && npm config set registry http://repository.domain.net/repository/proxy-npm-registry.npmjs.org/ \
    && echo "@artifact:registry=https://artifactory.domain.net/repository/observability-ahub-npm/" >> /etc/npmrc \
    && npm config set @artifact:registry https://artifactory.domain.net/repository/observability-ahub-npm/ \
    && npm config set strict-ssl false \
    && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install -g @anthropic-ai/claude-code @playwright/mcp playwright \
    && rm -rf /var/lib/apt/lists/* \
    && chmod 644 /etc/npmrc /opt/conda/.condarc

# bash 초기화 및 bashrc에 activate 명령어 추가
RUN conda init bash && \
    echo "conda activate base" >> ~/.bashrc

# 2. 로그인 쉘(-l)을 호출하여 base 환경 활성화 후 단일 레이어에서 playwright base conda 에서 설치
RUN /bin/bash -l -c "conda activate base && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install -g @anthropic-ai/claude-code @playwright/mcp playwright"

WORKDIR /srv

# pip 내부 리포지토리 설정 (pyproject.toml 보다 우선)
RUN echo '[global]' > /etc/pip.conf \
    && echo 'index-url = http://repository.domain.net/repository/proxy-pypi-files.pythonhosted.org/simple/' >> /etc/pip.conf \
    && echo 'extra-index-url =' >> /etc/pip.conf \
    && echo '  http://repository.domain.net/repository/proxy-pypi-pypi.nvidia.com/simple/' >> /etc/pip.conf \
    && echo '  https://artifactory.domain.net/repository/observability-ahub-pypi/simple/' >> /etc/pip.conf \
    && echo 'trusted-host =' >> /etc/pip.conf \
    && echo '  repository.domain.net artifactory.domain.net' >> /etc/pip.conf

COPY pyproject.toml README.md ./
COPY app ./app

RUN pip install .

# sudo 설치 및 runner 사용자를 sudoers 에 추가 (NOPASSWD)
RUN apt-get update && apt-get install -y sudo \
    && useradd --create-home --shell /bin/bash runner \
    && echo "runner ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers \
    && mkdir -p ${WORKSPACE_ROOT} \
    && chown -R runner:runner ${WORKSPACE_ROOT} /srv /opt/conda/pkgs \
    && mkdir -p /home/runner/.npmrc.d \
    && echo "registry=http://repository.domain.net/repository/proxy-npm-registry.npmjs.org/" > /home/runner/.npmrc \
    && echo "@artifact:registry=https://artifactory.domain.net/repository/observability-ahub-npm/" >> /home/runner/.npmrc \
    && chown runner:runner /home/runner/.npmrc

USER runner

# ── LiteLLM 연결 설정 (settings.json에 env/model alias 포함, API key는 런타임 주입) ──
COPY --chown=runner:runner claude-settings.json /home/runner/.claude/override-settings.json
COPY --chown=runner:runner claude-settings.json /home/runner/.claude/settings.json

# -- 
# /workspaces/session 경로를 ~/.claude.json에 hasTrustDialogAccepted true 로 설정 하는 등의 설정
COPY --chown=runner:runner claude.json /home/runner/.claude.json

# ── SDLC 글로벌 에이전트 지침 ─────────────────────────────────────────────────
COPY --chown=runner:runner claude-global.md /home/runner/.claude/CLAUDE.md
COPY --chown=runner:runner .claude/agents/ /home/runner/.claude/agents/

# ── OMC 플러그인 설치 (내부 mirror 사용) ────────────────────────────────────────
# 선행 조건: github.domain.net/BIA/oh-my-claudecode 에 mirror 되어 있어야 함
RUN claude plugin marketplace add https://github.domain.net/BIA/oh-my-claudecode.git \
    && claude plugin install oh-my-claudecode@omc --scope user \
    && claude plugin marketplace add https://github.domain.net/BIA/mis-vibe-coding.git \
    && claude plugin install sdlc@mvc --scope user \
    && claude plugin install vibe-coding-setup@mvc --scope user

# ── Playwright MCP 등록 (전역 설치된 playwright-mcp 바이너리 사용, air-gapped) ──
# 컨테이너는 display 없으므로 --headless 필수. self-signed HTTPS 대응 --ignore-https-errors
RUN CHROMIUM_BIN=$(which chromium-browser 2>/dev/null || which chromium 2>/dev/null || echo "/opt/conda/bin/chromium") \
    && claude mcp add playwright -s user -- \
    playwright-mcp --headless --executable-path "$CHROMIUM_BIN" --ignore-https-errors

# omc 링크 + claude-dsassistant wrapper (root 권한 필요)
USER root
RUN OMC_BIN=$(ls /home/runner/.claude/plugins/cache/omc/oh-my-claudecode/*/bin/oh-my-claudecode.js | tail -1) \
    && ln -sf "$OMC_BIN" /usr/local/bin/omc \
    && ln -sf "$OMC_BIN" /usr/local/bin/oh-my-claudecode
COPY claude-dsassistant /usr/local/bin/claude-dsassistant
RUN chmod +x /usr/local/bin/claude-dsassistant

# initContainer용 PVC 초기화 스크립트 (Pod spec initContainer 에서 사용)
COPY init-workspace.sh /usr/local/bin/init-workspace.sh
RUN chmod +x /usr/local/bin/init-workspace.sh

USER runner

EXPOSE 58001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request,sys; \
    sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:58001/health', timeout=2).status==200 else 1)"

ENV CLAUDE_BIN=claude-dsassistant \
    SSL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "58001"]