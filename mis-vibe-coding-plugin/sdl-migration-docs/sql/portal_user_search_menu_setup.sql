-- =============================================
-- 관리기능 > 포탈관리 > 사용자조회 메뉴 등록
-- 구 DB MENU_ID:
--   포탈관리:   AVdQhBc8AAl_i4eq (level 2, seq 1, 부모: u4GVTuZEkN6LJwAE)
--   사용자조회: 96aIzNw92ZaD0AAB (level 3, seq 0, 부모: AVdQhBc8AAl_i4eq)
-- =============================================

/*
STEP 0: 구 DB 조회 쿼리 (실행 결과)
SELECT M.MENU_ID, M.LABEL, M.LABEL_JSON, M.MENU_LEVEL, M.MENU_SEQUENCE,
       M.EXTERNAL_URL, SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE (M.LABEL LIKE '%사용자조회%' OR M.LABEL_JSON LIKE '%사용자조회%'
    OR M.LABEL LIKE '%포탈관리%'  OR M.LABEL_JSON LIKE '%포탈관리%')
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

결과:
  AVdQhBc8AAl_i4eq | Portal Mgmt | {"ko_KR":"포탈관리","en_US":"Portal Mgmt"} | level 2 | seq 1 | 부모: u4GVTuZEkN6LJwAE (관리기능)
  96aIzNw92ZaD0AAB | User Search | {"ko_KR":"사용자조회","en_US":"User Search"} | level 3 | seq 0 | 부모: AVdQhBc8AAl_i4eq
  구 URL: /identity/user/userList.do → 신 URL: /admin/portal/user-search
*/

DECLARE @SYS_ID NVARCHAR(50);
DECLARE @WORKGROUP_ID NVARCHAR(50);
DECLARE @MENU_TYPE_CODE_ID NVARCHAR(50);

SELECT TOP 1 @SYS_ID = SYS_ID FROM TN_CF_SYS;
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';
SELECT TOP 1 @MENU_TYPE_CODE_ID = CODE_ID FROM TC_CF_COMM_CODE WHERE CODE_ID LIKE 'MENU_TYPE%' AND DELETE_YN = '0';

-- =============================================
-- 1. 포탈관리 2depth SYS_RESOURCE 등록
--    부모: PORTAL_MENU_ADMIN (신 DB 관리기능 트리)
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = 'AVdQhBc8AAl_i4eq')
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    ('AVdQhBc8AAl_i4eq', 'u4GVTuZEkN6LJwAE', @SYS_ID, '포탈관리', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin')
    PRINT 'AVdQhBc8AAl_i4eq (포탈관리) SYS_RESOURCE 등록'
END
ELSE PRINT 'AVdQhBc8AAl_i4eq SYS_RESOURCE 이미 존재 (부모: u4GVTuZEkN6LJwAE 관리기능)'

-- =============================================
-- 2. 포탈관리 2depth MENU 등록
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = 'AVdQhBc8AAl_i4eq')
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, MENU_USE_PERIOD_CODE, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    ('AVdQhBc8AAl_i4eq',
     '포탈관리',
     '{"ko_KR":"포탈관리","en_US":"Portal Mgmt"}',
     2, 2,
     '1', '0',
     @MENU_TYPE_CODE_ID, 'A',
     '0', NULL)
    PRINT 'AVdQhBc8AAl_i4eq (포탈관리) MENU 등록'
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL               = '포탈관리',
        LABEL_JSON          = '{"ko_KR":"포탈관리","en_US":"Portal Mgmt"}',
        MENU_SEQUENCE       = 2,
        MENU_LEVEL          = 2,
        USE_YN              = '1',
        DELETE_YN           = '0',
        MENU_USE_PERIOD_CODE = 'A',
        EXTERNAL_URL_USE_YN = '0',
        EXTERNAL_URL        = NULL
    WHERE MENU_ID = 'AVdQhBc8AAl_i4eq'
    PRINT 'AVdQhBc8AAl_i4eq (포탈관리) MENU 업데이트'
END

-- =============================================
-- 3. 사용자조회 3depth SYS_RESOURCE 등록
--    부모: AVdQhBc8AAl_i4eq (포탈관리)
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = '96aIzNw92ZaD0AAB')
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID, SYS_ID, SYS_RESOURCE_NAME, SYS_RESOURCE_TYPE_CODE_ID,
     DELETE_YN, FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    ('96aIzNw92ZaD0AAB', 'AVdQhBc8AAl_i4eq', @SYS_ID, '사용자조회', 'MENU',
     '0', GETDATE(), 'admin', GETDATE(), 'admin')
    PRINT '96aIzNw92ZaD0AAB (사용자조회) SYS_RESOURCE 등록'
END
ELSE
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = 'AVdQhBc8AAl_i4eq',
        LAST_MOD_DATETIME = GETDATE(), LAST_MODR_ID = 'admin'
    WHERE SYS_RESOURCE_ID = '96aIzNw92ZaD0AAB'
    PRINT '96aIzNw92ZaD0AAB SYS_RESOURCE 이미 존재 → 부모 보정'
END

-- =============================================
-- 4. 사용자조회 3depth MENU 등록
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = '96aIzNw92ZaD0AAB')
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, MENU_USE_PERIOD_CODE, EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    ('96aIzNw92ZaD0AAB',
     '사용자조회',
     '{"ko_KR":"사용자조회","en_US":"User Search"}',
     1, 3,
     '1', '0',
     @MENU_TYPE_CODE_ID, 'A',
     '0', '/admin/portal/user-search')
    PRINT '96aIzNw92ZaD0AAB (사용자조회) MENU 등록'
END
ELSE
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL               = '사용자조회',
        LABEL_JSON          = '{"ko_KR":"사용자조회","en_US":"User Search"}',
        MENU_SEQUENCE       = 1,
        MENU_LEVEL          = 3,
        USE_YN              = '1',
        DELETE_YN           = '0',
        MENU_USE_PERIOD_CODE = 'A',
        EXTERNAL_URL_USE_YN = '0',
        EXTERNAL_URL        = '/admin/portal/user-search'
    WHERE MENU_ID = '96aIzNw92ZaD0AAB'
    PRINT '96aIzNw92ZaD0AAB (사용자조회) MENU 업데이트'
END

-- =============================================
-- 5. testuser 권한 등록 — 포탈관리(부모) + 사용자조회(leaf) 모두
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_USER_AUTHORIZATION
               WHERE USER_ID = 'testuser' AND SYS_RESOURCE_ID = 'AVdQhBc8AAl_i4eq')
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID, FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, 'AVdQhBc8AAl_i4eq', 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin')
    PRINT 'AVdQhBc8AAl_i4eq (포탈관리) testuser 권한 등록'
END
ELSE PRINT 'AVdQhBc8AAl_i4eq testuser 권한 이미 존재'

IF NOT EXISTS (SELECT 1 FROM TN_CF_USER_AUTHORIZATION
               WHERE USER_ID = 'testuser' AND SYS_RESOURCE_ID = '96aIzNw92ZaD0AAB')
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID, FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, '96aIzNw92ZaD0AAB', 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin')
    PRINT '96aIzNw92ZaD0AAB (사용자조회) testuser 권한 등록'
END
ELSE PRINT '96aIzNw92ZaD0AAB testuser 권한 이미 존재'

-- =============================================
-- 6. 최종 확인
-- =============================================
SELECT M.MENU_ID, SR.UPPER_SYS_RESOURCE_ID AS 부모ID, M.LABEL,
       M.MENU_LEVEL, M.MENU_SEQUENCE, M.USE_YN, M.EXTERNAL_URL
FROM   TN_CF_MENU M
       JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE  M.MENU_ID IN ('AVdQhBc8AAl_i4eq', '96aIzNw92ZaD0AAB')
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;
