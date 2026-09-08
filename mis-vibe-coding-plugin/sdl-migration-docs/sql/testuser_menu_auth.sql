-- =============================================
-- testuser 전체 포털 메뉴 권한 부여
-- 목적: 로컬 개발/테스트용 testuser에게 등록된 모든 포털 메뉴 READ 권한 부여
-- 실행 전: menu_dummy_data.sql, user_menu_dummy_data.sql, admin_menu_setup.sql 이 먼저 실행되어 있어야 함
-- =============================================

DECLARE @WORKGROUP_ID NVARCHAR(50);
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';

IF @WORKGROUP_ID IS NULL
BEGIN
    RAISERROR('USER_AUTH_MENU 워크그룹을 찾을 수 없습니다.', 16, 1); RETURN;
END

PRINT '사용할 WORKGROUP_ID: ' + @WORKGROUP_ID;

-- =============================================
-- testuser에게 등록된 모든 포털 메뉴 권한 일괄 부여
-- TN_CF_MENU에 등록된 PORTAL_MENU_* 중 testuser 권한이 없는 것만 INSERT
-- =============================================
INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID,
     FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
SELECT
    @WORKGROUP_ID,
    M.MENU_ID,
    'READ',
    'testuser',
    CONVERT(VARCHAR(8), GETDATE(), 112),
    '99991231',
    GETDATE(), 'admin', GETDATE(), 'admin'
FROM TN_CF_MENU M
WHERE M.MENU_ID LIKE 'PORTAL_MENU_%'
  AND M.USE_YN = '1'
  AND M.DELETE_YN = '0'
  AND NOT EXISTS (
      SELECT 1 FROM TN_CF_USER_AUTHORIZATION UA
      WHERE UA.USER_ID = 'testuser'
        AND UA.SYS_RESOURCE_ID = M.MENU_ID
  );

PRINT 'testuser 메뉴 권한 추가: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 확인 쿼리
-- =============================================
SELECT UA.SYS_RESOURCE_ID, M.LABEL, M.MENU_LEVEL, M.EXTERNAL_URL
FROM   TN_CF_USER_AUTHORIZATION UA
       JOIN TN_CF_MENU M ON M.MENU_ID = UA.SYS_RESOURCE_ID
WHERE  UA.USER_ID = 'testuser'
  AND  UA.SYS_RESOURCE_ID LIKE 'PORTAL_MENU_%'
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;
