-- ============================================================
-- 보안서약서 테이블 DDL 생성 + 데이터 이관
-- 마이그레이션 단계: 36단계 (6_6_런처관리_보안서약서.md)
-- 구 DB: MOPORTAL_DEV.dbo.TN_CF_SECURITY_PLEDGE
-- 신 DB: SDL_DEV.dbo.TN_CF_SECURITY_PLEDGE
-- ============================================================

-- ============================================================
-- STEP 1: 테이블 DDL 생성 (구 DB 컬럼 구조 그대로)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TN_CF_SECURITY_PLEDGE')
BEGIN
    CREATE TABLE TN_CF_SECURITY_PLEDGE (
        PLEDGE_ID       VARCHAR(50)      NOT NULL,
        PLEDGE_TITLE    NVARCHAR(300)    NOT NULL,
        PLEDGE_CONTENTS NVARCHAR(MAX)    NOT NULL,
        USE_YN          CHAR(1)          NOT NULL DEFAULT 'Y',
        REG_DATE        DATETIME         NULL,
        REG_USER_ID     VARCHAR(20)      NULL,
        MOD_DATE        DATETIME         NULL,
        MOD_USER_ID     VARCHAR(20)      NULL,
        CONSTRAINT PK_TN_CF_SECURITY_PLEDGE PRIMARY KEY (PLEDGE_ID)
    );
    PRINT 'TN_CF_SECURITY_PLEDGE 테이블 생성 완료';
END
ELSE
    PRINT 'TN_CF_SECURITY_PLEDGE 테이블 이미 존재 — SKIP';

-- ============================================================
-- STEP 2: 데이터 이관 (구 DB → 신 DB, 중복 방지)
-- ============================================================
BEGIN TRANSACTION;

INSERT INTO TN_CF_SECURITY_PLEDGE (
    PLEDGE_ID, PLEDGE_TITLE, PLEDGE_CONTENTS, USE_YN,
    REG_DATE, REG_USER_ID, MOD_DATE, MOD_USER_ID
)
SELECT
    PLEDGE_ID, PLEDGE_TITLE, PLEDGE_CONTENTS, USE_YN,
    REG_DATE, REG_USER_ID, MOD_DATE, MOD_USER_ID
FROM [MOPORTAL_DEV].[dbo].[TN_CF_SECURITY_PLEDGE]
WHERE NOT EXISTS (
    SELECT 1 FROM TN_CF_SECURITY_PLEDGE
    WHERE PLEDGE_ID = [MOPORTAL_DEV].[dbo].[TN_CF_SECURITY_PLEDGE].PLEDGE_ID
);

PRINT CONCAT('이관 완료: ', @@ROWCOUNT, '건');

COMMIT;

-- ============================================================
-- 확인 쿼리
-- ============================================================
SELECT COUNT(*) AS 이관건수 FROM TN_CF_SECURITY_PLEDGE;
SELECT TOP 3 PLEDGE_ID, PLEDGE_TITLE, USE_YN, REG_DATE FROM TN_CF_SECURITY_PLEDGE ORDER BY REG_DATE DESC;
