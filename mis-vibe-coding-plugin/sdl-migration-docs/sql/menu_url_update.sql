-- =============================================
-- 구현된 기능 메뉴 URL 매핑 업데이트
-- 구 DB 마이그레이션된 GUID 메뉴 → 신규 Vue SPA 경로로 업데이트
-- 대상: 이미 구현 완료된 기능만 (미구현 기능은 건드리지 않음)
-- =============================================

-- =============================================
-- 1. 공지사항 (사용자 뷰) → /portal/notices
-- 구 경로: /sdpboard/sdpBoardCommuListUser.do?bbsId=notice
-- =============================================
UPDATE TN_CF_MENU
SET    EXTERNAL_URL = '/portal/notices', EXTERNAL_URL_USE_YN = '0'
WHERE  MENU_ID = 'ATsmYLAaAABlLKhj';  -- 공지사항 GNB(AVdQepvcAAB_i4eq) > Notice
PRINT 'ATsmYLAaAABlLKhj (Notice 사용자뷰) 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- PORTAL_MENU_NOTICE_LIST도 이미 /portal/notices 로 되어 있으나 확인차 보정
UPDATE TN_CF_MENU
SET    EXTERNAL_URL = '/portal/notices', EXTERNAL_URL_USE_YN = '0'
WHERE  MENU_ID = 'PORTAL_MENU_NOTICE_LIST';
PRINT 'PORTAL_MENU_NOTICE_LIST 보정: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 2. 사용자 관리 (사용자 목록 조회) → /portal/users
-- 구 경로: /portal/user/listPortalUsers.do, /portal/user/getMobileUserList.do
-- =============================================
UPDATE TN_CF_MENU
SET    EXTERNAL_URL = '/portal/users', EXTERNAL_URL_USE_YN = '0'
WHERE  MENU_ID IN (
    'AVfLX0A8AAl_i4d0',  -- 앱스토어(AVdQeyOcAAF_i4eq) > User Management
    'AYdu3-5sAAB_oEjR'   -- 앱스토어(AVdQeyOcAAF_i4eq) > DS Mobile Users
);
PRINT '사용자관리 GUID 메뉴 URL 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- PORTAL_MENU_USER_LIST도 보정
UPDATE TN_CF_MENU
SET    EXTERNAL_URL = '/portal/users', EXTERNAL_URL_USE_YN = '0'
WHERE  MENU_ID IN ('PORTAL_MENU_USER_MGMT', 'PORTAL_MENU_USER_LIST');
PRINT 'PORTAL_MENU_USER* 보정: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 3. 관리기능 > 포탈컨텐츠관리 > 공지사항/매뉴얼/파트너공지 → /admin/notices
-- 구현: boardId 셀렉터(notice/manual/partner_notice/partner_manual) 1개 화면
-- 구 경로: /sdpboard/sdpBoardCommuList.do?bbsId=*
-- =============================================
UPDATE TN_CF_MENU
SET    EXTERNAL_URL = '/admin/notices', EXTERNAL_URL_USE_YN = '0'
WHERE  MENU_ID IN (
    'ATmO3S6KAAFlLkFf',  -- Contents Mgmt(ATmO2iDaAABlLkFf) > notice    (seq 0)
    'ATsB2JC6AABlLkEE',  -- Contents Mgmt(ATmO2iDaAABlLkFf) > manual    (seq 1)
    'AU-wU2t81V8eI28L'   -- Contents Mgmt(ATmO2iDaAABlLkFf) > partner notice (seq 2)
);
PRINT 'Contents Mgmt 공지사항 계열 URL 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- PORTAL_MENU_ADMIN_NOTICE 보정
UPDATE TN_CF_MENU
SET    EXTERNAL_URL = '/admin/notices', EXTERNAL_URL_USE_YN = '0'
WHERE  MENU_ID = 'PORTAL_MENU_ADMIN_NOTICE';
PRINT 'PORTAL_MENU_ADMIN_NOTICE 보정: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 4. 관리기능 > 포탈컨텐츠관리 > 배너 관리 → /admin/banners
-- 구 경로: /mgmt/banner/pageListMgmtBanner.do
-- =============================================
UPDATE TN_CF_MENU
SET    EXTERNAL_URL = '/admin/banners', EXTERNAL_URL_USE_YN = '0'
WHERE  MENU_ID = 'AVdQSAcMAAB_inYb';  -- Contents Mgmt(ATmO2iDaAABlLkFf) > Banner Mgmt (seq 5)
PRINT 'AVdQSAcMAAB_inYb (Banner Mgmt) URL 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- PORTAL_MENU_ADMIN_BANNER 보정
UPDATE TN_CF_MENU
SET    EXTERNAL_URL = '/admin/banners', EXTERNAL_URL_USE_YN = '0'
WHERE  MENU_ID = 'PORTAL_MENU_ADMIN_BANNER';
PRINT 'PORTAL_MENU_ADMIN_BANNER 보정: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 5. testuser PORTAL_MENU_* 권한 일괄 보정
-- (banner_menu_setup.sql로 추가된 PORTAL_MENU_ADMIN_BANNER 등 누락분 보완)
-- =============================================
DECLARE @WORKGROUP_ID NVARCHAR(50);
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';

IF @WORKGROUP_ID IS NOT NULL
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
        (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID,
         FROM_DATE, THRU_DATE,
         FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    SELECT
        @WORKGROUP_ID, M.MENU_ID, 'READ', 'testuser',
        CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
        GETDATE(), 'admin', GETDATE(), 'admin'
    FROM TN_CF_MENU M
    WHERE M.MENU_ID LIKE 'PORTAL_MENU_%'
      AND M.USE_YN = '1'
      AND M.DELETE_YN = '0'
      AND NOT EXISTS (
          SELECT 1 FROM TN_CF_USER_AUTHORIZATION UA
          WHERE UA.USER_ID = 'testuser' AND UA.SYS_RESOURCE_ID = M.MENU_ID
      );
    PRINT 'testuser PORTAL_MENU_* 신규 권한 추가: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';
END

-- =============================================
-- 6. 확인 쿼리 — 업데이트된 메뉴 목록
-- =============================================
SELECT
    MENU_ID,
    LABEL,
    MENU_LEVEL,
    MENU_SEQUENCE,
    USE_YN,
    EXTERNAL_URL
FROM TN_CF_MENU
WHERE MENU_ID IN (
    -- 구 GUID 메뉴
    'ATsmYLAaAABlLKhj',
    'AVfLX0A8AAl_i4d0', 'AYdu3-5sAAB_oEjR',
    'ATmO3S6KAAFlLkFf', 'ATsB2JC6AABlLkEE', 'AU-wU2t81V8eI28L',
    'AVdQSAcMAAB_inYb',
    -- 신규 PORTAL_MENU_* 메뉴
    'PORTAL_MENU_NOTICE_LIST',
    'PORTAL_MENU_USER_MGMT', 'PORTAL_MENU_USER_LIST',
    'PORTAL_MENU_ADMIN_NOTICE', 'PORTAL_MENU_ADMIN_BANNER'
)
ORDER BY MENU_LEVEL, MENU_SEQUENCE;
