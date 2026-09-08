-- =============================================
-- 관리기능 > 포탈컨텐츠관리 > Partner 공지사항 메뉴 등록
-- 구 DB MENU_ID: AU-wUxWM1UseI28L
-- =============================================

/*
STEP 0: 구 DB 조회 쿼리
SELECT M.MENU_ID, M.LABEL, M.LABEL_JSON, M.MENU_LEVEL, M.MENU_SEQUENCE,
       M.EXTERNAL_URL, SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.LABEL LIKE '%Partner%' AND M.LABEL LIKE '%공지%'
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

결과:
  AU-wUxWM1UseI28L | Partner 공지사항 | level 3 | seq 2
  부모ID: ATmO2iDaAABlLkFf (포탈컨텐츠관리)
  URL: /sdpboard/sdpBoardCommuList.do?bbsId=partner_notice
  → 신 DB URL로 교체: /admin/notices?boardId=PARTNER_NOTICE
*/

DECLARE @SYS_ID NVARCHAR(50);
DECLARE @WORKGROUP_ID NVARCHAR(50);
DECLARE @MENU_TYPE_CODE_ID NVARCHAR(50);

SELECT TOP 1 @SYS_ID = SYS_ID FROM TN_CF_SYS;
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';
SELECT TOP 1 @MENU_TYPE_CODE_ID = CODE_ID FROM TC_CF_COMM_CODE WHERE CODE_ID LIKE 'MENU_TYPE%' AND DELETE_YN = '0';

-- =============================================
-- 1. TN_CF_SYS_RESOURCE 등록
--    부모: PORTAL_MENU_CONTENT_MGMT (포탈컨텐츠관리, 신 DB 트리)
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = 'AU-wUxWM1UseI28L')
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    ('AU-wUxWM1UseI28L', 'PORTAL_MENU_CONTENT_MGMT', @SYS_ID, 'Partner 공지사항', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin')
    PRINT 'AU-wUxWM1UseI28L SYS_RESOURCE 등록'
END
ELSE PRINT 'AU-wUxWM1UseI28L SYS_RESOURCE 이미 존재'

-- =============================================
-- 2. TN_CF_MENU 등록
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = 'AU-wUxWM1UseI28L')
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    ('AU-wUxWM1UseI28L',
     'Partner 공지사항',
     '{"ko_KR":"Partner 공지사항","en_US":"Partner Notice"}',
     2, 3,
     '1', '0',
     @MENU_TYPE_CODE_ID,
     '1',
     '/admin/notices?boardId=PARTNER_NOTICE')
    PRINT 'AU-wUxWM1UseI28L MENU 등록'
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL               = 'Partner 공지사항',
        LABEL_JSON          = '{"ko_KR":"Partner 공지사항","en_US":"Partner Notice"}',
        MENU_SEQUENCE       = 2,
        MENU_LEVEL          = 3,
        USE_YN              = '1',
        DELETE_YN           = '0',
        EXTERNAL_URL_USE_YN = '1',
        EXTERNAL_URL        = '/admin/notices?boardId=PARTNER_NOTICE'
    WHERE MENU_ID = 'AU-wUxWM1UseI28L'
    PRINT 'AU-wUxWM1UseI28L MENU 업데이트'
END

-- =============================================
-- 3. testuser 권한 등록
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_USER_AUTHORIZATION
               WHERE USER_ID = 'testuser' AND SYS_RESOURCE_ID = 'AU-wUxWM1UseI28L')
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID, FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, 'AU-wUxWM1UseI28L', 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin')
    PRINT 'AU-wUxWM1UseI28L testuser 권한 등록'
END
ELSE PRINT 'AU-wUxWM1UseI28L testuser 권한 이미 존재'

-- =============================================
-- 4. 최종 확인
-- =============================================
SELECT M.MENU_ID, SR.UPPER_SYS_RESOURCE_ID AS 부모ID, M.LABEL,
       M.MENU_LEVEL, M.MENU_SEQUENCE, M.USE_YN, M.EXTERNAL_URL
FROM   TN_CF_MENU M
       JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE  SR.UPPER_SYS_RESOURCE_ID = 'PORTAL_MENU_CONTENT_MGMT'
ORDER BY M.MENU_SEQUENCE;
