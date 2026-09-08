-- =============================================
-- 공지사항 > 자주 묻는 질문 (FAQ) 메뉴 등록
-- 구 DB MENU_ID: AVdQXyCsABh_illV
-- 부모: AVdQepvcAAB_i4eq (공지사항 GNB, level 1)
-- =============================================

/*
STEP 0: 구 DB 조회 쿼리
SELECT M.MENU_ID, M.LABEL, M.LABEL_JSON, M.MENU_LEVEL, M.MENU_SEQUENCE,
       M.EXTERNAL_URL, SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.LABEL LIKE '%FAQ%' OR M.LABEL LIKE '%자주%' OR M.LABEL_JSON LIKE '%FAQ%'
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

결과:
  AVdQXyCsABh_illV | FAQ | level 2 | seq 2
  부모ID: AVdQepvcAAB_i4eq (공지사항 GNB)
  → 신 DB URL: /portal/faq
*/

DECLARE @SYS_ID NVARCHAR(50);
DECLARE @WORKGROUP_ID NVARCHAR(50);
DECLARE @MENU_TYPE_CODE_ID NVARCHAR(50);

SELECT TOP 1 @SYS_ID = SYS_ID FROM TN_CF_SYS;
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';
SELECT TOP 1 @MENU_TYPE_CODE_ID = CODE_ID FROM TC_CF_COMM_CODE WHERE CODE_ID LIKE 'MENU_TYPE%' AND DELETE_YN = '0';

-- =============================================
-- 1. TN_CF_SYS_RESOURCE 등록
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = 'AVdQXyCsABh_illV')
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    ('AVdQXyCsABh_illV', 'AVdQepvcAAB_i4eq', @SYS_ID, '자주 묻는 질문', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin')
    PRINT 'AVdQXyCsABh_illV SYS_RESOURCE 등록'
END
ELSE
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = 'AVdQepvcAAB_i4eq'
    WHERE SYS_RESOURCE_ID = 'AVdQXyCsABh_illV'
    PRINT 'AVdQXyCsABh_illV SYS_RESOURCE 업데이트'
END

-- =============================================
-- 2. TN_CF_MENU 등록
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = 'AVdQXyCsABh_illV')
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    ('AVdQXyCsABh_illV',
     '자주 묻는 질문',
     '{"ko_KR":"자주 묻는 질문","en_US":"FAQ"}',
     2, 2,
     '1', '0',
     @MENU_TYPE_CODE_ID,
     '0',
     '/portal/faq')
    PRINT 'AVdQXyCsABh_illV MENU 등록'
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL               = '자주 묻는 질문',
        LABEL_JSON          = '{"ko_KR":"자주 묻는 질문","en_US":"FAQ"}',
        MENU_SEQUENCE       = 2,
        MENU_LEVEL          = 2,
        USE_YN              = '1',
        DELETE_YN           = '0',
        EXTERNAL_URL_USE_YN = '0',
        EXTERNAL_URL        = '/portal/faq'
    WHERE MENU_ID = 'AVdQXyCsABh_illV'
    PRINT 'AVdQXyCsABh_illV MENU 업데이트'
END

-- =============================================
-- 3. testuser 권한 등록
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_USER_AUTHORIZATION
               WHERE USER_ID = 'testuser' AND SYS_RESOURCE_ID = 'AVdQXyCsABh_illV')
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID, FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, 'AVdQXyCsABh_illV', 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin')
    PRINT 'AVdQXyCsABh_illV testuser 권한 등록'
END
ELSE PRINT 'AVdQXyCsABh_illV testuser 권한 이미 존재'

-- =============================================
-- 4. 최종 확인
-- =============================================
SELECT M.MENU_ID, SR.UPPER_SYS_RESOURCE_ID AS 부모ID, M.LABEL,
       M.MENU_LEVEL, M.MENU_SEQUENCE, M.USE_YN, M.EXTERNAL_URL
FROM   TN_CF_MENU M
       JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE  SR.UPPER_SYS_RESOURCE_ID = 'AVdQepvcAAB_i4eq'
ORDER BY M.MENU_SEQUENCE;
