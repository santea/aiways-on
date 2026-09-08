-- ============================================================
-- S.DOC 문서 그룹 관리 테이블 생성 + 데이터 이관
-- 구 DB: MOPORTAL_DEV → 신 DB: SDL_DEV (현재 DB)
-- 대상 테이블 (FK 순서):
--   1. TN_SD_GROUP_LIST     (부모)
--   2. TN_SD_GROUP_USER     (자식 — DOC_GROUP_ID → TN_SD_GROUP_LIST)
--   3. TN_SD_GROUP_CATEGORY (자식 — DOC_GROUP_ID → TN_SD_GROUP_LIST)
-- ※ _DROP_FIRST_REG_USER_NAME 컬럼은 드롭 대상이므로 이관 제외
-- ============================================================

BEGIN TRANSACTION;

-- ============================================================
-- STEP 1: 테이블 DDL 생성 (없을 경우)
-- ============================================================

-- 1-1. TN_SD_GROUP_LIST (부모)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TN_SD_GROUP_LIST')
BEGIN
    CREATE TABLE TN_SD_GROUP_LIST (
        DOC_GROUP_ID        nvarchar(35)  NOT NULL,
        DOC_GROUP_KO_NAME   nvarchar(300) NULL,
        DOC_GROUP_EN_NAME   nvarchar(300) NULL,
        DOC_GROUP_TYPE      nvarchar(1)   NULL,
        FIRST_REG_DATETIME  datetime      NULL,
        FIRST_REG_ID        nvarchar(35)  NULL,
        LAST_MOD_DATETIME   datetime      NULL,
        LAST_MOD_ID         nvarchar(50)  NULL,
        CONSTRAINT PK_TN_SD_GROUP_LIST PRIMARY KEY (DOC_GROUP_ID)
    );
    PRINT 'TN_SD_GROUP_LIST 테이블 생성 완료';
END
ELSE
    PRINT 'TN_SD_GROUP_LIST 테이블 이미 존재';

-- 1-2. TN_SD_GROUP_USER (자식)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TN_SD_GROUP_USER')
BEGIN
    CREATE TABLE TN_SD_GROUP_USER (
        DOC_GROUP_ID       nvarchar(50)  NOT NULL,
        DOC_USER_ID        nvarchar(50)  NOT NULL,
        FIRST_REG_DATETIME datetime      NULL,
        FIRST_REG_ID       nvarchar(20)  NULL,
        LAST_MOD_DATETIME  datetime      NULL,
        LAST_MOD_ID        nvarchar(20)  NULL,
        CONSTRAINT PK_TN_SD_GROUP_USER PRIMARY KEY (DOC_GROUP_ID, DOC_USER_ID)
    );
    PRINT 'TN_SD_GROUP_USER 테이블 생성 완료';
END
ELSE
    PRINT 'TN_SD_GROUP_USER 테이블 이미 존재';

-- 1-3. TN_SD_GROUP_CATEGORY (자식)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TN_SD_GROUP_CATEGORY')
BEGIN
    CREATE TABLE TN_SD_GROUP_CATEGORY (
        DOC_GROUP_ID        nvarchar(35)  NOT NULL,
        CATEGORY_ID         nvarchar(35)  NOT NULL,
        UPPER_CATEGORY_ID   nvarchar(35)  NULL,
        CATEGORY_KO_NAME    nvarchar(300) NULL,
        CATEGORY_EN_NAME    nvarchar(300) NULL,
        SORT_NUM            int           NULL,
        DEPTH               int           NULL,
        USE_YN              nvarchar(1)   NULL,
        FIRST_REG_DATETIME  datetime      NULL,
        FIRST_REG_ID        nvarchar(20)  NULL,
        LAST_MOD_DATETIME   datetime      NULL,
        LAST_MOD_ID         nvarchar(20)  NULL,
        CONSTRAINT PK_TN_SD_GROUP_CATEGORY PRIMARY KEY (DOC_GROUP_ID, CATEGORY_ID)
    );
    PRINT 'TN_SD_GROUP_CATEGORY 테이블 생성 완료';
END
ELSE
    PRINT 'TN_SD_GROUP_CATEGORY 테이블 이미 존재';

-- ============================================================
-- STEP 2: 데이터 이관 (FK 순서 준수)
-- ============================================================

-- 2-1. TN_SD_GROUP_LIST (부모 먼저)
INSERT INTO TN_SD_GROUP_LIST (
    DOC_GROUP_ID, DOC_GROUP_KO_NAME, DOC_GROUP_EN_NAME,
    DOC_GROUP_TYPE, FIRST_REG_DATETIME, FIRST_REG_ID,
    LAST_MOD_DATETIME, LAST_MOD_ID
)
SELECT
    DOC_GROUP_ID, DOC_GROUP_KO_NAME, DOC_GROUP_EN_NAME,
    DOC_GROUP_TYPE, FIRST_REG_DATETIME, FIRST_REG_ID,
    LAST_MOD_DATETIME, LAST_MOD_ID
FROM MOPORTAL_DEV.dbo.TN_SD_GROUP_LIST src
WHERE NOT EXISTS (
    SELECT 1 FROM TN_SD_GROUP_LIST tgt
    WHERE tgt.DOC_GROUP_ID = src.DOC_GROUP_ID
);
PRINT 'TN_SD_GROUP_LIST 이관: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- 2-2. TN_SD_GROUP_USER (자식)
INSERT INTO TN_SD_GROUP_USER (
    DOC_GROUP_ID, DOC_USER_ID,
    FIRST_REG_DATETIME, FIRST_REG_ID,
    LAST_MOD_DATETIME, LAST_MOD_ID
)
SELECT
    DOC_GROUP_ID, DOC_USER_ID,
    FIRST_REG_DATETIME, FIRST_REG_ID,
    LAST_MOD_DATETIME, LAST_MOD_ID
FROM MOPORTAL_DEV.dbo.TN_SD_GROUP_USER src
WHERE NOT EXISTS (
    SELECT 1 FROM TN_SD_GROUP_USER tgt
    WHERE tgt.DOC_GROUP_ID = src.DOC_GROUP_ID
      AND tgt.DOC_USER_ID  = src.DOC_USER_ID
);
PRINT 'TN_SD_GROUP_USER 이관: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- 2-3. TN_SD_GROUP_CATEGORY (자식)
INSERT INTO TN_SD_GROUP_CATEGORY (
    DOC_GROUP_ID, CATEGORY_ID, UPPER_CATEGORY_ID,
    CATEGORY_KO_NAME, CATEGORY_EN_NAME,
    SORT_NUM, DEPTH, USE_YN,
    FIRST_REG_DATETIME, FIRST_REG_ID,
    LAST_MOD_DATETIME, LAST_MOD_ID
)
SELECT
    DOC_GROUP_ID, CATEGORY_ID, UPPER_CATEGORY_ID,
    CATEGORY_KO_NAME, CATEGORY_EN_NAME,
    SORT_NUM, DEPTH, USE_YN,
    FIRST_REG_DATETIME, FIRST_REG_ID,
    LAST_MOD_DATETIME, LAST_MOD_ID
FROM MOPORTAL_DEV.dbo.TN_SD_GROUP_CATEGORY src
WHERE NOT EXISTS (
    SELECT 1 FROM TN_SD_GROUP_CATEGORY tgt
    WHERE tgt.DOC_GROUP_ID  = src.DOC_GROUP_ID
      AND tgt.CATEGORY_ID   = src.CATEGORY_ID
);
PRINT 'TN_SD_GROUP_CATEGORY 이관: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

COMMIT;

-- ============================================================
-- STEP 3: 확인
-- ============================================================
SELECT 'TN_SD_GROUP_LIST'     AS 테이블, COUNT(*) AS 건수 FROM TN_SD_GROUP_LIST
UNION ALL
SELECT 'TN_SD_GROUP_USER'     AS 테이블, COUNT(*) AS 건수 FROM TN_SD_GROUP_USER
UNION ALL
SELECT 'TN_SD_GROUP_CATEGORY' AS 테이블, COUNT(*) AS 건수 FROM TN_SD_GROUP_CATEGORY;
