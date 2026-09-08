-- =============================================
-- 공지사항 그룹 > Partner 공지사항 (사용자 뷰) 메뉴 등록
-- 구 DB MENU_ID: AU-wTozM1SUeI28L
-- 부모: AVdQepvcAAB_i4eq (공지사항 그룹)
-- 위치: 공지사항(seq 2)과 파트너 모바일 관리 매뉴얼(seq 4) 사이 (seq 3)
-- =============================================

/*
STEP 0: 구 DB 조회 쿼리
SELECT M.MENU_ID, M.LABEL, M.LABEL_JSON, M.MENU_LEVEL, M.MENU_SEQUENCE,
       M.EXTERNAL_URL, SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.LABEL LIKE '%Partner%' OR M.LABEL_JSON LIKE '%partner_notice%'
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

-- 결과 (사용자 뷰):
--   AU-wTozM1SUeI28L | Partner Notice
--   LABEL_JSON: {"ko_KR":"파트너 공지사항","en_US":"Partner Notice"}
--   MENU_LEVEL: 2, MENU_SEQUENCE: 3
--   EXTERNAL_URL: /sdpboard/sdpBoardCommuListUser.do?bbsId=partner_notice
--   부모ID: AVdQepvcAAB_i4eq (공지사항 그룹)
--   → 신 DB URL 교체: /portal/partner/notices
*/

DECLARE @SYS_ID NVARCHAR(50);
DECLARE @WORKGROUP_ID NVARCHAR(50);
DECLARE @MENU_TYPE_CODE_ID NVARCHAR(50);

SELECT TOP 1 @SYS_ID = SYS_ID FROM TN_CF_SYS;
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';
SELECT TOP 1 @MENU_TYPE_CODE_ID = CODE_ID FROM TC_CF_COMM_CODE WHERE CODE_ID LIKE 'MENU_TYPE%' AND DELETE_YN = '0';

-- =============================================
-- 1. TN_CF_SYS_RESOURCE 등록/수정
--    부모: AVdQepvcAAB_i4eq (공지사항 그룹)
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = 'AU-wTozM1SUeI28L')
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    ('AU-wTozM1SUeI28L', 'AVdQepvcAAB_i4eq', @SYS_ID, '파트너 공지사항', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin')
    PRINT 'AU-wTozM1SUeI28L SYS_RESOURCE 등록'
END
ELSE
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = 'AVdQepvcAAB_i4eq',
        SYS_RESOURCE_NAME     = '파트너 공지사항',
        DELETE_YN             = '0',
        LAST_MOD_DATETIME     = GETDATE(),
        LAST_MODR_ID          = 'admin'
    WHERE SYS_RESOURCE_ID = 'AU-wTozM1SUeI28L'
    PRINT 'AU-wTozM1SUeI28L SYS_RESOURCE 업데이트'
END

-- =============================================
-- 2. TN_CF_MENU 등록/수정
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = 'AU-wTozM1SUeI28L')
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    ('AU-wTozM1SUeI28L',
     '파트너 공지사항',
     '{"ko_KR":"파트너 공지사항","en_US":"Partner Notice"}',
     3, 2,
     '1', '0',
     @MENU_TYPE_CODE_ID,
     '0',
     '/portal/partner/notices')
    PRINT 'AU-wTozM1SUeI28L MENU 등록'
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL               = '파트너 공지사항',
        LABEL_JSON          = '{"ko_KR":"파트너 공지사항","en_US":"Partner Notice"}',
        MENU_SEQUENCE       = 3,
        MENU_LEVEL          = 2,
        USE_YN              = '1',
        DELETE_YN           = '0',
        EXTERNAL_URL_USE_YN = '0',
        EXTERNAL_URL        = '/portal/partner/notices'
    WHERE MENU_ID = 'AU-wTozM1SUeI28L'
    PRINT 'AU-wTozM1SUeI28L MENU 업데이트'
END

-- =============================================
-- 3. testuser 권한 등록
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_USER_AUTHORIZATION
               WHERE USER_ID = 'testuser' AND SYS_RESOURCE_ID = 'AU-wTozM1SUeI28L')
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID, FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, 'AU-wTozM1SUeI28L', 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin')
    PRINT 'AU-wTozM1SUeI28L testuser 권한 등록'
END
ELSE PRINT 'AU-wTozM1SUeI28L testuser 권한 이미 존재'

-- =============================================
-- 4. 최종 확인 — 공지사항 그룹(AVdQepvcAAB_i4eq) 하위 전체
-- =============================================
SELECT M.MENU_ID, SR.UPPER_SYS_RESOURCE_ID AS 부모ID, M.LABEL,
       M.MENU_LEVEL, M.MENU_SEQUENCE, M.USE_YN, M.EXTERNAL_URL
FROM   TN_CF_MENU M
       JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE  SR.UPPER_SYS_RESOURCE_ID = 'AVdQepvcAAB_i4eq'
ORDER BY M.MENU_SEQUENCE;
