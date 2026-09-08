-- ============================================================
-- PTT 그룹 대역 관리 메뉴 구조 생성
-- 앱운영(1depth) > 모바일 PTT(2depth) > 기준정보(3depth) > 그룹 대역 관리(4depth leaf)
-- ============================================================

-- ============================================================
-- [STEP 0] 구 DB에서 base64 ID 확인 (신규 DB 실행 전 구 DB에서 먼저 실행)
-- ※ JSON_VALUE 대신 LIKE 사용 — LABEL_JSON 형식 불일치 시 파싱 오류 방지
-- ============================================================
/*
-- 1단계: 키워드로 후보 검색
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
    M.LABEL         LIKE '%기준정보%'
    OR M.LABEL      LIKE '%그룹%'
    OR M.LABEL_JSON LIKE '%기준정보%'
    OR M.LABEL_JSON LIKE '%그룹%'
)
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

-- 2단계: 부모 ID로 계층 검증 (부모: AVCiekjsqjgeI3AQ = 모바일 PTT)
SELECT M.MENU_ID, M.LABEL, M.LABEL_JSON, M.MENU_LEVEL, M.MENU_SEQUENCE,
       SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE SR.UPPER_SYS_RESOURCE_ID = 'AVCiekjsqjgeI3AQ'
ORDER BY M.MENU_SEQUENCE;

-- 3단계: 기준정보 하위 확인
-- SELECT M.MENU_ID, M.LABEL, M.LABEL_JSON, M.MENU_LEVEL, M.MENU_SEQUENCE,
--        SR.UPPER_SYS_RESOURCE_ID AS 부모ID
-- FROM TN_CF_MENU M
-- JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
-- WHERE SR.UPPER_SYS_RESOURCE_ID = 'AVCie1CcqjkeI3AQ'
-- ORDER BY M.MENU_SEQUENCE;
*/
-- ============================================================

DECLARE @SYS_ID            NVARCHAR(50);
DECLARE @WORKGROUP_ID      NVARCHAR(50);
DECLARE @MENU_TYPE_CODE_ID NVARCHAR(50);

-- 상위 메뉴 ID (이미 등록된 항목)
DECLARE @APP_OPS_ID  NVARCHAR(50) = 'AVdQf478AAV_i4eq';   -- 구 DB: 앱운영 (level1, seq4)
DECLARE @PTT_ID      NVARCHAR(50) = 'AVCiekjsqjgeI3AQ';   -- 구 DB: Mobile PTT (level2, 앱운영 하위)

-- 기준정보 + 하위 메뉴 ID
DECLARE @PTT_BASIC_ID   NVARCHAR(50) = 'AVCie1CcqjkeI3AQ';  -- 구 DB: 기준정보 (level3, 모바일 PTT 하위)
DECLARE @PTT_GROUP_ID   NVARCHAR(50) = 'AVCifFZcqjoeI3AQ';  -- 구 DB: 그룹 대역 관리 (level4, seq0, leaf)
DECLARE @PTT_CHANNEL_ID NVARCHAR(50) = 'AVCifMecqjseI3AQ';  -- 구 DB: 채널 관리 (level4, seq1, leaf)

SELECT TOP 1 @SYS_ID = SYS_ID FROM TN_CF_SYS;
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';
SELECT TOP 1 @MENU_TYPE_CODE_ID = CODE_ID FROM TC_CF_COMM_CODE WHERE CODE_ID LIKE 'MENU_TYPE%' AND DELETE_YN = '0';

-- ============================================================
-- 1. 기준정보 (3depth — 모바일 PTT 하위, 서브그룹헤더)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @PTT_BASIC_ID)
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@PTT_BASIC_ID, @PTT_ID, @SYS_ID, '기준정보', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT '기준정보 SYS_RESOURCE 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = @PTT_ID, LAST_MOD_DATETIME = GETDATE(), LAST_MODR_ID = 'admin'
    WHERE SYS_RESOURCE_ID = @PTT_BASIC_ID;
    PRINT '기준정보 SYS_RESOURCE 부모 업데이트';
END

IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = @PTT_BASIC_ID)
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    (@PTT_BASIC_ID, '기준정보', '{"ko_KR":"기준정보","en_US":"Basic Information"}', 1, 3,
     '1', '0', @MENU_TYPE_CODE_ID, '0', NULL);
    PRINT '기준정보 MENU 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL = '기준정보', LABEL_JSON = '{"ko_KR":"기준정보","en_US":"Basic Information"}',
        USE_YN = '1', DELETE_YN = '0', MENU_SEQUENCE = 1, MENU_LEVEL = 3,
        EXTERNAL_URL_USE_YN = '0', EXTERNAL_URL = NULL
    WHERE MENU_ID = @PTT_BASIC_ID;
    PRINT '기준정보 MENU 업데이트';
END

-- ============================================================
-- 2. 그룹 대역 관리 (4depth — 기준정보 하위, leaf)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @PTT_GROUP_ID)
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@PTT_GROUP_ID, @PTT_BASIC_ID, @SYS_ID, '그룹 대역 관리', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT '그룹 대역 관리 SYS_RESOURCE 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = @PTT_BASIC_ID, LAST_MOD_DATETIME = GETDATE(), LAST_MODR_ID = 'admin'
    WHERE SYS_RESOURCE_ID = @PTT_GROUP_ID;
    PRINT '그룹 대역 관리 SYS_RESOURCE 부모 업데이트';
END

IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = @PTT_GROUP_ID)
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    (@PTT_GROUP_ID, '그룹 대역 관리', '{"ko_KR":"그룹 대역 관리","en_US":"Group Band Management"}', 1, 4,
     '1', '0', @MENU_TYPE_CODE_ID, '1', '/portal/mobileptt/group');
    PRINT '그룹 대역 관리 MENU 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL = '그룹 대역 관리', LABEL_JSON = '{"ko_KR":"그룹 대역 관리","en_US":"Group Band Management"}',
        USE_YN = '1', DELETE_YN = '0', MENU_SEQUENCE = 1, MENU_LEVEL = 4,
        EXTERNAL_URL_USE_YN = '1', EXTERNAL_URL = '/portal/mobileptt/group'
    WHERE MENU_ID = @PTT_GROUP_ID;
    PRINT '그룹 대역 관리 MENU 업데이트';
END

-- ============================================================
-- 3. 채널 관리 (4depth — 기준정보 하위, seq1, leaf)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @PTT_CHANNEL_ID)
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@PTT_CHANNEL_ID, @PTT_BASIC_ID, @SYS_ID, '채널 관리', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT '채널 관리 SYS_RESOURCE 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = @PTT_BASIC_ID, LAST_MOD_DATETIME = GETDATE(), LAST_MODR_ID = 'admin'
    WHERE SYS_RESOURCE_ID = @PTT_CHANNEL_ID;
    PRINT '채널 관리 SYS_RESOURCE 부모 업데이트';
END

IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = @PTT_CHANNEL_ID)
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    (@PTT_CHANNEL_ID, '채널 관리', '{"ko_KR":"채널 관리","en_US":"Channel Management"}', 1, 4,
     '1', '0', @MENU_TYPE_CODE_ID, '1', '/portal/mobileptt/channel');
    PRINT '채널 관리 MENU 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL = '채널 관리', LABEL_JSON = '{"ko_KR":"채널 관리","en_US":"Channel Management"}',
        USE_YN = '1', DELETE_YN = '0', MENU_SEQUENCE = 1, MENU_LEVEL = 4,
        EXTERNAL_URL_USE_YN = '1', EXTERNAL_URL = '/portal/mobileptt/channel'
    WHERE MENU_ID = @PTT_CHANNEL_ID;
    PRINT '채널 관리 MENU 업데이트';
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
WHERE M.MENU_ID IN (@PTT_BASIC_ID, @PTT_GROUP_ID, @PTT_CHANNEL_ID)
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
WHERE  M.MENU_ID IN (@PTT_BASIC_ID, @PTT_GROUP_ID, @PTT_CHANNEL_ID)
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;
