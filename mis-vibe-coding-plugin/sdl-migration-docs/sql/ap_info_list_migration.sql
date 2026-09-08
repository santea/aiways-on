-- =============================================
-- TN_BL_AP_INFO_LIST 이관
-- 구 DB: MOPORTAL_DEV (10,004건)
-- 신 DB: SDL_DEV (신규 생성)
-- =============================================

BEGIN TRANSACTION;

-- =============================================
-- 1. DDL: 테이블 생성 (신 DB에 없으므로 생성)
-- =============================================
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TN_BL_AP_INFO_LIST')
BEGIN
    CREATE TABLE TN_BL_AP_INFO_LIST (
        AP_ID       NVARCHAR(50)  NOT NULL,
        AP_NAME     NVARCHAR(40)      NULL,
        BSSID       NVARCHAR(40)      NULL,
        AP_LOCATION NVARCHAR(100)     NULL,
        GUBUN       NVARCHAR(100)     NULL,
        BUILDING    NVARCHAR(100)     NULL,
        FLOOR       NVARCHAR(100)     NULL,
        DELETE_YN   NVARCHAR(1)       NULL,
        REG_DATE    DATETIME          NULL,
        REG_USR_ID  NVARCHAR(50)      NULL,
        MOD_DATE    DATETIME          NULL,
        MOD_USR_ID  NVARCHAR(50)      NULL,
        AP_BAY      NVARCHAR(50)      NULL,
        CONSTRAINT PK_TN_BL_AP_INFO_LIST PRIMARY KEY (AP_ID)
    );
    PRINT 'TN_BL_AP_INFO_LIST 테이블 생성 완료';
END
ELSE
    PRINT 'TN_BL_AP_INFO_LIST 테이블 이미 존재';

-- =============================================
-- 2. 데이터 이관
-- =============================================
INSERT INTO TN_BL_AP_INFO_LIST
    (AP_ID, AP_NAME, BSSID, AP_LOCATION, GUBUN, BUILDING, FLOOR,
     DELETE_YN, REG_DATE, REG_USR_ID, MOD_DATE, MOD_USR_ID, AP_BAY)
SELECT
    AP_ID, AP_NAME, BSSID, AP_LOCATION, GUBUN, BUILDING, FLOOR,
    DELETE_YN, REG_DATE, REG_USR_ID, MOD_DATE, MOD_USR_ID, AP_BAY
FROM [MOPORTAL_DEV].[dbo].[TN_BL_AP_INFO_LIST]
WHERE NOT EXISTS (
    SELECT 1 FROM TN_BL_AP_INFO_LIST WHERE AP_ID = [MOPORTAL_DEV].[dbo].[TN_BL_AP_INFO_LIST].AP_ID
);
PRINT '이관 완료: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

COMMIT;

-- =============================================
-- 3. 확인
-- =============================================
SELECT COUNT(*) AS 이관건수 FROM TN_BL_AP_INFO_LIST;
