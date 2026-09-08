-- =============================================
-- DS Mobile 사용신청 관리 메뉴 DB 등록
-- 메뉴 경로: 앱스토어 > DS Mobile 사용신청 관리
-- URL: /portal/apps
-- =============================================

-- =============================================
-- STEP 0: 구 DB에서 앱스토어 하위 메뉴 조회 (MENU_ID 확인용)
-- 아래 쿼리 결과에서 '사용신청' 관련 MENU_ID(base64)를 확인 후 DECLARE에 입력
-- =============================================
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
    M.LABEL         LIKE '%사용신청%'
    OR M.LABEL_JSON LIKE '%사용신청%'
    OR M.LABEL      LIKE '%App%'
    OR M.LABEL_JSON LIKE '%App%'
    OR M.LABEL      LIKE '%앱%'
    OR M.LABEL_JSON LIKE '%앱%'
)
AND M.DELETE_YN = '0'
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

-- 앱스토어(AVdQeyOcAAF_i4eq) 하위 메뉴 전체 조회
SELECT M.MENU_ID, M.LABEL, M.LABEL_JSON, M.MENU_LEVEL, M.MENU_SEQUENCE,
       SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE SR.UPPER_SYS_RESOURCE_ID = 'AVdQeyOcAAF_i4eq'
ORDER BY M.MENU_SEQUENCE;
*/

-- =============================================
-- STEP 1: 변수 선언
-- 구 DB 조회 결과로 확인된 base64 MENU_ID를 아래에 입력
-- 앱스토어 1depth ID: AVdQeyOcAAF_i4eq (menu_url_update.sql 에서 확인됨)
-- =============================================
DECLARE @SYS_ID          NVARCHAR(50);
DECLARE @WORKGROUP_ID    NVARCHAR(50);
DECLARE @MENU_TYPE_CODE  NVARCHAR(50);

-- 앱스토어 base64 ID (기존 확인된 값)
DECLARE @APP_STORE_ID    NVARCHAR(200) = 'AVdQeyOcAAF_i4eq';
-- 사용신청 관리 base64 ID: STEP 0 실행 후 아래에 입력 (예: 'AXxxxxxxxxxxxxxx')
DECLARE @APP_MGMT_ID     NVARCHAR(200) = '';

SELECT TOP 1 @SYS_ID        = SYS_ID      FROM TN_CF_SYS;
SELECT       @WORKGROUP_ID  = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';
SELECT TOP 1 @MENU_TYPE_CODE = CODE_ID    FROM TC_CF_COMM_CODE  WHERE CODE_ID LIKE 'MENU_TYPE%' AND DELETE_YN = '0';

PRINT 'SYS_ID        : ' + ISNULL(@SYS_ID, 'NULL');
PRINT 'WORKGROUP_ID  : ' + ISNULL(@WORKGROUP_ID, 'NULL');
PRINT 'APP_STORE_ID  : ' + @APP_STORE_ID;
PRINT 'APP_MGMT_ID   : ' + ISNULL(NULLIF(@APP_MGMT_ID, ''), '미입력 — STEP 0 실행 후 입력 필요');

IF @SYS_ID IS NULL
BEGIN RAISERROR('SYS_ID 없음. TN_CF_SYS 확인.', 16, 1); RETURN; END

IF @WORKGROUP_ID IS NULL
BEGIN RAISERROR('USER_AUTH_MENU 워크그룹 없음.', 16, 1); RETURN; END

-- 앱스토어 부모 메뉴 존재 확인
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @APP_STORE_ID)
BEGIN RAISERROR('앱스토어 메뉴(AVdQeyOcAAF_i4eq)가 신 DB에 없습니다. migration_menu_auth.sql 먼저 실행하세요.', 16, 1); RETURN; END

-- =============================================
-- STEP 2: 기존 PORTAL_MENU_APP_STORE 하위의 PORTAL_MENU_* 항목 확인
-- (gnb_menu_setup.sql 에서 앱스토어를 PORTAL_MENU_APP_STORE 로 등록했을 경우)
-- =============================================
PRINT '--- 현재 앱스토어 하위 메뉴 ---';
SELECT M.MENU_ID, M.LABEL, M.MENU_LEVEL, M.MENU_SEQUENCE, M.EXTERNAL_URL,
       SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE SR.UPPER_SYS_RESOURCE_ID IN (@APP_STORE_ID, 'PORTAL_MENU_APP_STORE')
  AND M.DELETE_YN = '0'
ORDER BY M.MENU_SEQUENCE;

-- =============================================
-- STEP 3: APP_MGMT_ID 입력 여부에 따라 분기
-- base64 ID가 있으면 구 DB ID 이식, 없으면 PORTAL_MENU_* 방식으로 등록
-- =============================================
IF NULLIF(@APP_MGMT_ID, '') IS NOT NULL
BEGIN
    -- ── base64 ID 이식 방식 ──────────────────────────────────────────
    PRINT 'base64 ID 이식 방식으로 진행: ' + @APP_MGMT_ID;

    -- TN_CF_SYS_RESOURCE 등록
    IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @APP_MGMT_ID)
    BEGIN
        INSERT INTO TN_CF_SYS_RESOURCE
        (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
         DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
        VALUES
        (@APP_MGMT_ID, @APP_STORE_ID, @SYS_ID, 'DS Mobile 사용신청 관리', 'MENU',
         '0', GETDATE(), 'admin', GETDATE(), 'admin');
        PRINT @APP_MGMT_ID + ' SYS_RESOURCE 등록: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';
    END
    ELSE
    BEGIN
        -- 이미 존재하면 부모를 앱스토어로 교정
        UPDATE TN_CF_SYS_RESOURCE
        SET UPPER_SYS_RESOURCE_ID = @APP_STORE_ID
        WHERE SYS_RESOURCE_ID = @APP_MGMT_ID;
        PRINT @APP_MGMT_ID + ' SYS_RESOURCE 부모 교정: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';
    END

    -- TN_CF_MENU 등록/업데이트
    IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = @APP_MGMT_ID)
    BEGIN
        INSERT INTO TN_CF_MENU
        (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
         USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
        VALUES
        (@APP_MGMT_ID, 'DS Mobile 사용신청 관리',
         '{"ko_KR":"DS Mobile 사용신청 관리","en_US":"DS Mobile App Request"}',
         1, 2, '1', '0', @MENU_TYPE_CODE, '0', '/portal/apps');
        PRINT @APP_MGMT_ID + ' MENU 등록: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';
    END
    ELSE
    BEGIN
        UPDATE TN_CF_MENU
        SET LABEL             = 'DS Mobile 사용신청 관리',
            LABEL_JSON        = '{"ko_KR":"DS Mobile 사용신청 관리","en_US":"DS Mobile App Request"}',
            MENU_SEQUENCE     = 1,
            MENU_LEVEL        = 2,
            USE_YN            = '1',
            DELETE_YN         = '0',
            EXTERNAL_URL_USE_YN = '0',
            EXTERNAL_URL      = '/portal/apps'
        WHERE MENU_ID = @APP_MGMT_ID;
        PRINT @APP_MGMT_ID + ' MENU 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';
    END

    -- 기존 PORTAL_MENU_* 항목이 앱스토어 하위에 있으면 제거
    -- (gnb_menu_setup.sql 이 PORTAL_MENU_APP_STORE 하위에 별도 등록한 경우 정리)
    DELETE FROM TN_CF_USER_AUTHORIZATION
    WHERE SYS_RESOURCE_ID IN (
        SELECT SR.SYS_RESOURCE_ID FROM TN_CF_SYS_RESOURCE SR
        WHERE SR.UPPER_SYS_RESOURCE_ID IN (@APP_STORE_ID, 'PORTAL_MENU_APP_STORE')
          AND SR.SYS_RESOURCE_ID LIKE 'PORTAL_MENU_%'
          AND SR.SYS_RESOURCE_ID NOT IN (@APP_MGMT_ID)
    );
    DELETE FROM TN_CF_MENU
    WHERE MENU_ID IN (
        SELECT SR.SYS_RESOURCE_ID FROM TN_CF_SYS_RESOURCE SR
        WHERE SR.UPPER_SYS_RESOURCE_ID IN (@APP_STORE_ID, 'PORTAL_MENU_APP_STORE')
          AND SR.SYS_RESOURCE_ID LIKE 'PORTAL_MENU_%'
          AND SR.SYS_RESOURCE_ID NOT IN (@APP_MGMT_ID)
    );
    DELETE FROM TN_CF_SYS_RESOURCE
    WHERE UPPER_SYS_RESOURCE_ID IN (@APP_STORE_ID, 'PORTAL_MENU_APP_STORE')
      AND SYS_RESOURCE_ID LIKE 'PORTAL_MENU_%'
      AND SYS_RESOURCE_ID NOT IN (@APP_MGMT_ID);
    PRINT '기존 PORTAL_MENU_* 중복 항목 정리 완료';
END
ELSE
BEGIN
    -- ── PORTAL_MENU_* 방식 (base64 ID 미확인 시 임시 등록) ───────────
    PRINT 'PORTAL_MENU_APP_MGMT 방식으로 임시 등록 (나중에 base64로 교체 필요)';
    SET @APP_MGMT_ID = 'PORTAL_MENU_APP_MGMT';

    IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = 'PORTAL_MENU_APP_MGMT')
    BEGIN
        INSERT INTO TN_CF_SYS_RESOURCE
        (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
         DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
        VALUES
        ('PORTAL_MENU_APP_MGMT', @APP_STORE_ID, @SYS_ID, 'DS Mobile 사용신청 관리', 'MENU',
         '0', GETDATE(), 'admin', GETDATE(), 'admin');
        PRINT 'PORTAL_MENU_APP_MGMT SYS_RESOURCE 등록: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';
    END
    ELSE PRINT 'PORTAL_MENU_APP_MGMT SYS_RESOURCE 이미 존재';

    IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = 'PORTAL_MENU_APP_MGMT')
    BEGIN
        INSERT INTO TN_CF_MENU
        (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
         USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
        VALUES
        ('PORTAL_MENU_APP_MGMT', 'DS Mobile 사용신청 관리',
         '{"ko_KR":"DS Mobile 사용신청 관리","en_US":"DS Mobile App Request"}',
         1, 2, '1', '0', @MENU_TYPE_CODE, '0', '/portal/apps');
        PRINT 'PORTAL_MENU_APP_MGMT MENU 등록: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';
    END
    ELSE
    BEGIN
        UPDATE TN_CF_MENU
        SET LABEL = 'DS Mobile 사용신청 관리',
            LABEL_JSON = '{"ko_KR":"DS Mobile 사용신청 관리","en_US":"DS Mobile App Request"}',
            MENU_SEQUENCE = 1, MENU_LEVEL = 2, USE_YN = '1',
            EXTERNAL_URL_USE_YN = '0', EXTERNAL_URL = '/portal/apps'
        WHERE MENU_ID = 'PORTAL_MENU_APP_MGMT';
        PRINT 'PORTAL_MENU_APP_MGMT MENU 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';
    END
END

-- =============================================
-- STEP 4: testuser 권한 등록
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_USER_AUTHORIZATION
               WHERE USER_ID = 'testuser' AND SYS_RESOURCE_ID = @APP_MGMT_ID)
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID,
     FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, @APP_MGMT_ID, 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT 'testuser 권한 등록: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';
END
ELSE PRINT 'testuser 권한 이미 존재';

-- =============================================
-- STEP 5: 확인 쿼리
-- =============================================
SELECT M.MENU_ID, M.LABEL, M.MENU_LEVEL, M.MENU_SEQUENCE,
       M.USE_YN, M.EXTERNAL_URL,
       SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.DELETE_YN = '0'
  AND (SR.UPPER_SYS_RESOURCE_ID IN (@APP_STORE_ID, 'PORTAL_MENU_APP_STORE')
    OR M.MENU_ID IN (@APP_STORE_ID, 'PORTAL_MENU_APP_STORE'))
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

SELECT UA.USER_ID, UA.SYS_RESOURCE_ID, UA.AUTHORIZATION_ID
FROM TN_CF_USER_AUTHORIZATION UA
WHERE UA.USER_ID = 'testuser'
  AND UA.SYS_RESOURCE_ID = @APP_MGMT_ID;
