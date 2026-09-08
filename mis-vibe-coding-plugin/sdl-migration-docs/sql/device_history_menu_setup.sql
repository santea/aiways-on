-- =============================================
-- MY PAGE > 단말기 최종접속이력 조회 메뉴 DB 등록
-- 구 DB MENU_ID: AV0Vor_8AAB_ivgQ
-- 부모 ID: AUH8d6ocABM0TZdR (My Page)
-- MENU_LEVEL: 2, MENU_SEQUENCE: 9
-- =============================================

/* STEP 0: 구 DB 조회 쿼리 (참고용)
SELECT
    M.MENU_ID, M.LABEL, M.LABEL_JSON, M.MENU_LEVEL, M.MENU_SEQUENCE,
    M.EXTERNAL_URL, SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE (
    M.LABEL         LIKE '%접속이력%'
    OR M.EXTERNAL_URL LIKE '%deviceLastUsed%'
)
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;
-- 결과: AV0Vor_8AAB_ivgQ, level 2, seq 9, 부모: AUH8d6ocABM0TZdR (My Page)
*/

DECLARE @WORKGROUP_ID NVARCHAR(50);
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';

-- =============================================
-- 1. TN_CF_MENU URL 및 라벨 업데이트
--    변경: /portal/device/listDeviceLastUsed.do → /portal/mypage/device-history
-- =============================================
UPDATE TN_CF_MENU
SET LABEL               = '단말기 최종접속이력 조회',
    LABEL_JSON          = '{"ko_KR":"단말기 최종접속이력 조회","en_US":"Device Last Access History"}',
    EXTERNAL_URL        = '/portal/mypage/device-history',
    EXTERNAL_URL_USE_YN = '0',
    USE_YN              = '1',
    DELETE_YN           = '0'
WHERE MENU_ID = 'AV0Vor_8AAB_ivgQ';
PRINT 'AV0Vor_8AAB_ivgQ MENU 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 2. testuser 권한 등록
-- =============================================
IF NOT EXISTS (
    SELECT 1 FROM TN_CF_USER_AUTHORIZATION
    WHERE USER_ID = 'testuser' AND SYS_RESOURCE_ID = 'AV0Vor_8AAB_ivgQ'
)
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID, FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, 'AV0Vor_8AAB_ivgQ', 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT 'testuser 권한 등록 완료';
END
ELSE PRINT 'testuser 권한 이미 존재';

-- =============================================
-- 3. 확인
-- =============================================
SELECT M.MENU_ID, SR.UPPER_SYS_RESOURCE_ID AS 부모ID,
       M.LABEL, M.MENU_LEVEL, M.MENU_SEQUENCE, M.USE_YN, M.EXTERNAL_URL
FROM   TN_CF_MENU M
       JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE  SR.UPPER_SYS_RESOURCE_ID = 'AUH8d6ocABM0TZdR'
ORDER BY M.MENU_SEQUENCE;

SELECT SYS_RESOURCE_ID, USER_ID, AUTHORIZATION_ID, FROM_DATE, THRU_DATE
FROM   TN_CF_USER_AUTHORIZATION
WHERE  USER_ID = 'testuser'
  AND  SYS_RESOURCE_ID = 'AV0Vor_8AAB_ivgQ';
