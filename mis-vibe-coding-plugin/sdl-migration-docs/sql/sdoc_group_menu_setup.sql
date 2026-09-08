-- ============================================================
-- S.DOC 문서 그룹 관리 메뉴 등록
-- 구조:
--   관리기능 (1depth, PORTAL_MENU_ADMIN) ← 이미 존재
--     └ S.DOC 관리 (2depth, AWs_4zMcAAB_4caM) ← 신규 등록
--         └ 문서 그룹 관리 (3depth, AWtFK8-MAAB_4cZO) ← 신규 등록 (leaf)
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
    M.LABEL         LIKE '%S.DOC%'
    OR M.LABEL      LIKE '%문서 그룹%'
    OR M.LABEL_JSON LIKE '%S.DOC%'
    OR M.LABEL_JSON LIKE '%문서 그룹%'
)
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

-- 확인된 결과:
-- AWs_4zMcAAB_4caM  S.DOC Management   level=2  seq=4   부모=u4GVTuZEkN6LJwAE (관리기능)
-- AWtFK8-MAAB_4cZO  S.DOC Group Mgmt   level=3  seq=0   부모=AWs_4zMcAAB_4caM (S.DOC 관리)

-- 2단계: S.DOC 관리 하위 계층 검증
SELECT M.MENU_ID, M.LABEL, M.LABEL_JSON, M.MENU_LEVEL, M.MENU_SEQUENCE,
       SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE SR.UPPER_SYS_RESOURCE_ID = 'AWs_4zMcAAB_4caM'
ORDER BY M.MENU_SEQUENCE;
*/
-- ============================================================

DECLARE @SYS_ID            NVARCHAR(50);
DECLARE @WORKGROUP_ID      NVARCHAR(50);
DECLARE @MENU_TYPE_CODE_ID NVARCHAR(50);

-- 신규 DB의 관리기능 1depth (구 DB base64 ID)
DECLARE @ADMIN_MENU_ID     NVARCHAR(50) = 'u4GVTuZEkN6LJwAE';

-- 구 DB base64 ID
DECLARE @SDOC_MGMT_ID      NVARCHAR(50) = 'AWs_4zMcAAB_4caM';  -- S.DOC 관리 (level2, seq4, 관리기능 하위)
DECLARE @SDOC_GROUP_ID     NVARCHAR(50) = 'AWtFK8-MAAB_4cZO';  -- 문서 그룹 관리 (level3, seq0, S.DOC 관리 하위, leaf)

SELECT TOP 1 @SYS_ID = SYS_ID FROM TN_CF_SYS;
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';
SELECT TOP 1 @MENU_TYPE_CODE_ID = CODE_ID FROM TC_CF_COMM_CODE WHERE CODE_ID LIKE 'MENU_TYPE%' AND DELETE_YN = '0';

-- ============================================================
-- 1. S.DOC 관리 (2depth — 관리기능 하위, 서브그룹헤더)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @SDOC_MGMT_ID)
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@SDOC_MGMT_ID, @ADMIN_MENU_ID, @SYS_ID, 'S.DOC 관리', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT 'S.DOC 관리 SYS_RESOURCE 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = @ADMIN_MENU_ID, LAST_MOD_DATETIME = GETDATE(), LAST_MODR_ID = 'admin'
    WHERE SYS_RESOURCE_ID = @SDOC_MGMT_ID;
    PRINT 'S.DOC 관리 SYS_RESOURCE 부모 업데이트';
END

IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = @SDOC_MGMT_ID)
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    (@SDOC_MGMT_ID, 'S.DOC 관리', '{"ko_KR":"S.DOC 관리","en_US":"S.DOC Management"}', 4, 2,
     '1', '0', @MENU_TYPE_CODE_ID, '0', NULL);
    PRINT 'S.DOC 관리 MENU 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL = 'S.DOC 관리', LABEL_JSON = '{"ko_KR":"S.DOC 관리","en_US":"S.DOC Management"}',
        USE_YN = '1', DELETE_YN = '0', MENU_SEQUENCE = 4, MENU_LEVEL = 2,
        EXTERNAL_URL_USE_YN = '0', EXTERNAL_URL = NULL
    WHERE MENU_ID = @SDOC_MGMT_ID;
    PRINT 'S.DOC 관리 MENU 업데이트';
END

-- ============================================================
-- 2. 문서 그룹 관리 (3depth — S.DOC 관리 하위, seq0, leaf)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @SDOC_GROUP_ID)
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@SDOC_GROUP_ID, @SDOC_MGMT_ID, @SYS_ID, '문서 그룹 관리', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT '문서 그룹 관리 SYS_RESOURCE 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = @SDOC_MGMT_ID, LAST_MOD_DATETIME = GETDATE(), LAST_MODR_ID = 'admin'
    WHERE SYS_RESOURCE_ID = @SDOC_GROUP_ID;
    PRINT '문서 그룹 관리 SYS_RESOURCE 부모 업데이트';
END

IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = @SDOC_GROUP_ID)
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    (@SDOC_GROUP_ID, '문서 그룹 관리', '{"ko_KR":"문서 그룹 관리","en_US":"S.DOC Group Management"}', 0, 3,
     '1', '0', @MENU_TYPE_CODE_ID, '1', '/admin/sdoc/group');
    PRINT '문서 그룹 관리 MENU 등록';
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL = '문서 그룹 관리', LABEL_JSON = '{"ko_KR":"문서 그룹 관리","en_US":"S.DOC Group Management"}',
        USE_YN = '1', DELETE_YN = '0', MENU_SEQUENCE = 0, MENU_LEVEL = 3,
        EXTERNAL_URL_USE_YN = '1', EXTERNAL_URL = '/admin/sdoc/group'
    WHERE MENU_ID = @SDOC_GROUP_ID;
    PRINT '문서 그룹 관리 MENU 업데이트';
END

-- ============================================================
-- 3. testuser 권한 부여 (S.DOC 관리 + 문서 그룹 관리)
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
WHERE M.MENU_ID IN (@SDOC_MGMT_ID, @SDOC_GROUP_ID)
  AND NOT EXISTS (
      SELECT 1 FROM TN_CF_USER_AUTHORIZATION UA
      WHERE UA.USER_ID = 'testuser' AND UA.SYS_RESOURCE_ID = M.MENU_ID
  );
PRINT 'testuser 권한 추가: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- ============================================================
-- 4. 확인
-- ============================================================
SELECT M.MENU_ID, SR.UPPER_SYS_RESOURCE_ID AS 부모ID, M.LABEL,
       M.MENU_LEVEL, M.MENU_SEQUENCE, M.USE_YN, M.EXTERNAL_URL
FROM   TN_CF_MENU M
       JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE  M.MENU_ID IN (@SDOC_MGMT_ID, @SDOC_GROUP_ID)
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;
