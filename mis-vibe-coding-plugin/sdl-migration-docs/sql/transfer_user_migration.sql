-- =============================================
-- TRANSFER_USER 이관
-- 구 DB: MOPORTAL_DEV → 신 DB: SDL_DEV (현재 DB)
-- 총 1,599건
-- =============================================

-- STEP 1: 테이블 생성 (없을 경우)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TRANSFER_USER')
BEGIN
    CREATE TABLE TRANSFER_USER (
        SSO_ID       varchar(25)   NOT NULL,
        KOR_NAME     nvarchar(100) NULL,
        DEPT_CODE    varchar(20)   NULL,
        DEPT_NAME    nvarchar(100) NULL,
        EP_MAIL      varchar(100)  NULL,
        AUTH_DAY     datetime      NULL,
        OLD_DEPT_CODE varchar(20)  NULL,
        OLD_DEPT_NAME varchar(100) NULL,
        CONSTRAINT PK_TRANSFER_USER PRIMARY KEY (SSO_ID)
    );
    PRINT 'TRANSFER_USER 테이블 생성 완료';
END
ELSE
    PRINT 'TRANSFER_USER 테이블 이미 존재';

-- STEP 2: 데이터 이관
INSERT INTO TRANSFER_USER (
    SSO_ID, KOR_NAME, DEPT_CODE, DEPT_NAME,
    EP_MAIL, AUTH_DAY, OLD_DEPT_CODE, OLD_DEPT_NAME
)
SELECT
    SSO_ID, KOR_NAME, DEPT_CODE, DEPT_NAME,
    EP_MAIL, AUTH_DAY, OLD_DEPT_CODE, OLD_DEPT_NAME
FROM [MOPORTAL_DEV].[dbo].TRANSFER_USER src
WHERE NOT EXISTS (
    SELECT 1 FROM TRANSFER_USER tgt
    WHERE tgt.SSO_ID = src.SSO_ID
);
PRINT 'TRANSFER_USER 이관: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- STEP 3: 확인
SELECT COUNT(*) AS 이관건수 FROM TRANSFER_USER;
