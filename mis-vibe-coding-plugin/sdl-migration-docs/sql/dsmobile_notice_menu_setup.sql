-- =============================================
-- 관리기능 > 런처관리 > DS Mobile 공지사항 메뉴 DB 등록
-- 구 DB MENU_ID: AZh9f_06AASm_DgW
-- 부모 ID: AVdQgpNMAAd_i4eq (런처관리)
-- =============================================

/* STEP 0: 구 DB 조회 쿼리 (참고용)
SELECT
    M.MENU_ID, M.LABEL, M.LABEL_JSON, M.MENU_LEVEL, M.MENU_SEQUENCE,
    M.EXTERNAL_URL, SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE (
    M.LABEL         LIKE '%DS Mobile%'
    OR M.LABEL_JSON LIKE '%DS Mobile%'
    OR M.EXTERNAL_URL LIKE '%DsMobileNotice%'
)
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;
-- 결과: AZh9f_06AASm_DgW, 부모: AVdQgpNMAAd_i4eq (런처관리)
*/

DECLARE @WORKGROUP_ID NVARCHAR(50);
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';

-- =============================================
-- 1. TN_CF_MENU URL 및 라벨 업데이트
--    변경: /portal/notice/listDsMobileNotice.do → /admin/launcher/dsmobile-notices
-- =============================================
UPDATE TN_CF_MENU
SET LABEL               = 'DS Mobile 공지사항',
    LABEL_JSON          = '{"ko_KR":"DS Mobile 공지사항","en_US":"DS Mobile Notice"}',
    EXTERNAL_URL        = '/admin/launcher/dsmobile-notices',
    EXTERNAL_URL_USE_YN = '0',
    MENU_SEQUENCE       = 8,
    USE_YN              = '1',
    DELETE_YN           = '0'
WHERE MENU_ID = 'AZh9f_06AASm_DgW';
PRINT 'AZh9f_06AASm_DgW MENU 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 2. TN_CF_SYS_RESOURCE 부모 확인 (런처관리 AVdQgpNMAAd_i4eq 하위)
-- =============================================
UPDATE TN_CF_SYS_RESOURCE
SET UPPER_SYS_RESOURCE_ID  = 'AVdQgpNMAAd_i4eq',
    LAST_MOD_DATETIME      = GETDATE(),
    LAST_MODR_ID           = 'admin'
WHERE SYS_RESOURCE_ID = 'AZh9f_06AASm_DgW';
PRINT 'SYS_RESOURCE 부모 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 3. testuser 권한 등록
-- =============================================
IF NOT EXISTS (
    SELECT 1 FROM TN_CF_USER_AUTHORIZATION
    WHERE USER_ID = 'testuser' AND SYS_RESOURCE_ID = 'AZh9f_06AASm_DgW'
)
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID, FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, 'AZh9f_06AASm_DgW', 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT 'testuser 권한 등록 완료';
END
ELSE PRINT 'testuser 권한 이미 존재';

-- =============================================
-- 4. 확인
-- =============================================
SELECT M.MENU_ID, SR.UPPER_SYS_RESOURCE_ID AS 부모ID,
       M.LABEL, M.MENU_LEVEL, M.MENU_SEQUENCE, M.USE_YN, M.EXTERNAL_URL
FROM   TN_CF_MENU M
       JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE  SR.UPPER_SYS_RESOURCE_ID = 'AVdQgpNMAAd_i4eq'
ORDER BY M.MENU_SEQUENCE;

SELECT SYS_RESOURCE_ID, USER_ID, AUTHORIZATION_ID, FROM_DATE, THRU_DATE
FROM   TN_CF_USER_AUTHORIZATION
WHERE  USER_ID = 'testuser'
  AND  SYS_RESOURCE_ID = 'AZh9f_06AASm_DgW';
