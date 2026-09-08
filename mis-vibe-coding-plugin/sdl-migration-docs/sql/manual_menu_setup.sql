-- =============================================
-- 공지사항 > 모바일 관리 매뉴얼 메뉴 DB 등록
-- 구 DB MENU_ID (직원용):  AUJfx7gMA_IeI3DO (이미 신규 DB에 존재)
-- 구 DB MENU_ID (협력직용): AU-wTujM1TgeI28L (이미 신규 DB에 존재)
-- 부모 ID: AVdQepvcAAB_i4eq (공지사항 그룹)
-- =============================================

/* STEP 0: 구 DB 조회 쿼리 (참고용)
SELECT
    M.MENU_ID, M.LABEL, M.LABEL_JSON, M.MENU_LEVEL, M.MENU_SEQUENCE,
    M.EXTERNAL_URL, SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.LABEL_JSON LIKE '%manual%' OR M.LABEL_JSON LIKE '%Manual%' OR M.LABEL LIKE '%매뉴얼%'
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

-- 결과:
-- AUJfx7gMA_IeI3DO | 모바일 관리 매뉴얼     | Level 2 Seq 1 | 부모: AVdQepvcAAB_i4eq
-- AU-wTujM1TgeI28L | 파트너 모바일 관리 매뉴얼 | Level 2 Seq 4 | 부모: AVdQepvcAAB_i4eq
*/

-- =============================================
-- 0. 신규 DB에서 해당 메뉴 존재 여부 확인
-- =============================================
SELECT M.MENU_ID, SR.UPPER_SYS_RESOURCE_ID AS 부모ID,
       M.LABEL, M.MENU_LEVEL, M.MENU_SEQUENCE, M.USE_YN, M.EXTERNAL_URL
FROM   TN_CF_MENU M
       JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE  M.MENU_ID IN ('AUJfx7gMA_IeI3DO', 'AU-wTujM1TgeI28L');

DECLARE @WORKGROUP_ID NVARCHAR(50);
SELECT @WORKGROUP_ID = WORKGROUP_ID FROM TN_CF_WORKGROUP WHERE WORKGROUP_NAME = 'USER_AUTH_MENU';

-- =============================================
-- 1-A. TN_CF_MENU URL 업데이트 — 직원용 모바일 관리 매뉴얼
--      변경: /sdpboard/sdpBoardCommuListUser.do?bbsId=manual → /portal/manuals
-- =============================================
UPDATE TN_CF_MENU
SET LABEL               = '모바일 관리 매뉴얼',
    LABEL_JSON          = '{"ko_KR":"모바일 관리 매뉴얼","en_US":"Manual"}',
    EXTERNAL_URL        = '/portal/manuals/N',
    EXTERNAL_URL_USE_YN = '0',
    USE_YN              = '1',
    DELETE_YN           = '0'
WHERE MENU_ID = 'AUJfx7gMA_IeI3DO';
PRINT 'AUJfx7gMA_IeI3DO MENU 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 1-B. TN_CF_MENU URL 업데이트 — 협력직용 파트너 모바일 관리 매뉴얼
--      변경: /sdpboard/sdpBoardCommuListUser.do?bbsId=partner_manual → /portal/manuals
-- =============================================
UPDATE TN_CF_MENU
SET LABEL               = '파트너 모바일 관리 매뉴얼',
    LABEL_JSON          = '{"ko_KR":"파트너 모바일 관리 매뉴얼","en_US":"Partner Manual"}',
    EXTERNAL_URL        = '/portal/manuals/P',
    EXTERNAL_URL_USE_YN = '0',
    USE_YN              = '1',
    DELETE_YN           = '0'
WHERE MENU_ID = 'AU-wTujM1TgeI28L';
PRINT 'AU-wTujM1TgeI28L MENU 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 2. testuser 권한 등록 — 직원용
-- =============================================
IF NOT EXISTS (
    SELECT 1 FROM TN_CF_USER_AUTHORIZATION
    WHERE USER_ID = 'testuser' AND SYS_RESOURCE_ID = 'AUJfx7gMA_IeI3DO'
)
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID, FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, 'AUJfx7gMA_IeI3DO', 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT 'testuser 권한 등록 완료 (직원용)';
END
ELSE PRINT 'testuser 권한 이미 존재 (직원용)';

-- =============================================
-- 3. testuser 권한 등록 — 협력직용
-- =============================================
IF NOT EXISTS (
    SELECT 1 FROM TN_CF_USER_AUTHORIZATION
    WHERE USER_ID = 'testuser' AND SYS_RESOURCE_ID = 'AU-wTujM1TgeI28L'
)
BEGIN
    INSERT INTO TN_CF_USER_AUTHORIZATION
    (WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID, USER_ID, FROM_DATE, THRU_DATE,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    (@WORKGROUP_ID, 'AU-wTujM1TgeI28L', 'READ', 'testuser',
     CONVERT(VARCHAR(8), GETDATE(), 112), '99991231',
     GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT 'testuser 권한 등록 완료 (협력직용)';
END
ELSE PRINT 'testuser 권한 이미 존재 (협력직용)';

-- =============================================
-- 4. 확인
-- =============================================
SELECT M.MENU_ID, SR.UPPER_SYS_RESOURCE_ID AS 부모ID,
       M.LABEL, M.MENU_LEVEL, M.MENU_SEQUENCE, M.USE_YN, M.EXTERNAL_URL
FROM   TN_CF_MENU M
       JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE  SR.UPPER_SYS_RESOURCE_ID = 'AVdQepvcAAB_i4eq'
ORDER BY M.MENU_SEQUENCE;

SELECT SYS_RESOURCE_ID, USER_ID, AUTHORIZATION_ID, FROM_DATE, THRU_DATE
FROM   TN_CF_USER_AUTHORIZATION
WHERE  USER_ID = 'testuser'
  AND  SYS_RESOURCE_ID IN ('AUJfx7gMA_IeI3DO', 'AU-wTujM1TgeI28L');
