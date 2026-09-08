-- ============================================================
-- 관리기능 > 런처관리 > 플랫폼 전환 상태 관리 메뉴 등록
-- 마이그레이션 단계: 35단계 (6_5_런처관리_플랫폼_전환_상태.md)
-- ============================================================

/* STEP 0 — 구 DB 메뉴 조회 (참고용)
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
    M.LABEL         LIKE '%플랫폼%'
    OR M.LABEL_JSON LIKE '%platform%'
)
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

-- 결과:
-- MENU_ID: AZbMQ-BqAACm_Dik
-- LABEL: Platform switching status management
-- EXTERNAL_URL: /portal/mobileStatus/getMobileStatus.do
-- 부모ID: AVdQgpNMAAd_i4eq (런처관리 그룹)
*/

-- ============================================================
-- 변수 선언
-- ============================================================
DECLARE @MENU_ID       NVARCHAR(50) = 'AZbMQ-BqAACm_Dik';
DECLARE @PARENT_ID     NVARCHAR(50) = 'AVdQgpNMAAd_i4eq';  -- 런처관리 그룹
DECLARE @NEW_URL       NVARCHAR(200) = '/admin/launcher/platform-status';
DECLARE @WORKGROUP_ID  NVARCHAR(50);

SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';

-- ============================================================
-- STEP 1: TN_CF_MENU 등록 (없으면 INSERT, 있으면 UPDATE)
-- ============================================================
IF EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = @MENU_ID)
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL          = '플랫폼 전환 상태 관리',
        LABEL_JSON     = '{"ko_KR":"플랫폼 전환 상태 관리","en_US":"Platform Status Management"}',
        MENU_SEQUENCE  = 30,
        MENU_LEVEL     = 3,
        USE_YN         = '1',
        DELETE_YN      = '0',
        MENU_TYPE_CODE_ID    = 'ATMQ58N6AABlL532',
        MENU_USE_PERIOD_CODE = 'A',
        EXTERNAL_URL_USE_YN  = '0',
        EXTERNAL_URL         = @NEW_URL
    WHERE MENU_ID = @MENU_ID;
    PRINT 'TN_CF_MENU UPDATE 완료';
END
ELSE
BEGIN
    -- TN_CF_MENU: FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID 컬럼 없음
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, MENU_USE_PERIOD_CODE,
     EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    (@MENU_ID, '플랫폼 전환 상태 관리',
     '{"ko_KR":"플랫폼 전환 상태 관리","en_US":"Platform Status Management"}',
     30, 3, '1', '0', 'ATMQ58N6AABlL532', 'A', '0', @NEW_URL);
    PRINT 'TN_CF_MENU INSERT 완료';
END

-- ============================================================
-- STEP 2: TN_CF_SYS_RESOURCE 등록 (없으면 INSERT, 있으면 UPDATE)
-- ============================================================
IF EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @MENU_ID)
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = @PARENT_ID,
        LAST_MOD_DATETIME     = GETDATE(),
        LAST_MODR_ID          = 'admin'
    WHERE SYS_RESOURCE_ID = @MENU_ID;
    PRINT 'TN_CF_SYS_RESOURCE UPDATE 완료';
END
ELSE
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@MENU_ID, @PARENT_ID, GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT 'TN_CF_SYS_RESOURCE INSERT 완료';
END

-- ============================================================
-- STEP 3: testuser 권한 등록
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM TN_CF_USER_AUTHORIZATION
    WHERE WORKGROUP_ID = @WORKGROUP_ID
      AND SYS_RESOURCE_ID = @MENU_ID
      AND USER_ID = 'testuser'
)
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID,
     FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, @MENU_ID, 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT 'TN_CF_USER_AUTHORIZATION INSERT 완료 (testuser)';
END
ELSE
    PRINT 'testuser 권한 이미 존재 — SKIP';

-- ============================================================
-- 확인 쿼리
-- ============================================================
SELECT M.MENU_ID, M.LABEL, M.MENU_LEVEL, M.MENU_SEQUENCE, M.EXTERNAL_URL,
       SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.MENU_ID = 'AZbMQ-BqAACm_Dik';
