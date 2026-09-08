-- ============================================================
-- VOC 메뉴 DB 등록
-- 변경: 구 소스 /portal/vocmgmt/listUserVocs.do → /portal/mypage/voc
-- ============================================================

/* STEP 0: 구 DB에서 VOC 메뉴 MENU_ID 조회 결과 (2026-06-05 확인)
AVdQZM0sAAB_i8l4    VOC    {"ko_KR":"VOC","en_US":"VOC"}    2    3    /portal/vocmgmt/listUserVocs.do    AUH8d6ocABM0TZdR
AVdQa6R8AAF_i8l4    VOC Management    {"ko_KR":"VOC 관리","en_US":"VOC Management"}    3    6    /portal/vocmgmt/listPortalVocs.do    ATmO2iDaAABlLkFf
AZU_92faAAGm_DjQ    VOC Management(S3)    {"ko_KR":"VOC 관리(S3)","en_US":"VOC Management(S3)"}    3    9    /api/vocmgmt/listPortalVocs.do    ATmO2iDaAABlLkFf
AUMJ2KYMAEseI2_7    VOC MANAGE    {"ko_KR":"VOC 관리","en_US":"VOC MANAGE"}    4    0    /portal/voc/listPortalVocs.do    AUMJ1tl8AEoeI2_7

결론:
  - 7단계 MY PAGE > VOC(사용자): AVdQZM0sAAB_i8l4 (부모: AUH8d6ocABM0TZdR = MY PAGE)
  - 47단계 관리기능 > VOC 관리(S3): AZU_92faAAGm_DjQ (부모: ATmO2iDaAABlLkFf = 포탈컨텐츠관리)
*/

/* STEP 0.5: 신 DB 사전 확인 (실행 후 PORTAL_MENU_VOC 존재 여부 확인)
SELECT MENU_ID, LABEL, LABEL_JSON, EXTERNAL_URL
FROM TN_CF_MENU
WHERE MENU_ID LIKE 'PORTAL_MENU_VOC%' OR MENU_ID = 'AVdQZM0sAAB_i8l4';

SELECT SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID
FROM TN_CF_SYS_RESOURCE
WHERE SYS_RESOURCE_ID IN ('AVdQZM0sAAB_i8l4', 'PORTAL_MENU_VOC', 'AUH8d6ocABM0TZdR');
*/

-- ============================================================
-- 변수 설정 (구 DB 조회 결과로 확정)
-- ============================================================
DECLARE @VOC_MENU_ID     NVARCHAR(50) = 'AVdQZM0sAAB_i8l4';  -- MY PAGE > VOC (사용자)
DECLARE @PARENT_MENU_ID  NVARCHAR(50) = 'AUH8d6ocABM0TZdR';  -- MY PAGE 부모 ID
DECLARE @PORTAL_MENU_ID  NVARCHAR(50) = 'PORTAL_MENU_VOC';   -- 신 DB 임시 ID (존재 시 교체, 없으면 STEP 3 스킵)

-- ============================================================
-- STEP 1: TN_CF_MENU — VOC 메뉴 덮어쓰기
-- ============================================================
-- 기존 AVdQZM0sAAB_i8l4 레코드가 있으면 UPDATE, 없으면 INSERT
IF EXISTS (SELECT 1 FROM TN_CF_MENU WHERE MENU_ID = @VOC_MENU_ID)
BEGIN
    UPDATE TN_CF_MENU
    SET LABEL             = 'VOC',
        LABEL_JSON        = '{"ko_KR":"VOC","en_US":"VOC"}',
        MENU_SEQUENCE     = 3,
        MENU_LEVEL        = 2,
        USE_YN            = '1',
        DELETE_YN         = '0',
        MENU_TYPE_CODE_ID = 'ATMQ58N6AABlL532',
        MENU_USE_PERIOD_CODE = 'A',
        EXTERNAL_URL_USE_YN  = '0',
        EXTERNAL_URL      = '/portal/mypage/voc'
    WHERE MENU_ID = @VOC_MENU_ID;
END
ELSE
BEGIN
    INSERT INTO TN_CF_MENU
    (MENU_ID, LABEL, LABEL_JSON, MENU_SEQUENCE, MENU_LEVEL,
     USE_YN, DELETE_YN, MENU_TYPE_CODE_ID, MENU_USE_PERIOD_CODE,
     EXTERNAL_URL_USE_YN, EXTERNAL_URL)
    VALUES
    (@VOC_MENU_ID, 'VOC', '{"ko_KR":"VOC","en_US":"VOC"}', 3, 2,
     '1', '0', 'ATMQ58N6AABlL532', 'A',
     '0', '/portal/mypage/voc');
END

-- ============================================================
-- STEP 2: TN_CF_SYS_RESOURCE — 부모를 MY PAGE(AUH8d6ocABM0TZdR)로 연결
-- ============================================================
IF EXISTS (SELECT 1 FROM TN_CF_SYS_RESOURCE WHERE SYS_RESOURCE_ID = @VOC_MENU_ID)
BEGIN
    UPDATE TN_CF_SYS_RESOURCE
    SET UPPER_SYS_RESOURCE_ID = @PARENT_MENU_ID,
        LAST_MOD_DATETIME     = GETDATE(),
        LAST_MODR_ID          = 'admin'
    WHERE SYS_RESOURCE_ID = @VOC_MENU_ID;
END
ELSE
BEGIN
    INSERT INTO TN_CF_SYS_RESOURCE
    (SYS_RESOURCE_ID, UPPER_SYS_RESOURCE_ID,
     LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@VOC_MENU_ID, @PARENT_MENU_ID,
     GETDATE(), 'admin');
END

-- PORTAL_MENU_VOC 하위 자식이 있으면 부모를 신규 ID로 변경
UPDATE TN_CF_SYS_RESOURCE
SET UPPER_SYS_RESOURCE_ID = @VOC_MENU_ID,
    LAST_MOD_DATETIME     = GETDATE(),
    LAST_MODR_ID          = 'admin'
WHERE UPPER_SYS_RESOURCE_ID = @PORTAL_MENU_ID;

-- 권한 이전
UPDATE TN_CF_USER_AUTHORIZATION
SET SYS_RESOURCE_ID   = @VOC_MENU_ID,
    LAST_MOD_DATETIME = GETDATE(),
    LAST_MODR_ID      = 'admin'
WHERE SYS_RESOURCE_ID = @PORTAL_MENU_ID;

-- ============================================================
-- STEP 3: 기존 PORTAL_MENU_VOC 삭제 (존재할 경우만)
-- ============================================================
DELETE FROM TN_CF_USER_AUTHORIZATION WHERE SYS_RESOURCE_ID = @PORTAL_MENU_ID;
DELETE FROM TN_CF_MENU              WHERE MENU_ID          = @PORTAL_MENU_ID;
DELETE FROM TN_CF_SYS_RESOURCE      WHERE SYS_RESOURCE_ID  = @PORTAL_MENU_ID;

-- ============================================================
-- STEP 4: testuser 권한 등록
-- ============================================================
DECLARE @WORKGROUP_ID NVARCHAR(50);
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';

-- 중복 방지
IF NOT EXISTS (
    SELECT 1 FROM TN_CF_USER_AUTHORIZATION
    WHERE SYS_RESOURCE_ID = @VOC_MENU_ID AND USER_ID = 'testuser'
)
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID, FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, @VOC_MENU_ID, 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin');
END

-- ============================================================
-- 확인 쿼리
-- ============================================================
SELECT M.MENU_ID, M.LABEL, M.MENU_LEVEL, M.MENU_SEQUENCE, M.EXTERNAL_URL,
       SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.MENU_ID = 'AVdQZM0sAAB_i8l4';
