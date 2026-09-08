-- ============================================================
-- 설비보안점검 (ESC) 테이블 DDL — 신 DB 생성
-- 마이그레이션 단계: 26단계 (5_5_설비맵_이미지_등록.md)
--                   27단계 (5_6_설비_점검_대상_등록.md)
-- 구 DB (MOPORTAL_DEV) 컬럼 구조 그대로 이관
-- _DROP_ 접두사 컬럼 제외
-- ============================================================

-- ============================================================
-- 1. ESC_DATA_GBM_LINE (GBM/LINE 마스터 — 외부 데이터)
-- ============================================================
IF OBJECT_ID('ESC_DATA_GBM_LINE', 'U') IS NULL
BEGIN
    CREATE TABLE ESC_DATA_GBM_LINE (
        GBM_CODE        NVARCHAR(12)  NOT NULL,
        LINE_CODE       NVARCHAR(5)   NOT NULL,
        LINE_NM         NVARCHAR(100) NOT NULL,
        LINE_ABBR_NM    NVARCHAR(20)  NOT NULL,
        CONSTRAINT PK_ESC_DATA_GBM_LINE PRIMARY KEY (GBM_CODE, LINE_CODE)
    );
    PRINT 'ESC_DATA_GBM_LINE 생성 완료';
END
ELSE
    PRINT 'ESC_DATA_GBM_LINE 이미 존재 — SKIP';

-- ============================================================
-- 2. ESC_DATA_EQUIPMENT (설비 마스터 — 외부 데이터)
-- ============================================================
IF OBJECT_ID('ESC_DATA_EQUIPMENT', 'U') IS NULL
BEGIN
    CREATE TABLE ESC_DATA_EQUIPMENT (
        EQP_IDG_CODE                    NVARCHAR(12)  NOT NULL,
        EQP_NM                          NVARCHAR(300) NULL,
        EQP_ID                          NVARCHAR(30)  NULL,
        EQP_REG_KND_CODE_DESC_KO        NVARCHAR(180) NULL,
        AREA_CLS_CODE                   NVARCHAR(20)  NULL,
        EQP_L1_CLASS_CODE               NVARCHAR(18)  NULL,
        EQP_L1_CLASS_CODE_DESC_KO       NVARCHAR(300) NULL,
        EQP_L2_CLASS_CODE               NVARCHAR(18)  NULL,
        EQP_L2_CLASS_CODE_DESC_KO       NVARCHAR(300) NULL,
        LARGE_PROCESS_CLASS_CODE        NVARCHAR(18)  NULL,
        LARGE_PROCESS_CLASS_CODE_NM_KO  NVARCHAR(300) NULL,
        MIDD_PROCESS_CLASS_CODE         NVARCHAR(18)  NULL,
        MIDD_PROCESS_CLASS_CODE_NM_KO   NVARCHAR(300) NULL,
        SMALL_PROCESS_CLASS_CODE        NVARCHAR(18)  NULL,
        SMALL_PROCESS_CLASS_CODE_NM_KO  NVARCHAR(300) NULL,
        MAIN_EQP_KND_CODE               NVARCHAR(10)  NULL,
        MAIN_EQP_KND_CODE_DESC_KO       NVARCHAR(180) NULL,
        EQP_STATUS_CODE                 NVARCHAR(4)   NULL,
        EQP_STATUS_CODE_DESC_KO         NVARCHAR(180) NULL,
        EQP_SETUP_START_DATE            NVARCHAR(8)   NULL,
        WAFER_SIZE_CODE                 NVARCHAR(2)   NULL,
        WAFER_SIZE_CODE_DESC_KO         NVARCHAR(60)  NULL,
        MAKER_NM                        NVARCHAR(40)  NULL,
        MAKER_COMPANY_NM                NVARCHAR(180) NULL,
        MODEL_NM                        NVARCHAR(40)  NULL,
        MAKER_SRL_NO                    NVARCHAR(30)  NULL,
        AMS_MASTER_CODE                 NVARCHAR(12)  NULL,
        ASET_NO                         NVARCHAR(20)  NULL,
        ASET_STATUS_CODE                NVARCHAR(3)   NULL,
        ASET_STATUS_CODE_DESC_KO        NVARCHAR(180) NULL,
        GBM_CODE                        NVARCHAR(12)  NULL,
        EQP_SDWT_INTRNL_ID              NVARCHAR(16)  NULL,
        SDWT_ID                         NVARCHAR(20)  NULL,
        SDWT_NM                         NVARCHAR(450) NULL,
        OWN_ORG_REF_ID                  NVARCHAR(40)  NULL,
        OWN_ORG_NM                      NVARCHAR(100) NULL,
        LFCL_MANAGE_ORG_REF_ID          NVARCHAR(40)  NULL,
        LFCL_MANAGE_ORG_CODE            NVARCHAR(100) NULL,
        LFCL_MANAGE_ORG_NM              NVARCHAR(300) NULL,
        LFCL_MGR_EMPNO                  NVARCHAR(20)  NULL,
        IDX_LINE_DISTN_CODE             NVARCHAR(1)   NULL,
        IDX_LINE_DISTN_CODE_DESC_KO     NVARCHAR(60)  NULL,
        EQP_LOC_INFO                    NVARCHAR(40)  NULL,
        SITE_CODE                       NVARCHAR(2)   NULL,
        DSTRT_CODE                      NVARCHAR(2)   NULL,
        FLOOR_CODE                      NVARCHAR(5)   NULL,
        BAY_CODE                        NVARCHAR(10)  NULL,
        SETUP_RESPEN_EMPNO              NVARCHAR(20)  NULL,
        CSYS_LINE_DISTN_CODE            NVARCHAR(1)   NULL,
        CSYS_LINE_DISTN_CODE_DESC_KO    NVARCHAR(180) NULL,
        CSYS_LINE_DISTN_CODE_DESC_EN    NVARCHAR(60)  NULL,
        CSYS_LINE_DISTN_CODE_DESC_CN    NVARCHAR(180) NULL,
        CSYS_LINE_CODE                  NVARCHAR(5)   NULL,
        OWN_LINE_DISTN_CODE             NVARCHAR(1)   NULL,
        OWN_LINE_DISTN_CODE_DESC_KO     NVARCHAR(180) NULL,
        OWN_LINE_DISTN_CODE_DESC_EN     NVARCHAR(60)  NULL,
        OWN_LINE_DISTN_CODE_DESC_CN     NVARCHAR(180) NULL,
        OWN_LINE_CODE                   NVARCHAR(5)   NULL,
        IF_DATE                         DATETIME      NOT NULL,
        IF_EMP                          VARCHAR(3)    NOT NULL,
        CONSTRAINT PK_ESC_DATA_EQUIPMENT PRIMARY KEY (EQP_IDG_CODE)
    );
    -- 주요 조회 조건 컬럼 인덱스
    CREATE INDEX IX_ESC_DATA_EQUIPMENT_GBM ON ESC_DATA_EQUIPMENT (GBM_CODE, OWN_LINE_CODE);
    CREATE INDEX IX_ESC_DATA_EQUIPMENT_STATUS ON ESC_DATA_EQUIPMENT (EQP_STATUS_CODE);
    PRINT 'ESC_DATA_EQUIPMENT 생성 완료';
END
ELSE
    PRINT 'ESC_DATA_EQUIPMENT 이미 존재 — SKIP';

-- ============================================================
-- 3. ESC_EQP_MAP (설비맵 메타정보 — 구형 테이블, 2016.09)
-- ============================================================
IF OBJECT_ID('ESC_EQP_MAP', 'U') IS NULL
BEGIN
    CREATE TABLE ESC_EQP_MAP (
        EQP_MAP_ID  VARCHAR(50)    NOT NULL,
        EQP_AREA    NVARCHAR(50)   NOT NULL,
        EQP_LINE    NVARCHAR(50)   NOT NULL,
        EQP_PROCESS NVARCHAR(50)   NOT NULL,
        EQP_MODEL   NVARCHAR(100)  NOT NULL,
        REG_DATE    DATETIME       NULL,
        REG_USER    VARCHAR(50)    NULL,
        DELETE_YN   CHAR(1)        NOT NULL DEFAULT 'N',
        MOD_DATE    DATETIME       NOT NULL,
        MOD_USER    VARCHAR(50)    NULL,
        CONSTRAINT PK_ESC_EQP_MAP PRIMARY KEY (EQP_MAP_ID)
    );
    PRINT 'ESC_EQP_MAP 생성 완료';
END
ELSE
    PRINT 'ESC_EQP_MAP 이미 존재 — SKIP';

-- ============================================================
-- 4. ESC_EQP_MAP_ATTACH (설비맵 첨부파일 — ESC_EQP_MAP 하위)
-- ============================================================
IF OBJECT_ID('ESC_EQP_MAP_ATTACH', 'U') IS NULL
BEGIN
    CREATE TABLE ESC_EQP_MAP_ATTACH (
        FILE_ID       VARCHAR(50)    NOT NULL,
        EQP_MAP_ID    VARCHAR(50)    NULL,
        FILE_PATH     NVARCHAR(500)  NULL,
        FILE_NAME     NVARCHAR(500)  NULL,
        FILE_SIZE     NUMERIC(18,0)  NULL,
        ORIGINAL_NAME NVARCHAR(500)  NULL,
        REG_DATE      DATETIME       NULL,
        REG_USER      VARCHAR(50)    NULL,
        CONSTRAINT PK_ESC_EQP_MAP_ATTACH PRIMARY KEY (FILE_ID),
        CONSTRAINT FK_ESC_EQP_MAP_ATTACH FOREIGN KEY (EQP_MAP_ID) REFERENCES ESC_EQP_MAP(EQP_MAP_ID)
    );
    PRINT 'ESC_EQP_MAP_ATTACH 생성 완료';
END
ELSE
    PRINT 'ESC_EQP_MAP_ATTACH 이미 존재 — SKIP';

-- ============================================================
-- 5. ESC_EQP_MAP_FILE (설비별 이미지 파일 — EQP_IDG_CODE 기준)
-- ============================================================
IF OBJECT_ID('ESC_EQP_MAP_FILE', 'U') IS NULL
BEGIN
    CREATE TABLE ESC_EQP_MAP_FILE (
        FILE_ID       VARCHAR(50)    NOT NULL,
        EQP_IDG_CODE  VARCHAR(50)    NULL,
        FILE_PATH     NVARCHAR(500)  NULL,
        FILE_NAME     NVARCHAR(500)  NULL,
        FILE_SIZE     NUMERIC(18,0)  NULL,
        ORIGINAL_NAME NVARCHAR(500)  NULL,
        REG_DATE      DATETIME       NULL,
        REG_USER      VARCHAR(50)    NULL,
        CONSTRAINT PK_ESC_EQP_MAP_FILE PRIMARY KEY (FILE_ID)
    );
    CREATE INDEX IX_ESC_EQP_MAP_FILE_EQP ON ESC_EQP_MAP_FILE (EQP_IDG_CODE);
    PRINT 'ESC_EQP_MAP_FILE 생성 완료';
END
ELSE
    PRINT 'ESC_EQP_MAP_FILE 이미 존재 — SKIP';

-- ============================================================
-- 6. ESC_EQP_SAVE_LIST (사용자별 GBM/LINE 설정값)
-- ============================================================
IF OBJECT_ID('ESC_EQP_SAVE_LIST', 'U') IS NULL
BEGIN
    CREATE TABLE ESC_EQP_SAVE_LIST (
        REG_USER  VARCHAR(50) NOT NULL,
        GBM_CODE  VARCHAR(50) NOT NULL,
        LINE_CODE VARCHAR(50) NOT NULL,
        CONSTRAINT PK_ESC_EQP_SAVE_LIST PRIMARY KEY (REG_USER, GBM_CODE, LINE_CODE)
    );
    PRINT 'ESC_EQP_SAVE_LIST 생성 완료';
END
ELSE
    PRINT 'ESC_EQP_SAVE_LIST 이미 존재 — SKIP';

-- ============================================================
-- 7. ESC_EQP_SCHEDULE (점검 스케줄 마스터)
-- ============================================================
IF OBJECT_ID('ESC_EQP_SCHEDULE', 'U') IS NULL
BEGIN
    CREATE TABLE ESC_EQP_SCHEDULE (
        SCH_ID     VARCHAR(50)    NOT NULL,
        TITLE      NVARCHAR(100)  NULL,
        START_DATE DATE           NULL,
        END_DATE   DATE           NULL,
        REG_DATE   DATETIME       NULL,
        REG_USER   VARCHAR(50)    NULL,
        USE_YN     CHAR(1)        NULL,
        CONSTRAINT PK_ESC_EQP_SCHEDULE PRIMARY KEY (SCH_ID)
    );
    PRINT 'ESC_EQP_SCHEDULE 생성 완료';
END
ELSE
    PRINT 'ESC_EQP_SCHEDULE 이미 존재 — SKIP';

-- ============================================================
-- 8. ESC_EQP_SCHEDULE_LIST (스케줄별 점검 대상 설비 + 결과)
--    _DROP_ 컬럼(_DROP_REG_USER_NAME, _DROP_UPDATE_USER_NAME) 제외
-- ============================================================
IF OBJECT_ID('ESC_EQP_SCHEDULE_LIST', 'U') IS NULL
BEGIN
    CREATE TABLE ESC_EQP_SCHEDULE_LIST (
        SCH_ID               VARCHAR(50)   NOT NULL,
        GBM_CODE             VARCHAR(20)   NOT NULL,
        LINE_CODE            VARCHAR(20)   NOT NULL,
        EQP_ID               NVARCHAR(30)  NOT NULL,
        STATUS               VARCHAR(10)   NOT NULL,
        REG_USER_ID          VARCHAR(50)   NULL,
        REG_DATE             DATETIME      NULL,
        UPDATE_USER_ID       VARCHAR(50)   NULL,
        UPDATE_DATE          DATETIME      NULL,
        USB_PORT_CNT         INT           NULL,
        USB_BLOCK_CNT        INT           NULL,
        USB_BLOCK_OFF_CNT    INT           NULL,
        USB_BLOCK_OFF_REASON VARCHAR(300)  NULL,
        ETC_DEVICE           VARCHAR(20)   NULL,
        REMOTE_APPLIED       VARCHAR(20)   NULL,
        VACCINE_APPLIED      VARCHAR(20)   NULL,
        VACCINE_NAME         VARCHAR(20)   NULL,
        SCREEN_SAVER_APPLIED VARCHAR(20)   NULL,
        SCREEN_SAVER_NAME    VARCHAR(20)   NULL,
        LOCATION             VARCHAR(100)  NULL,
        REMOTE_NAME          VARCHAR(20)   NULL,
        EQP_IDG_CODE         VARCHAR(50)   NULL,
        CONSTRAINT PK_ESC_EQP_SCHEDULE_LIST PRIMARY KEY (SCH_ID, GBM_CODE, LINE_CODE, EQP_ID),
        CONSTRAINT FK_ESC_EQP_SCHEDULE_LIST FOREIGN KEY (SCH_ID) REFERENCES ESC_EQP_SCHEDULE(SCH_ID)
    );
    CREATE INDEX IX_ESC_EQP_SCHEDULE_LIST_EQP ON ESC_EQP_SCHEDULE_LIST (EQP_IDG_CODE);
    PRINT 'ESC_EQP_SCHEDULE_LIST 생성 완료';
END
ELSE
    PRINT 'ESC_EQP_SCHEDULE_LIST 이미 존재 — SKIP';

-- ============================================================
-- 9. ESC_EQP_SCHEDULE_HISTORY (점검 이력)
-- ============================================================
IF OBJECT_ID('ESC_EQP_SCHEDULE_HISTORY', 'U') IS NULL
BEGIN
    CREATE TABLE ESC_EQP_SCHEDULE_HISTORY (
        SCH_ID       VARCHAR(50)   NOT NULL,
        EQP_IDG_CODE VARCHAR(50)   NULL,
        EQP_ID       NVARCHAR(30)  NOT NULL,
        UPDATE_DATE  DATETIME      NULL,
        CONSTRAINT FK_ESC_EQP_SCHEDULE_HISTORY FOREIGN KEY (SCH_ID) REFERENCES ESC_EQP_SCHEDULE(SCH_ID)
    );
    CREATE CLUSTERED INDEX IX_ESC_EQP_SCHEDULE_HISTORY ON ESC_EQP_SCHEDULE_HISTORY (SCH_ID, EQP_IDG_CODE, UPDATE_DATE);
    PRINT 'ESC_EQP_SCHEDULE_HISTORY 생성 완료';
END
ELSE
    PRINT 'ESC_EQP_SCHEDULE_HISTORY 이미 존재 — SKIP';

-- ============================================================
-- 10. ESC_FAB_ETC_DEVICE_CHECK (기타 장치 점검 — FDD/CD/DVD/SD)
-- ============================================================
IF OBJECT_ID('ESC_FAB_ETC_DEVICE_CHECK', 'U') IS NULL
BEGIN
    CREATE TABLE ESC_FAB_ETC_DEVICE_CHECK (
        SCH_ID                  VARCHAR(100)  NOT NULL,
        EQP_ID                  VARCHAR(50)   NOT NULL,
        ETC_DEVICE_NAME         VARCHAR(20)   NOT NULL,
        BLOCK_APPLIED           INT           NOT NULL,
        BLOCK_OFF_REASON        NVARCHAR(20)  NULL,
        BLOCK_OFF_DETAIL_REASON NVARCHAR(50)  NULL,
        EQP_IDG_CODE            VARCHAR(50)   NULL,
        CONSTRAINT PK_ESC_FAB_ETC_DEVICE_CHECK PRIMARY KEY (SCH_ID, EQP_ID, ETC_DEVICE_NAME)
    );
    PRINT 'ESC_FAB_ETC_DEVICE_CHECK 생성 완료';
END
ELSE
    PRINT 'ESC_FAB_ETC_DEVICE_CHECK 이미 존재 — SKIP';

-- ============================================================
-- 확인 쿼리
-- ============================================================
SELECT TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN (
    'ESC_DATA_GBM_LINE', 'ESC_DATA_EQUIPMENT',
    'ESC_EQP_MAP', 'ESC_EQP_MAP_ATTACH', 'ESC_EQP_MAP_FILE',
    'ESC_EQP_SAVE_LIST', 'ESC_EQP_SCHEDULE',
    'ESC_EQP_SCHEDULE_LIST', 'ESC_EQP_SCHEDULE_HISTORY',
    'ESC_FAB_ETC_DEVICE_CHECK'
)
ORDER BY TABLE_NAME;
