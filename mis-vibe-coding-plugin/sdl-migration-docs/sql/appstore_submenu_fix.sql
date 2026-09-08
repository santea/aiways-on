-- =============================================
-- 앱스토어 서브메뉴 순서/위치 수정
-- 문제: 사용신청 관리와 사용자 조회가 다른 부모 아래 등록되어 있거나 순서가 반대
-- 수정: 둘 다 앱스토어(level 2) 하위 항목으로 통일하고 순서 정렬
-- 결과: 앱스토어 > 사용신청 관리(seq=1), 사용자 조회(seq=2)
-- =============================================

-- =============================================
-- STEP 0: 현재 앱스토어 서브메뉴 구조 확인 (실행 후 ID 검증)
-- =============================================
SELECT
    M.MENU_ID,
    M.LABEL,
    M.MENU_LEVEL,
    M.MENU_SEQUENCE,
    M.USE_YN,
    M.EXTERNAL_URL,
    SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.DELETE_YN = '0'
  AND (
      M.MENU_ID LIKE '%APP_STORE%'
      OR M.LABEL LIKE '%앱스토어%'
      OR M.LABEL LIKE '%App Store%'
      OR SR.UPPER_SYS_RESOURCE_ID IN (
          SELECT M2.MENU_ID FROM TN_CF_MENU M2
          JOIN TN_CF_SYS_RESOURCE SR2 ON M2.MENU_ID = SR2.SYS_RESOURCE_ID
          WHERE M2.DELETE_YN = '0'
            AND (M2.MENU_ID LIKE '%APP_STORE%'
                 OR M2.LABEL LIKE '%앱스토어%'
                 OR M2.LABEL LIKE '%App Store%')
      )
  )
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

-- =============================================
-- STEP 1: 메뉴 ID 동적 조회
-- =============================================
DECLARE @APP_STORE_ID  NVARCHAR(200);
DECLARE @APP_MGMT_ID   NVARCHAR(200);
DECLARE @USER_LIST_ID  NVARCHAR(200);

-- 앱스토어 1depth 메뉴 ID
SELECT TOP 1 @APP_STORE_ID = M.MENU_ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.DELETE_YN = '0'
  AND M.MENU_LEVEL = 1
  AND (M.MENU_ID LIKE '%APP_STORE%'
       OR M.LABEL LIKE '%앱스토어%'
       OR M.LABEL LIKE '%App Store%');

-- 사용신청 관리 (앱스토어 하위 level 2, URL /portal/apps)
SELECT TOP 1 @APP_MGMT_ID = M.MENU_ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.DELETE_YN = '0'
  AND SR.UPPER_SYS_RESOURCE_ID = @APP_STORE_ID
  AND M.EXTERNAL_URL = '/portal/apps';

-- 사용자 조회 (앱스토어 하위 level 2, URL /portal/users)
SELECT TOP 1 @USER_LIST_ID = M.MENU_ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.DELETE_YN = '0'
  AND SR.UPPER_SYS_RESOURCE_ID = @APP_STORE_ID
  AND M.EXTERNAL_URL = '/portal/users';

PRINT '앱스토어 ID   : ' + ISNULL(@APP_STORE_ID, 'NULL');
PRINT '사용신청 관리 ID: ' + ISNULL(@APP_MGMT_ID,  'NULL');
PRINT '사용자 조회 ID  : ' + ISNULL(@USER_LIST_ID, 'NULL');

IF @APP_STORE_ID IS NULL
BEGIN
    RAISERROR('앱스토어 메뉴를 찾을 수 없습니다. STEP 0 결과를 확인하세요.', 16, 1);
    RETURN;
END

IF @APP_MGMT_ID IS NULL
BEGIN
    RAISERROR('사용신청 관리 메뉴(URL=/portal/apps)를 찾을 수 없습니다. STEP 0 결과를 확인하세요.', 16, 1);
    RETURN;
END

IF @USER_LIST_ID IS NULL
BEGIN
    RAISERROR('사용자 조회 메뉴(URL=/portal/users, 앱스토어 하위)를 찾을 수 없습니다. STEP 0 결과를 확인하세요.', 16, 1);
    RETURN;
END

-- =============================================
-- STEP 2: 둘 다 앱스토어 하위 level 2로 통일하고 순서 설정
-- =============================================

-- 사용신청 관리: level 2, seq=1, 부모=앱스토어
UPDATE TN_CF_MENU
SET MENU_LEVEL    = 2,
    MENU_SEQUENCE = 1
WHERE MENU_ID = @APP_MGMT_ID;
PRINT '사용신청 관리 → level 2, seq=1: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

UPDATE TN_CF_SYS_RESOURCE
SET UPPER_SYS_RESOURCE_ID = @APP_STORE_ID
WHERE SYS_RESOURCE_ID = @APP_MGMT_ID;
PRINT '사용신청 관리 부모 → 앱스토어: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- 사용자 조회: level 2, seq=2, 부모=앱스토어
UPDATE TN_CF_MENU
SET MENU_LEVEL    = 2,
    MENU_SEQUENCE = 2
WHERE MENU_ID = @USER_LIST_ID;
PRINT '사용자 조회 → level 2, seq=2: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

UPDATE TN_CF_SYS_RESOURCE
SET UPPER_SYS_RESOURCE_ID = @APP_STORE_ID
WHERE SYS_RESOURCE_ID = @USER_LIST_ID;
PRINT '사용자 조회 부모 → 앱스토어: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- STEP 4: 결과 확인
-- =============================================
SELECT
    M.MENU_ID,
    M.LABEL,
    M.MENU_LEVEL,
    M.MENU_SEQUENCE,
    M.EXTERNAL_URL,
    SR.UPPER_SYS_RESOURCE_ID AS 부모ID,
    CASE SR.UPPER_SYS_RESOURCE_ID
        WHEN @APP_STORE_ID THEN '앱스토어'
        WHEN @APP_MGMT_ID  THEN '사용신청 관리'
        ELSE SR.UPPER_SYS_RESOURCE_ID
    END AS 부모명
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE M.DELETE_YN = '0'
  AND (M.MENU_ID = @APP_STORE_ID
    OR SR.UPPER_SYS_RESOURCE_ID = @APP_STORE_ID
    OR SR.UPPER_SYS_RESOURCE_ID = @APP_MGMT_ID)
ORDER BY M.MENU_LEVEL, M.MENU_SEQUENCE;

PRINT '완료. 앱스토어 드롭다운 구조:';
PRINT '  앱스토어';
PRINT '    DS Mobile 사용신청 관리';
PRINT '    DS Mobile 사용자 조회';
