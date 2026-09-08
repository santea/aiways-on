-- ============================================================
-- 배너관리 테이블 DDL
-- 구 소스 TB_POT_BANNER + TB_POT_FILE_MAST 실제 스키마 기준
-- ============================================================

-- ------------------------------------------------------------
-- TB_POT_FILE_MAST: 파일 정보 (부모 테이블 먼저 생성)
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TB_POT_FILE_MAST')
BEGIN
    CREATE TABLE TB_POT_FILE_MAST (
        FILE_ID             NVARCHAR(255)   NOT NULL,
        FILE_PATH           NVARCHAR(500)   NULL,
        FILE_NAME           NVARCHAR(100)   NULL,
        ORIGINAL_FILE_NAME  NVARCHAR(100)   NULL,
        REG_USER_ID         VARCHAR(50)     NULL,
        REG_DATE            DATETIME        NULL,
        CONSTRAINT PK_TB_POT_FILE_MAST PRIMARY KEY (FILE_ID)
    );
    PRINT 'TB_POT_FILE_MAST 테이블 생성 완료';
END
ELSE
BEGIN
    PRINT 'TB_POT_FILE_MAST 테이블이 이미 존재합니다';
END
GO

-- ------------------------------------------------------------
-- TB_POT_BANNER: 배너 정보 (자식 테이블)
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TB_POT_BANNER')
BEGIN
    CREATE TABLE TB_POT_BANNER (
        SEQ_NO          NUMERIC         NOT NULL,
        TITLE           NVARCHAR(2000)  NULL,
        LINK_URL        NVARCHAR(2000)  NULL,
        FILE_ID         NVARCHAR(255)   NULL,
        LOCATION_CD     NVARCHAR(10)    NULL,
        BANNER_ORDER    NUMERIC         NULL,
        LINK_TYPE_CD    NVARCHAR(10)    NULL,
        EMPLY_TYPE_CD   NVARCHAR(10)    NULL,
        USE_YN          NVARCHAR(1)     NULL,
        REG_USER_ID     NVARCHAR(50)    NULL,
        REG_DATE        DATETIME        NULL,
        UPDATE_USER_ID  NVARCHAR(50)    NULL,
        UPDATE_DATE     DATETIME        NULL,
        DEL_YN          NVARCHAR(1)     NULL,
        CONSTRAINT PK_TB_POT_BANNER PRIMARY KEY (SEQ_NO),
        CONSTRAINT FK_TB_POT_BANNER_FILE FOREIGN KEY (FILE_ID)
            REFERENCES TB_POT_FILE_MAST (FILE_ID)
    );
    PRINT 'TB_POT_BANNER 테이블 생성 완료';
END
ELSE
BEGIN
    PRINT 'TB_POT_BANNER 테이블이 이미 존재합니다';
END
GO

-- ------------------------------------------------------------
-- 인덱스
-- ------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE OBJECT_NAME(object_id) = 'TB_POT_BANNER' AND name = 'IX_TB_POT_BANNER_ORDER'
)
BEGIN
    CREATE INDEX IX_TB_POT_BANNER_ORDER ON TB_POT_BANNER (BANNER_ORDER ASC);
    PRINT 'IX_TB_POT_BANNER_ORDER 인덱스 생성 완료';
END
GO
