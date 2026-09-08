# DDT (Development & Deployment Toolkit)

DDT는 팀원 간 완벽하게 통일된 개발 환경(Mac, Windows, Linux)을 제공하기 위해 구성된 차세대 어플리케이션 프로젝트입니다.

## 🌟 아키텍처 및 기술 스택

* **Frontend/Backend:** Next.js 15 (App Router), Tailwind CSS v4, shadcn/ui
* **Database & ORM:** PostgreSQL 16, Prisma
* **Authentication:** NextAuth.js v5 (GitHub OAuth)
* **Workflow Automation:** n8n
* **AI Tooling:** MCP Server (SSE 방식)
* **Dynamic Pod:** SDLC Pod Runner (Next.js에서 동적 생성)
* **Infrastructure:** Docker, Kubernetes (Docker Desktop / k3d), Helm, Skaffold
* **Environment Manager:** Conda (`environment.yml`)

---

## 🚀 시작하기

### 1. 사전 요구사항 (Prerequisites)

모든 팀원은 OS에 상관없이 **Conda**와 **Docker**가 필요합니다.

* **Conda:** [Miniconda](https://docs.conda.io/en/latest/miniconda.html) 또는 Anaconda 설치
* **Mac / Windows:** [Docker Desktop](https://www.docker.com/) 설치 후, 설정(Settings) > Kubernetes 탭에서 **Enable Kubernetes**를 반드시 켜주세요.
* **Linux:** 사전 설치 불필요 (아래의 `setup.sh` 스크립트가 Docker Engine과 `k3d` 쿠버네티스를 자동 설치합니다)

### 2. 자동 환경 셋업

스크립트 하나로 의존성(Node.js, pnpm, Helm, Skaffold)과 Git 훅, 환경 변수 템플릿이 구성됩니다.

**Mac / Linux**
```bash
./scripts/setup.sh
```

**Windows (PowerShell)**
```powershell
.\scripts\setup.ps1
```

> **주의:** 셋업이 끝나면 `portal/.env` 파일이 생성됩니다. GitHub OAuth 연동을 위해 `AUTH_GITHUB_ID`와 `AUTH_GITHUB_SECRET`을 발급받아 채워주세요.

### 3. 프로젝트 실행

Conda 가상 환경을 활성화하고 Skaffold로 전체 인프라를 한 번에 띄웁니다.

```bash
conda activate ddt
skaffold dev
```

### 4. 접속 주소
* **App (Next.js):** http://localhost:3000
* **PostgreSQL:** localhost:5432 (DB명: `ddt`, `n8n`)
* **n8n:** http://localhost:5678
* **MCP Server:** http://localhost:3001/health

---

## 🏗 프로젝트 주요 구조

* `portal/`: Next.js 애플리케이션 코드 (UI 및 비즈니스 로직)
* `mcp-server/`: AI 컨텍스트 제공용 MCP 서버
* `sdlc-pod-runner/`: App 내부에서 쿠버네티스 API로 동적 생성할 작업 Pod 이미지의 소스 코드
* `helm/ddt/`: 전체 애플리케이션 및 인프라 구성을 정의하는 Helm 차트
* `skaffold.yaml`: 로컬 K8s 빌드 및 배포, 핫 리로드(File sync) 설정

> 💡 **SDLC Pod Runner 활용법:**
> `skaffold` 실행 시 Runner 이미지가 자동으로 빌드되며, 해당 이미지의 정확한 태그가 Next.js 앱의 `SDLC_RUNNER_IMAGE` 환경 변수로 주입됩니다. 앱 코드에서 `process.env.SDLC_RUNNER_IMAGE`를 읽어 K8s Job이나 Pod를 동적으로 띄울 수 있습니다.

---

## 🛠 트러블슈팅 (Troubleshooting)

실행 중 문제가 발생할 경우 아래의 해결 방법을 참고하세요.

### 1. `skaffold dev` 실행 시 "command not found: skaffold" 에러
* **원인:** Conda 환경이 활성화되지 않았습니다.
* **해결:** 터미널에서 `conda activate ddt`를 실행하여 런타임 환경을 활성화하세요.

### 2. `ErrImageNeverPull` 또는 이미지를 찾을 수 없다는 에러 (Kubernetes Pod 오류)
* **원인:** 쿠버네티스 클러스터가 로컬 Docker 데몬의 이미지를 읽지 못하고 있습니다.
* **해결:** 
  * Docker Desktop을 사용하는 경우, 최신 버전의 containerd 통합 설정 문제일 수 있습니다. 설정에서 `Use containerd for pulling and storing images`를 해제해 보세요.
  * 그래도 안 된다면, `helm/ddt/values-dev.yaml`에서 `pullPolicy: Never`를 `pullPolicy: IfNotPresent`로 변경하세요.

### 3. 포트 충돌 (Port is already allocated)
* **원인:** 3000, 5432, 5678, 3001 중 하나를 이미 다른 프로그램(예: 로컬 PostgreSQL)이 사용 중입니다.
* **해결:** 사용 중인 프로그램을 종료하거나, `skaffold.yaml`의 `portForward` 영역과 `helm/ddt/values.yaml`에서 충돌하는 포트 번호를 변경하세요.

### 4. Linux에서 Docker 권한 오류 (`permission denied while trying to connect to the Docker daemon`)
* **원인:** `setup.sh`가 사용자를 `docker` 그룹에 추가했지만, 아직 현재 세션에 반영되지 않았습니다.
* **해결:** 터미널을 완전히 종료하고 다시 로그인(또는 SSH 재접속)한 뒤 실행하세요.

### 5. Prisma DB 연결 오류 또는 쿼리 에러
* **원인:** DB 스키마가 최신 상태로 동기화되지 않았습니다.
* **해결:** `skaffold dev`가 실행 중인 상태에서 다른 터미널을 열고 아래 명령어를 실행하세요.
  ```bash
  conda activate ddt
  pnpm db:push
  ```

### 6. n8n 워크플로우 저장 오류
* **원인:** PostgreSQL 컨테이너가 정상적으로 준비되기 전에 n8n이 연결을 시도하여 실패했을 수 있습니다.
* **해결:** `kubectl get pods`로 상태를 확인하고, n8n pod가 오류 상태라면 `kubectl delete pod <n8n-pod-이름>`으로 재시작해 보세요.

### 7. 로그 확인 및 디버깅 가이드 (kubectl 활용)

`skaffold dev`는 기본적으로 터미널에 모든 컨테이너의 로그를 스트리밍해 주지만, 특정 Pod의 상태를 더 자세히 디버깅하거나 K8s 리소스를 확인해야 할 때는 다른 터미널 창을 열고 `kubectl` 명령어를 활용할 수 있습니다.

**주요 kubectl 명령어 모음:**

* **모든 리소스 상태 확인:**
  ```bash
  kubectl get pods,svc,deployments
  ```
  *(각 Pod가 `Running` 상태인지, 재시작(Restarts) 횟수가 증가하지 않는지 확인합니다.)*

* **특정 Pod의 로그 확인:**
  ```bash
  # 앱 컨테이너 로그 확인 (-f 옵션으로 실시간 스트리밍)
  kubectl logs -f deployment/ddt-app
  
  # MCP 서버 로그 확인
  kubectl logs -f deployment/ddt-mcp
  
  # PostgreSQL 데이터베이스 로그 확인
  kubectl logs -f deployment/ddt-postgres
  ```

* **Pod 내부에 직접 셸(Shell) 접속하기:**
  만약 컨테이너 내부의 파일 구조나 환경변수를 직접 확인하고 싶다면 아래 명령어로 접속할 수 있습니다.
  ```bash
  # App 컨테이너에 sh로 접속
  kubectl exec -it deployment/ddt-app -- sh
  
  # PostgreSQL 컨테이너에 접속하여 psql 실행
  kubectl exec -it deployment/ddt-postgres -- psql -U ddt -d ddt
  ```

* **환경 및 배포 완전히 초기화하기 (Clean Up):**
  설정이 꼬이거나 DB 데이터를 완전히 초기화하고 싶다면 다음 과정을 수행하세요.
  ```bash
  # 1. 실행 중인 skaffold dev 종료 (Ctrl + C)
  # 2. k8s에 배포된 ddt 관련 모든 리소스 삭제
  skaffold delete
  
  # 3. 데이터베이스 볼륨(PVC) 삭제 (데이터 완전 초기화)
  kubectl delete pvc ddt-postgres-pvc
  ```
