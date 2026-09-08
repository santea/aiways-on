-- ============================================================
-- PTT 파일 다운로드 메뉴 구조 생성
-- 앱운영(1depth) > 모바일 PTT(2depth) > 파일 관리(3depth) > 파일 다운로드(4depth leaf)
-- ============================================================

-- ============================================================
-- [STEP 0] 구 DB에서 base64 ID 확인 (신규 DB 실행 전 구 DB에서 먼저 실행)
-- ※ JSON_VALUE 대신 LIKE 사용 — LABEL_JSON 형식 불일치 시 파싱 오류 방지
-- ============================================================
/*
SELECT
    M.MENU_ID,
    M.LABEL,
    M.LABEL_JSON,
    M.MENU_LEVEL,
    M.MENU_SEQUENCE,
    M.EXTERNAL_URL,
    SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE (
    M.LABEL         LIKE '%PTT%'
    OR M.LABEL      LIKE '%파일%'
    OR M.LABEL      LIKE '%앱운영%'
    OR M.LABEL_JSON LIKE '%PTT%'
    OR M.LABEL_JSON LIKE '%파일%'
    OR M.LABEL_JSON LIKE '%앱운영%'
)
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;
*/
-- ============================================================

DECLARE @SYS_ID            NVARCHAR(50);
DECLARE @WORKGROUP_ID      NVARCHAR(50);
DECLARE @MENU_TYPE_CODE_ID NVARCHAR(50);

-- 앱운영 메뉴 ID
DECLARE @APP_OPS_ID  NVARCHAR(50) = 'AVdQf478AAV_i4eq';   -- 구 DB: 앱운영 (level1, seq4)

-- PTT 메뉴 ID
DECLARE @PTT_ID      NVARCHAR(50) = 'AVCiekjsqjgeI3AQ';   -- 구 DB: Mobile PTT (level2, 앱운영 하위)
DECLARE @PTT_FILE_ID NVARCHAR(50) = 'AVCs8JpcM_AeI3AM';   -- 구 DB: 파일 관리 (level3, 모바일 PTT 하위)
DECLARE @PTT_DL_ID   NVARCHAR(50) = 'AVCx71hsAAAeI2-u';   -- 구 DB: 파일 다운로드 (level4, leaf)

SELECT TOP 1 @SYS_ID = SYS_ID FROM TN_CF_SYS;
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';
SELECT TOP 1 @MENU_TYPE_CODE_ID = CODE_ID FROM TC_CF_COMM_CODE WHERE CODE_ID LIKE 'MENU_TYPE%' AND DELETE_YN = '0';

-- ============================================================
-- 1. 모바일 PTT (2depth — 앱운영 하위, 그룹헤더)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @PTT_ID)
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@PTT_ID, @APP_OPS_ID, @SYS_ID, '모바일 PTT', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT '모바일 PTT SYS_RESOURCE 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = @APP_OPS_ID, LAST_MOD_DATETIME = GETDATE(), LAST_MODR_ID = 'admin'
    WHERE SYS_RESOURCE_ID = @PTT_ID;
    PRINT '모바일 PTT SYS_RESOURCE 부모 업데이트';
END

IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = @PTT_ID)
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    (@PTT_ID, '모바일 PTT', '{"ko_KR":"모바일 PTT","en_US":"Mobile PTT"}', 1, 2,
     '1', '0', @MENU_TYPE_CODE_ID, '0', NULL);
    PRINT '모바일 PTT MENU 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL = '모바일 PTT', USE_YN = '1', DELETE_YN = '0', MENU_SEQUENCE = 1, MENU_LEVEL = 2,
        EXTERNAL_URL_USE_YN = '0', EXTERNAL_URL = NULL
    WHERE MENU_ID = @PTT_ID;
    PRINT '모바일 PTT MENU 업데이트';
END

-- ============================================================
-- 2. 파일 관리 (3depth — 모바일 PTT 하위, 서브그룹헤더)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @PTT_FILE_ID)
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@PTT_FILE_ID, @PTT_ID, @SYS_ID, '파일 관리', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT '파일 관리 SYS_RESOURCE 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = @PTT_ID, LAST_MOD_DATETIME = GETDATE(), LAST_MODR_ID = 'admin'
    WHERE SYS_RESOURCE_ID = @PTT_FILE_ID;
    PRINT '파일 관리 SYS_RESOURCE 부모 업데이트';
END

IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = @PTT_FILE_ID)
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    (@PTT_FILE_ID, '파일 관리', '{"ko_KR":"파일 관리","en_US":"File Management"}', 0, 3,
     '1', '0', @MENU_TYPE_CODE_ID, '0', NULL);
    PRINT '파일 관리 MENU 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL = '파일 관리', LABEL_JSON = '{"ko_KR":"파일 관리","en_US":"File Management"}',
        USE_YN = '1', DELETE_YN = '0', MENU_SEQUENCE = 0, MENU_LEVEL = 3,
        EXTERNAL_URL_USE_YN = '0', EXTERNAL_URL = NULL
    WHERE MENU_ID = @PTT_FILE_ID;
    PRINT '파일 관리 MENU 업데이트';
END

-- ============================================================
-- 3. 파일 다운로드 (4depth — 파일 관리 하위, leaf)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @PTT_DL_ID)
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@PTT_DL_ID, @PTT_FILE_ID, @SYS_ID, '파일 다운로드', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT '파일 다운로드 SYS_RESOURCE 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = @PTT_FILE_ID, LAST_MOD_DATETIME = GETDATE(), LAST_MODR_ID = 'admin'
    WHERE SYS_RESOURCE_ID = @PTT_DL_ID;
    PRINT '파일 다운로드 SYS_RESOURCE 부모 업데이트';
END

IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = @PTT_DL_ID)
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    (@PTT_DL_ID, '파일 다운로드', '{"ko_KR":"파일 다운로드","en_US":"File Download"}', 1, 4,
     '1', '0', @MENU_TYPE_CODE_ID, '1', '/portal/mobileptt/file/download');
    PRINT '파일 다운로드 MENU 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL = '파일 다운로드', LABEL_JSON = '{"ko_KR":"파일 다운로드","en_US":"File Download"}',
        USE_YN = '1', DELETE_YN = '0', MENU_SEQUENCE = 1, MENU_LEVEL = 4,
        EXTERNAL_URL_USE_YN = '1', EXTERNAL_URL = '/portal/mobileptt/file/download'
    WHERE MENU_ID = @PTT_DL_ID;
    PRINT '파일 다운로드 MENU 업데이트';
END

-- ============================================================
-- 4. testuser 권한 일괄 부여
-- ============================================================
INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID,
     FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
SELECT
    @WORKGROUP_ID, M.MENU_ID, 'READ', 'testuser',
    CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
    GETDATE(), 'admin', GETDATE(), 'admin'
FROM TN_CF_MENU M
WHERE M.MENU_ID IN (@PTT_ID, @PTT_FILE_ID, @PTT_DL_ID)
  AND NOT EXISTS (
      SELECT 1 FROM TN_CF_USER_AUTHORIZATION UA
      WHERE UA.USER_ID = 'testuser' AND UA.SYS_RESOURCE_ID = M.MENU_ID
  );
PRINT 'testuser 권한 추가: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- ============================================================
-- 5. 확인
-- ============================================================
SELECT M.MENU_ID, M.LABEL, M.MENU_LEVEL, M.MENU_SEQUENCE, M.EXTERNAL_URL, M.USE_YN
FROM   TN_CF_MENU M
WHERE  M.MENU_ID IN (@PTT_ID, @PTT_FILE_ID, @PTT_DL_ID)
ORDER BY M.MENU_LEVEL;
