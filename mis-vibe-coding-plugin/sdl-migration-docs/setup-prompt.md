# 마이그레이션 환경 초기 세팅 프롬프트

새 프로젝트에서 Claude Code와 함께 마이그레이션을 시작할 때 아래 프롬프트를 그대로 붙여넣어 사용합니다.  
프롬프트는 단계별로 나뉘어 있으며, **순서대로** 실행합니다.

---

## STEP 1 — 프로젝트 분석 요청

> 먼저 구 소스와 신규 플랫폼 소스를 Claude에게 파악시킵니다.

```
아래 두 프로젝트를 분석해줘.

[구 소스]
- 경로: [구 소스 절대경로 ex. C:\project\old-app]

[신규 플랫폼 (DEMO 소스)]
- 경로: [신규 소스 절대경로 ex. C:\project\new-app]

분석 항목:
1. 구 소스의 전체 패키지 구조와 주요 도메인 목록
2. 신규 플랫폼의 디렉토리 구조, 공통 모듈, 인증 방식 (Controller에서 userId 가져오는 방식)
   — [신규 소스 경로]/doc/ 하위의 아키텍처 및 매뉴얼 문서(.adoc, .md 등)를 함께 읽고 반영해줘
   — 특히 [신규 소스 경로]/doc/아키텍처/ 폴더가 있으면 우선 확인
3. 구 소스 → 신규 플랫폼 간 테이블명/컬럼명 변경 내역 ([SDL 관련 DDL, INICIAL SQL 파일들 상위 폴더 내 상세 경로] 참고 후 제공)
4. 신규 플랫폼 demo의 Vue 컴포넌트 패턴 (MainTopMenu.vue, MainSideMenu.vue, 기존 List.vue 등)

분석 후 결과를 요약 저장해줘.
```

---

## STEP 2 — project-env.md 생성 요청

> STEP 1 분석 결과를 바탕으로 환경 설정 파일을 생성합니다.

```
STEP 1 분석 결과를 바탕으로 아래 경로에 project-env.md를 생성해줘.

생성 경로: [신규 소스 경로]/.claude/project-env.md

포함할 내용:
- 프로젝트 경로 (구 소스 / 신규 소스 / 현재 작업 디렉토리)
- 기술 스택 비교표 (구 vs 신규)
- 신규 DB 표준 테이블 목록 (초기에는 대표 테이블만 넣고, 기능 마이그레이션 시 해당 테이블 매핑을 그때그때 추가 — Claude가 Mapper 작성 시 참조)
- 인증 방식 (운영/dev 서버 vs 로컬 개발 환경)
- 주의사항 (경로 혼동, iBatis→MyBatis 문법 차이 등 실수하기 쉬운 것)

포트 설정은 포함하지 않아도 돼.

작성 시 주의사항:
- 경로는 반드시 절대경로로 작성 — 상대경로 사용 시 Claude가 파일을 찾지 못할 수 있음
- 로컬 인증 우회 방법을 명확히 명시 — 로컬에서 인증이 막히면 작업이 중단됨
- 표준 테이블 목록은 처음에 전부 채우려 하지 말 것 — 기능 마이그레이션할 때 해당 테이블 매핑을 확인하면서 추가해가는 것이 현실적
```

---

## STEP 3 — migration-rules.md 생성 요청

> 마이그레이션 전반에 걸쳐 Claude가 지켜야 할 원칙을 정리합니다.

```
아래 내용을 포함한 migration-rules.md를 생성해줘.

생성 경로: [신규 소스 경로]/.claude/migration-rules.md

각 섹션을 작성하기 전에 반드시 아래 순서로 신규 소스를 직접 읽어서 실제 값을 채워넣어줘:
- 백엔드 패턴 → [신규 소스 경로]/src/main/java/ 하위의 Controller, Service, Mapper 실제 소스 읽기
- UI 디자인 원칙 → [신규 소스 경로]/frontend/src/components/ 하위의 공통 레이아웃 컴포넌트 읽기
- 메뉴 등록 원칙 → [신규 소스 경로]/doc/sql/ 또는 기존 메뉴 등록 SQL 파일 읽기
- DB 변환 규칙 → [신규 소스 경로]/src/main/resources/sql/ 하위 Mapper XML 읽기
- 공통 모듈 매핑 → STEP 1 분석 결과의 import 목록 기반으로 채우기

추측으로 채우지 말고, 읽은 실제 코드 기준으로 작성해줘.

### 포함할 섹션

1. 공통 원칙
   - 비즈니스 로직 변경 금지, 구조/형식만 변환
   - 변경 부분마다 주석 표시 규칙
   - 신규 DEMO 패턴 우선 적용
   - demo 공통 모듈(인증, 파일업로드, 페이징 등)은 그대로 사용

2. UI 디자인 원칙 - [원하는 디자인 있을 경우]
   - 신규 플랫폼 demo 소스([신규 소스 경로]/frontend/src/components/)에서
     실제 색상값, 레이아웃 수치를 읽어서 채워줘
   - 색상 시스템 (포인트 컬러, 기본/보조 텍스트, 배경)
   - 레이아웃 (헤더 높이, 사이드바 너비, 카드 border-radius 등)
   - 적용 위치 (활성 메뉴, 버튼, 팝업 헤더 등)

3. 메뉴 등록 원칙
   - 신규 플랫폼의 메뉴 DB 구조 (관련 테이블 3개 이상인 경우 전부)
   - 메뉴 ID 체계 
   - 구 DB 메뉴 이식 절차 (STEP 0 조회 → 계층 검증 → INSERT/UPDATE → 권한 등록)
   - EXTERNAL_URL 교체 원칙
     - STEP 5에서 구 DB 메뉴를 이식하면 EXTERNAL_URL에 구 `.do` URL이 그대로 들어옴
     - 각 기능 마이그레이션 시 해당 메뉴의 EXTERNAL_URL을 신규 Vue 라우팅 경로로 UPDATE 필요
     - 예) `/mgmt/banner/pageListMgmtBanner.do` → `/admin/banners`
   - 주의사항 (JSON 파싱 오류 방지, 트리 구조 오류 방지 등)
   - LABEL_JSON 표준 형식

4. 체크리스트 관리 원칙
   - 체크리스트 파일 경로
   - 테스트 완료 후에만 통합 체크리스트 체크

5. 데이터 이관 원칙
   - 이관 시점: 기능별 즉시 이관 (기능 개발 + 메뉴 DB 등록 완료 직후, 마지막 일괄 이관 금지)
   - FK 체인 파악 원칙: 부모/자식 테이블 확인 쿼리 포함
   - FK 묶음 이관: FK로 엮인 테이블은 한 트랜잭션에서 부모 → 자식 순서로 이관
   - 이관 SQL 패턴: `WHERE NOT EXISTS` 중복 방지, 컬럼 매핑 명시
   - 주의사항: SDL 표준 테이블 컬럼명 변경 주의, 업무 도메인 테이블 존재 여부 사전 확인
   - **db_migration_status.md 업데이트 원칙**: 이관 완료 시마다 `doc/db_migration_status.md`의 테이블 상태(✅/🔄/🔗/❌)와 비고(사용 SQL 파일명) 업데이트, 신규 SQL 파일 작성 시 "사용된 SQL 파일" 섹션에 추가
   - **SQL 파일 목록 정합성 유지**: SQL 파일 삭제·이름 변경 시 status.md의 해당 항목도 즉시 제거·수정. 주기적으로 `doc/sql/` 실제 파일 목록과 status.md 내용 일치 여부 확인 (존재하지 않는 파일 항목 제거, 미등록 파일 추가)

6. DB 변환 규칙
   - 신규 DB 공통 기능 스키마는 아래 파일 참고 (필요 시):
     - DDL: `D:/project/mssql/MSSQL_DDL.sql` — 전체 테이블 구조
     - 초기 데이터: `D:/project/mssql/MSSQL_INITIAL.sql` — 메뉴/권한 등 기본 데이터
     - 컬럼 설명: `D:/project/mssql/MSSQL_COMMENT.sql`
   - 구 DB의 업무 도메인 테이블은 신규 DB 스키마 기준으로 단계적 이관을 전제로 한다.
     각 기능 마이그레이션 시 해당 기능에 필요한 테스트 데이터 또는 초기 데이터가 필요한 경우,
     신규 DB 컬럼 구조에 맞는 INSERT/UPSERT SQL을 생성하여 제공한다.
     (FK 참조 순서 준수, NOT NULL 컬럼 누락 방지, 기존 데이터 중복 방지 포함)
     또한 구 DB의 테이블 구조 또는 데이터 확인이 필요한 경우,
     구 DB 대상의 확인용 SELECT SQL(컬럼 목록 조회, 데이터 샘플 조회 등)도 함께 제공한다.
   - SQL 작성 원칙 (FK 값 추측 금지, NOT NULL 컬럼 확인 등)
   - 컬럼 일치 여부 확인 원칙: 테이블명이 같아도 구 DB와 신 DB 간 컬럼이 다를 수 있으므로,
     이관 전 양쪽에서 아래 쿼리로 컬럼 목록을 비교한 뒤 이관 방식을 결정한다
     (컬럼명·타입 완전 일치 → SELECT * 이관 가능 /
      컬럼명 다르거나 NOT NULL 컬럼 추가 → SELECT 절에 컬럼 매핑 명시 /
      신 DB에만 있는 컬럼 → NULL, '0', GETDATE() 등 기본값으로 채움)
     ```sql
     SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = '확인할_테이블명'
     ORDER BY ORDINAL_POSITION;
     ```
   - 컬럼 매핑이 필요한 경우 데이터 예시 확인 필수: 컬럼 목록 비교만으로는 실제 값 형식을
     알 수 없으므로, 매핑 방식 결정 전 반드시 **구 DB와 신 DB 양쪽** 실데이터 샘플을 확인한다
     (날짜 포맷, 코드값 형식, NULL 허용 여부 등이 예상과 다를 수 있음)
     - 구 DB 샘플: 값 형식 파악
     - 신 DB 샘플: 기존 레코드 패턴 확인 → 이관 데이터가 동일 형식을 따르도록 맞춤
     ```sql
     -- 구 DB / 신 DB 각각 실행
     SELECT TOP 5 * FROM 이관할_테이블명 ORDER BY 1;
     ```
   - 인덱스 확인 원칙

6. 공통 모듈 매핑
   - 구 프레임워크 라이브러리 → 신규 모듈 대응표
   (STEP 1에서 분석한 import 목록 기반으로 채워줘)

7. 백엔드 패턴
   - Controller 표준 코드 — [신규 소스 경로]/src/main/java/ 하위 실제 Controller 읽고 패턴 그대로 작성
     (의존성 주입 방식, userId 획득 코드, 인증 우회 방식 포함)
   - userId 획득 방식 — demo에서 실제 사용하는 코드 그대로 복사
   - Service / Mapper 표준 코드 — 실제 소스 기반으로 작성
   - JWT/AD 인증 구조 — 
     - JWT 검증은 `AuthenticationInterceptor`가 `/**`에 전역 등록되어 중앙 처리
     - 각 Controller는 `Account.currentUser().getUserId()` 한 줄만 호출
     - 로컬에서는 `PortalLocalTestProperties.isEnabled()` 분기로 AD 인증 없이 테스트
     - SAML/AD 인증 설정은 `onelogin.saml.properties` (dev/prod 환경별로 분리됨)
     - 제외 경로는 `application.yml`의 `security.authentication.exclude-path` 에서 관리

8. 프론트엔드 패턴
   - 신규 컴포넌트 작성 전 필수 확인 순서
     (컴포넌트 저장 경로: [신규 소스 경로]/frontend/src/components/view/[프로젝트명]/)
   - JSP → Vue.js 변환 가이드 (태그/문법 대응표)
   - Vue 컴포넌트 표준 구조 — 실제 demo 컴포넌트 읽고 패턴 그대로 작성
   - 페이지 제목 원칙
     - 모든 페이지 컴포넌트 루트 div 바로 아래 첫 번째 요소로 `<h5 class="page-title">{{ $t('portal.page.title.xxx') }}</h5>` 추가
     - CSS는 PortalLayout.vue 전역 스타일에 정의 — inline style 금지
     - i18n 키는 `portal.page.title.[camelCase기능명]` 형식으로 ko_KR / en_US 메시지 파일에 모두 등록
     - 텍스트는 GNB 좌측 메뉴에 표시되는 명칭과 일치시킬 것
     - 동일 컴포넌트가 prop에 따라 제목이 달라지는 경우 삼항 연산자 사용
   - 상세 로딩 원칙
     - 목록 항목 선택 → API 호출 → 상세 패널/모달 채우는 모든 컴포넌트에 `detailLoading` 상태 추가
     - 적용 대상: 좌우 분할 패널, 모달 상세, 3-패널 단계별 선택 등 전부 포함
     - 패턴: 선택 시 `selectedItem = {id}` 먼저 세팅(패널 열기) → `detailLoading = true` → API → `finally`에서 `false`
     - 스피너 마크업: `<span class="spinner-border spinner-border-sm me-2 text-primary"></span>`
     - 3-패널처럼 단계별 선택이 있는 경우 각 단계마다 별도 로딩 변수 사용 (예: `channelListLoading`, `userPanelLoading`)
```

---

## STEP 4 — CLAUDE.md 생성 요청

> Claude가 매 대화마다 자동으로 로딩할 진입점 파일을 만듭니다.

```
아래 내용으로 CLAUDE.md를 생성해줘.

생성 경로: [신규 소스 경로]/CLAUDE.md

내용:
# [프로젝트명] 마이그레이션 프로젝트

## 참고 문서
- 프로젝트 환경 (경로, 기술스택, DB 등): @.claude/project-env.md
- 마이그레이션 원칙 (공통원칙, DB변환, 백엔드/프론트엔드 패턴): @.claude/migration-rules.md
```

---

## STEP 5 — 구 DB 현황 파악 및 상태관리 파일 생성

> 구 DB의 전체 테이블 목록과 프로시저 목록을 조회하여 `doc/db_migration_status.md`를 생성합니다.  
> 이 파일은 이후 기능별 데이터 이관 작업 시 테이블 상태를 추적하는 기준 문서가 됩니다.

```
구 DB([구DB명])의 전체 테이블 목록과 프로시저 목록을 조회해줘.

-- 1. 전체 테이블 목록
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- 2. 전체 프로시저 목록
SELECT ROUTINE_NAME
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_NAME;

조회 결과를 바탕으로 doc/db_migration_status.md를 생성해줘.

파일 형식:
- 상단에 구 DB → 신 DB 기준 명시 (예: MOPORTAL_DEV → SDL_DEV)
- 기준 범례 테이블 포함:
  | 상태 | 설명 |
  | ✅ 그대로 이관 | 테이블명·컬럼명 동일하게 신 DB로 이관 |
  | 🔄 컬럼 맵핑 이관 | 테이블명 또는 컬럼명 변경하여 SDL 표준 테이블로 이관 |
  | 🔗 크로스 DB 참조 | 이관 없이 구 DB를 직접 참조 (Mapper XML에 DB 프리픽스 적용) |
  | ❌ DROP | 미사용/불필요 테이블 |
  | ⏳ 미정 | 검토 필요 |
- "사용된 SQL 파일" 섹션 (초기에는 비워두고, 이후 이관 작업 시 채워넣음)
- "테이블 목록" 섹션: 조회한 전체 테이블을 No/테이블명/상태/비고 컬럼으로 나열
  - _BACKUP, _TMP, _TEMP 접미어 테이블은 ❌ DROP으로 초기 설정
  - _DROP_ 접두어 테이블은 ❌ DROP으로 초기 설정
  - 나머지는 모두 ⏳ 미정으로 초기 설정
- "프로시저 목록" 섹션: 조회한 전체 프로시저를 No/프로시저명/사용기능/비고 컬럼으로 나열
  - 모두 ⏳ 미정으로 초기 설정 (기능 마이그레이션 진행하며 채워넣음)
```

---

## STEP 6 — 구 DB 메뉴/권한 필수 데이터 마이그레이션

> 신규 DB에 구 DB의 메뉴/권한 데이터를 이식합니다.  
> `doc/sql/migration_menu_auth.sql` 파일을 참고해서 진행합니다.

```
구 DB의 메뉴 관련 필수 데이터를 신규 DB로 마이그레이션해줘.
doc/sql/migration_menu_auth.sql 파일을 참고해서 진행해.

마이그레이션 대상 테이블 (실행 순서 준수):
1. TN_CF_SYS_RESOURCE  — 메뉴 리소스 (자기참조 FK 있으므로 제약 조건 일시 해제 후 INSERT)
2. TN_CF_MENU          — 메뉴 정보 (구 KO_LABEL/EN_LABEL → LABEL_JSON {"ko_KR":"...","en_US":"..."} 합성)
3. TN_CF_WORKGROUP     — 업무그룹 (구 TN_CF_WORK_GROUP → 컬럼명 변경 주의)
4. TN_CF_WORKGROUP_ROLE — 업무그룹-역할 연결
5. TN_CF_WORK_AUTHORIZATION — 업무그룹-리소스 권한
6. TN_CF_USER_AUTHORIZATION — 사용자별 메뉴 권한

주의사항:
- [구DB명] 부분을 실제 구 DB명으로 교체해줘
- 이미 신규 DB에 존재하는 데이터는 중복 INSERT 하지 않도록 NOT EXISTS 조건 적용
- 마이그레이션 완료 후 LABEL_JSON 키를 {"ko_KR":"...","en_US":"..."} 형식으로 정규화
- 완료 후 검증 쿼리로 각 테이블 건수 확인
```

---

## STEP 7 — GNB 메뉴 구조 파악 요청

> STEP 6에서 구 DB 메뉴를 신 DB로 이관한 상태이므로, 신 DB를 기준으로 메뉴 구조를 파악합니다.  
> EXTERNAL_URL은 구 `.do` URL이 그대로 들어있을 수 있으므로 참고용으로만 확인하고,  
> 실제 경로는 각 기능 마이그레이션 시 신규 Vue 라우팅 경로로 업데이트합니다.

### 방법 A — 신 DB 직접 조회 (권장)

> STEP 6 이관 완료 후 신 DB에서 조회합니다. 구 DB 접근 없이 진행 가능합니다.

```
신 DB([신DB명])에서 전체 GNB 메뉴 구조를 파악해줘.

SELECT M.MENU_ID, M.LABEL, M.MENU_LEVEL, M.MENU_SEQUENCE,
       SR.UPPER_SYS_RESOURCE_ID AS 부모ID, M.EXTERNAL_URL
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.DELETE_YN = '0'
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

위 쿼리 결과로 GNB 트리를 작성해줘.
EXTERNAL_URL은 아직 구 .do URL이 남아있을 수 있으니 트리 작성 시 URL은 생략해도 돼.
트리 작성 후, 실제 화면과 다른 부분이 있으면 줄글로 알려줘. (예: "앱운영 > 모바일PTT가 빠져있어.")
그러면 그 내용을 반영해서 트리를 다시 작성할게.

결과 형식:

GNB
├── 대메뉴1
│   ├── <중분류>        (← 클릭 불가 그룹 헤더)
│   │   ├── [소분류]    (← 클릭 불가 서브그룹 헤더)
│   │   │   └── 기능명  (← 실제 페이지 leaf)
│   │   └── 기능명2
│   └── 기능명3
└── 대메뉴2
    └── ...

범례: < > 클릭불가 중분류, [ ] 클릭불가 소분류, 나머지 선택 가능 leaf
```

### 방법 B — 구 소스 코드에서 역추출

> STEP 6 이관 전이거나 신 DB 메뉴 데이터가 불완전한 경우. Controller URL 패턴으로 메뉴 구조를 추론합니다.

```
구 소스([구 소스 경로])에서 사용자에게 노출되는 모든 URL 경로를 추출해줘.

방법:
1. @RequestMapping, @GetMapping 등 URL 매핑 어노테이션 검색
2. 각 URL의 기능명 추론 (메서드명, 리턴 뷰명 기준)
3. URL 패턴으로 GNB 계층 구조 추론
   예) /portal/notice/* → 공지사항
       /portal/admin/user/* → 관리 > 사용자 관리

결과를 GNB 트리 형태로 출력해줘.
```

---

## STEP 8 — 통합 체크리스트 생성 요청

> STEP 7에서 파악한 메뉴 구조를 바탕으로 통합 체크리스트를 만듭니다.

```
STEP 7에서 파악한 GNB 메뉴 구조를 바탕으로 통합 체크리스트를 생성해줘.

생성 경로: [신규 소스 경로]/.claude/checklist/[프로젝트명]_통합_체크리스트.md

※ 파일 넘버링 규칙 (상세 가이드 파일명 기준): [GNB_순번]_[서브_순번]_[기능명].md
   - 동일 GNB 그룹 내 기능은 서브 순번으로 묶음 (예: 5_1, 5_2, 5_3)
   - 메뉴 외 공통/인증 기능은 0번대 사용 (예: 0_1_메인화면.md)

포함할 내용:
1. 개요 섹션 (기술 스택 비교표)
2. 기능별 마이그레이션 진행 방법 (1~6단계 절차 설명)
3. GNB 메뉴 구조 트리 (STEP 7 결과 그대로)
4. 마이그레이션 항목 패턴 (표준 11단계)
5. GNB 섹션별 기능 목록

각 기능 항목 형식:
### N단계: [기능명](./N_M_기능명.md)
> 경로: `<상위메뉴>` > `[중간메뉴]` > 기능명 | URL: `/portal/xxx` (예상) | 우선순위: 필수/선택

<!-- ⚠️ 프로젝트별 검증 필요: 아래 체크리스트 항목은 SDP 2.5 → SDL 마이그레이션 기준으로 작성됨.
     다른 구 프레임워크(예: SDP 외 타 플랫폼 등)에서 마이그레이션하는 경우
     항목명과 순서를 해당 프레임워크의 레이어 구조에 맞게 변경해야 함.
     예) iBatis → MyBatis가 아닌 경우 "MyBatis Mapper XML 변환" 항목 조정 필요
         JSP 외 다른 뷰 기술 사용 시 "JSP → Vue Component 변환" 항목 조정 필요 -->
- [ ] 구 소스 분석
- [ ] 신규 DEMO 분석
- [ ] Controller 변환
- [ ] Service 변환
- [ ] DAO → Mapper 변환
- [ ] Domain → DTO 변환
- [ ] MyBatis Mapper XML 변환
- [ ] JSP → Vue Component 변환
  - [ ] 라우팅 누락 확인
  - [ ] 페이지 제목 추가 (`<h5 class="page-title">{{ $t('portal.page.title.xxx') }}</h5>` + ko_KR/en_US 메시지 키 등록)
- [ ] 메뉴 URL 업데이트
  - [ ] 해당 메뉴 EXTERNAL_URL을 신규 Vue 라우팅 경로로 UPDATE (구 `.do` URL 제거)
  - [ ] 권한 필요 시 등록
- [ ] 데이터 이관 (FK 체인 파악 → 부모 테이블부터 순서대로 이관 + doc/db_migration_status.md 업데이트)
- [ ] 테스트 수행

체크박스 업데이트 규칙:
- `[ ]` → `[x]` 변경: 해당 항목 완료 시
- 테스트 항목은 실제 dev 서버에서 동작 확인 후 체크
- 구현 완료 후 테스트 전 상태이면 통합 체크리스트는 체크하지 않음

우선순위 기준:
- 필수: 로그인 후 첫 화면에 보이거나 다른 기능이 의존하는 공통 기능
- 선택: 독립적으로 동작하는 개별 업무 기능
```

---

## STEP 8-1 — 기능 누락 검증 요청

> 구 소스 기준 기능 목록과 통합 체크리스트를 대조하여 누락 항목을 보완합니다.

```
구 소스([구 소스 경로])를 분석해서 기능 명세를 작성하고,
STEP 8에서 생성한 통합 체크리스트와 대조해줘.

순서:
1. 구 소스의 Controller @RequestMapping 경로 전체를 추출해서 기능 목록 작성
2. 아래 경로에 기능 명세서로 저장해줘:
   [신규 소스 경로]/.claude/checklist/기능명세서.md
3. 통합 체크리스트의 기능 목록과 비교
4. 체크리스트에 없는 기능이 있으면 아래 정보와 함께 알려줘:
   - 기능명 (추론)
   - 구 소스 Controller 경로
   - GNB 위치 (추론)
   - 누락 이유 추정 (메뉴에 없는 기능인지, 단순 누락인지)
5. 누락 항목은 명확하든 애매하든 모두 목록으로 먼저 알려주고 추가 여부를 확인해줘.
   확인 후 추가하기로 한 항목만 통합 체크리스트에 추가해줘.
```

---

## STEP 9 — 기능별 상세 가이드 일괄 생성 요청

> 통합 체크리스트에 링크된 상세 가이드 파일들을 일괄 생성합니다.

```
통합 체크리스트에 등록된 모든 기능의 상세 가이드 파일을 생성해줘.

생성 경로: [신규 소스 경로]/.claude/checklist/

각 파일은 아래 템플릿으로 생성:

---
# [GNB번호]_[서브번호] [기능명]

> **공통 소스·도메인**: 동일 패키지를 여러 기능이 공유하는 경우 여기에 명시.
> 예) `5_1 ~ 5_3`이 `com.example.mobileptt` 패키지를 분담.

## 기능 개요
- **기능명**: [기능명]
- **GNB 위치**: [대메뉴] > [중메뉴] > [기능명]
- **URL**: `/portal/xxx/yyy` (예상)
- **우선순위**: 필수 / 선택

## 구 소스 정보
- **Controller**: (구 소스 분석 후 채워넣기)
- **Service**: (구 소스 분석 후 채워넣기)
- **DAO**: (구 소스 분석 후 채워넣기)
- **Domain**: (구 소스 분석 후 채워넣기)
- **JSP**: (구 소스 분석 후 채워넣기)
- **iBatis XML**: (구 소스 분석 후 채워넣기)

> ⚠️ 특이사항이 있으면 여기에 명시.
> 예) "외부 DB(`PTT_SERVER_A.dbo`) 참조 — 로컬에서 테스트 불가, dev 서버에서만 확인 가능"

## 신규 구현 정보 (마이그레이션 후 채워넣기)
- **Controller**: `XxxController.java` — `/api/portal/xxx`
- **Service**: `XxxService` / `XxxServiceImpl`
- **Mapper**: `XxxMapper.java`
- **DTO**: `XxxDto.java`
- **Mapper XML**: `mapper-mybatis-xxx.xml`
- **Vue Component**: `XxxList.vue`, `XxxForm.vue`
- **Route**: `portal/xxx/yyy`
- **메뉴 SQL**: `doc/sql/xxx_menu_setup.sql`

## 마이그레이션 체크리스트
- [ ] 구 소스 분석
- [ ] 신규 DEMO 분석
- [ ] Controller 변환
- [ ] Service 변환
- [ ] DAO → Mapper 변환
- [ ] Domain → DTO 변환
- [ ] MyBatis Mapper XML 변환
- [ ] JSP → Vue Component 변환
  - [ ] 라우팅 누락 확인
  - [ ] 페이지 제목 추가 (`<h5 class="page-title">{{ $t('portal.page.title.xxx') }}</h5>` + ko_KR/en_US 메시지 키 등록)
- [ ] 메뉴 URL 업데이트
  - [ ] 해당 메뉴 EXTERNAL_URL을 신규 Vue 라우팅 경로로 UPDATE (구 `.do` URL 제거)
  - [ ] 권한 필요 시 등록
- [ ] 데이터 이관 (FK 체인 파악 → 부모 테이블부터 순서대로 이관 + doc/db_migration_status.md 업데이트)
- [ ] 테스트 수행

---
**작성일**: [오늘 날짜]
**작성자**: [작성자명]
**버전**: 1.0
---

파일이 많으면 GNB 섹션 단위로 나눠서 생성해도 돼.
```

---

## STEP 10 — /migrate 커맨드(스킬) 등록 요청

> Claude Code에서 `/migrate` 명령으로 마이그레이션을 시작할 수 있게 합니다.
>
> **등록 방식 선택**: 프로젝트 설정에 따라 아래 두 방식 중 하나를 선택합니다.
> - **커맨드 파일 방식** (기본): `.claude/commands/migrate.md` 생성 → `/migrate` 로 호출
> - **스킬 등록 방식**: `.claude/commands/` 대신 시스템 프롬프트 파일로 등록하는 경우, 경로와 파일명을 프로젝트 규칙에 맞게 변경

```
아래 내용으로 migrate 커맨드 파일을 생성해줘.

생성 경로: [신규 소스 경로]/.claude/commands/migrate.md

내용:

# 기능별 마이그레이션

`[프로젝트명]_통합_체크리스트.md`를 이용하여 기능별 마이그레이션을 수행합니다.

## 대상 기능

$ARGUMENTS

인자가 없으면 아래 목록에서 선택을 요청합니다:
[통합 체크리스트의 전체 기능 목록 — 번호와 기능명]

## 수행 순서

1. **CLAUDE.md 확인** — 마이그레이션 원칙 및 프로젝트 환경 숙지
2. **메인 체크리스트 확인** — `.claude/checklist/[프로젝트명]_통합_체크리스트.md`에서 대상 기능의 현재 상태 확인
3. **상세 가이드 읽기** — `.claude/checklist/[번호_기능명].md` 파일에서 구 소스 정보, 변환 방법 확인
4. **마이그레이션 수행** — 체크되지 않은 첫 번째 항목부터 순차적으로 완료
5. **메뉴 DB 등록** — 구 DB base64 MENU_ID 조회 → 신규 DB 이식 → 권한 등록
6. **데이터 이관** — FK 체인 파악(부모/자식 확인 쿼리 실행) → 부모 테이블부터 묶음으로 이관 → `WHERE NOT EXISTS`로 중복 방지 → `doc/db_migration_status.md` 업데이트 (SQL 파일 삭제·이름 변경 시 status.md 항목도 즉시 수정)
7. **체크리스트 업데이트** — 완료된 항목 체크, 모든 항목 완료 시 메인 체크리스트도 체크

## 자동 진행 원칙

- 사용자에게 "어떤 단계를 진행할까요?" 묻지 않고 순차적으로 자동 진행
- 각 단계 완료 후 다음 단계로 자동 이동
- 상세 가이드의 모든 항목이 완료되어야 메인 체크리스트를 체크할 수 있음
- 통합 체크리스트는 테스트 완료 후에만 체크
```

---

## STEP 11 — 최종 검증 요청

> 생성된 파일들이 올바르게 연결되어 있는지 확인합니다.

```
방금 생성한 마이그레이션 환경 파일들을 검증해줘.

확인 항목:
1. CLAUDE.md → .claude/project-env.md, .claude/migration-rules.md 참조 경로 정상 여부
2. 통합 체크리스트 → 상세 가이드 파일 링크가 실제 파일과 일치하는지
3. migration-rules.md의 백엔드 패턴에서 userId 획득 코드가 demo 실제 코드와 동일한지
4. migration-rules.md의 메뉴 등록 절차에서 테이블명이 신규 DB 실제 테이블명과 일치하는지
5. /migrate 커맨드의 기능 목록이 통합 체크리스트와 일치하는지

불일치 항목이 있으면 바로 수정해줘.
```

---

## 실행 순서 요약

```
STEP 1   구 소스 + 신규 플랫폼 분석
   ↓
STEP 2   project-env.md 생성
   ↓
STEP 3   migration-rules.md 생성
   ↓
STEP 4   CLAUDE.md 생성
   ↓
STEP 5   구 DB 테이블/프로시저 목록 조회 → db_migration_status.md 생성
   ↓
STEP 6   구 DB 메뉴/권한 필수 데이터 마이그레이션 (migration_menu_auth.sql 참고)
   ↓
STEP 7   GNB 메뉴 구조 파악
   ↓
STEP 8   통합 체크리스트 생성
   ↓
STEP 8-1 기능 누락 검증 (구 소스 Controller 전체 추출 → 체크리스트 대조 → 누락 항목 보완)
   ↓
STEP 9   상세 가이드 파일 일괄 생성
   ↓
STEP 10  /migrate 커맨드 등록
   ↓
STEP 11  최종 검증
```

> STEP 1~4는 한 번에 이어서 실행 가능합니다.  
> STEP 5~6은 구 DB 접근 가능한 환경에서 실행합니다.  
> STEP 5는 STEP 6 이전에 반드시 수행 — 이후 기능별 이관 작업 시 db_migration_status.md가 기준 문서가 됩니다.  
> STEP 7~9는 구 소스 규모에 따라 시간이 걸릴 수 있으니 섹션별로 나눠서 실행하는 것을 권장합니다.  
> STEP 8-1은 STEP 8 직후 반드시 실행 — 체크리스트 누락 기능을 조기에 발견할수록 재작업이 줄어듭니다.

---

## 운영 팁

### 신규 기능 추가 시

마이그레이션 진행 중 누락된 기능이 발견되거나 신규 기능을 추가할 때:

1. 통합 체크리스트에 단계 추가 (링크 포함)
2. 상세 가이드 파일 생성 (STEP 9 템플릿 복사 후 수정)
3. 필요 시 메뉴 SQL 파일 생성 (`doc/sql/xxx_menu_setup.sql`)

### 공통 소스를 여러 기능이 공유할 때

동일 패키지를 여러 기능이 분담하는 경우, 각 상세 가이드 파일 상단에 명시합니다:

```markdown
> **공통 소스·도메인**: 구 `com.example.mobileptt` 패키지 —
> `5_1 ~ 5_3`이 동일 패키지를 분담.
```

공통 분석 내용은 `_archived/` 폴더의 별도 문서로 관리하고, 각 기능 가이드에서 참조합니다.

### 외부 DB / 특수 환경 의존 기능

로컬에서 테스트 불가한 기능은 상세 가이드의 구 소스 정보 섹션에 명확히 명시합니다:

```markdown
> ⚠️ 외부 DB(`PTT_SERVER_A.dbo`) 참조 — 로컬 테스트 불가, dev 서버에서만 확인 가능
```

---

## 추가 팁

### rules 파일을 진행 중에 보완할 때

`migration-rules.md`는 처음에 완성하는 것이 아니라 **마이그레이션을 진행하면서 계속 보완**합니다.  
아래 상황이 생기면 즉시 추가하세요 — 나중에 같은 실수를 반복하지 않기 위해서입니다.

| 상황 | 추가할 위치 |
|---|---|
| 반복 실수 발생 | 해당 섹션 주의사항에 추가 |
| 프레임워크 특수 동작 발견 | 해당 섹션 주의사항에 추가 |
| 신규 테이블/모듈 매핑 확인 | DB 변환 규칙 / 공통 모듈 매핑 테이블에 행 추가 |
| 인증/보안 처리 방식 확정 | 백엔드 패턴 섹션에 실제 코드 추가 |
| 메뉴 등록 오류 경험 | 메뉴 등록 원칙 주의사항에 추가 |

프롬프트:

```
migration-rules.md에 아래 규칙을 추가해줘.

섹션: [추가할 섹션명]
내용: [규칙 내용 — WHY와 함께]
```

### 규칙 작성 원칙

규칙을 추가할 때는 아래 원칙을 지켜야 나중에 의미가 살아있습니다.

- **WHY를 함께 명시** — "하지 말 것"만 쓰면 이유를 잊어서 나중에 무시하게 됨
  - 나쁜 예: `JSON_VALUE 사용 금지`
  - 좋은 예: `JSON_VALUE 사용 금지 — LABEL_JSON 형식이 DB마다 달라 파싱 오류 발생`
- **실제 코드 예시 포함** — 추상적인 설명보다 코드 한 줄이 더 명확하고 Claude도 정확하게 적용함
- **예외 케이스도 명시** — "항상"이 아닌 경우 조건을 명확히 적어야 엣지 케이스에서 잘못 적용하지 않음

**작성일**: 2026-05-29  
**버전**: 1.0
