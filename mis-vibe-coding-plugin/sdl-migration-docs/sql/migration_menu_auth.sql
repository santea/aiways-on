-- =============================================
-- 메뉴/권한 데이터 마이그레이션 SQL
-- 구 DB → 신 DB (같은 서버인 경우: [구DB명].[dbo].테이블명 형식으로 교체)
-- 실행 순서: SYS_RESOURCE → MENU → WORKGROUP → WORKGROUP_ROLE → WORK_AUTHORIZATION → USER_AUTHORIZATION
-- =============================================

-- ※ 실행 전 신 DB 더미 데이터 정리
-- DELETE FROM TN_CF_USER_AUTHORIZATION WHERE FIRST_REGR_ID = 'admin';
-- DELETE FROM TN_CF_WORK_AUTHORIZATION  WHERE FIRST_REGR_ID = 'admin';
-- DELETE FROM TN_CF_WORKGROUP_ROLE      WHERE FIRST_REGR_ID = 'admin';
-- DELETE FROM TN_CF_WORKGROUP           WHERE FIRST_REGR_ID = 'admin';
-- DELETE FROM TN_CF_MENU                WHERE MENU_ID LIKE 'PORTAL_MENU%';
-- DELETE FROM TN_CF_SYS_RESOURCE        WHERE SYS_RESOURCE_ID LIKE 'PORTAL_MENU%';

-- =============================================
-- 1. TN_CF_SYS_RESOURCE 마이그레이션 (동일 구조)
--    ※ UPPER_SYS_RESOURCE_ID → SYS_RESOURCE_ID 자기참조 FK이므로
--      일괄 INSERT 시 부모/자식 순서 보장 불가 → 제약 조건 일시 해제
-- =============================================
ALTER TABLE TN_CF_SYS_RESOURCE NOCHECK CONSTRAINT FK_CF_SYS_RESOURCE_03;

INSERT INTO TN_CF_SYS_RESOURCE (
    SYS_RESOURCE_ID,
    UPPER_SYS_RESOURCE_ID,
    SYS_ID,
    SYS_RESOURCE_NAME,
    SYS_RESOURCE_TYPE_CODE_ID,
    DELETE_YN,
    FIRST_REG_DATETIME,
    FIRST_REGR_ID,
    LAST_MOD_DATETIME,
    LAST_MODR_ID
)
SELECT
    SYS_RESOURCE_ID,
    UPPER_SYS_RESOURCE_ID,
    SYS_ID,
    SYS_RESOURCE_NAME,
    SYS_RESOURCE_TYPE_CODE_ID,
    ISNULL(DELETE_YN, '0'),
    ISNULL(FIRST_REG_DATETIME, GETDATE()),
    ISNULL(FIRST_REGR_ID, 'migration'),
    ISNULL(LAST_MOD_DATETIME, GETDATE()),
    ISNULL(LAST_MODR_ID, 'migration')
FROM [구DB명].[dbo].TN_CF_SYS_RESOURCE src
WHERE ISNULL(DELETE_YN, '0') = '0'
  AND NOT EXISTS (
    SELECT 1 FROM TN_CF_SYS_RESOURCE tgt
    WHERE tgt.SYS_RESOURCE_ID = src.SYS_RESOURCE_ID
);

PRINT 'TN_CF_SYS_RESOURCE 완료: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

ALTER TABLE TN_CF_SYS_RESOURCE WITH NOCHECK CHECK CONSTRAINT FK_CF_SYS_RESOURCE_03;

-- =============================================
-- 2. TN_CF_MENU 마이그레이션
--    구: KO_LABEL + EN_LABEL → LABEL_JSON 합성
--    구: MENU_URL → EXTERNAL_URL
-- =============================================
INSERT INTO TN_CF_MENU (
    MENU_ID,
    LABEL,
    LABEL_JSON,
    MENU_SEQUENCE,
    MENU_LEVEL,
    USE_YN,
    DELETE_YN,
    MENU_TYPE_CODE_ID,
    EXTERNAL_URL_USE_YN,
    EXTERNAL_URL
)
SELECT
    MENU_ID,
    ISNULL(LABEL, ISNULL(KO_LABEL, '')),
    CASE
        WHEN KO_LABEL IS NOT NULL OR EN_LABEL IS NOT NULL
        THEN '{"ko_KR":"' + ISNULL(REPLACE(KO_LABEL, '"', '\\"'), '')
             + '","en_US":"' + ISNULL(REPLACE(EN_LABEL, '"', '\\"'), '') + '"}'
        ELSE NULL
    END,
    ISNULL(MENU_SEQUENCE, 0),
    ISNULL(MENU_LEVEL, 1),
    ISNULL(USE_YN, '1'),
    ISNULL(DELETE_YN, '0'),
    MENU_TYPE_CODE_ID,
    '0',
    MENU_URL
FROM [구DB명].[dbo].TN_CF_MENU src
WHERE ISNULL(DELETE_YN, '0') = '0'
  AND NOT EXISTS (
    SELECT 1 FROM TN_CF_MENU tgt
    WHERE tgt.MENU_ID = src.MENU_ID
);

PRINT 'TN_CF_MENU 완료: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 3. TN_CF_WORKGROUP 마이그레이션
--    구: TN_CF_WORK_GROUP (WORK_GROUP_ID, WORK_GROUP_NAME)
--    신: TN_CF_WORKGROUP  (WORKGROUP_ID,  WORKGROUP_NAME)
-- =============================================
INSERT INTO TN_CF_WORKGROUP (
    WORKGROUP_ID,
    WORKGROUP_NAME,
    DESCRIPTION,
    LABEL,
    LABEL_JSON,
    DELETE_YN,
    FIRST_REG_DATETIME,
    FIRST_REGR_ID,
    LAST_MOD_DATETIME,
    LAST_MODR_ID
)
SELECT
    WORK_GROUP_ID,
    WORK_GROUP_NAME,
    DESCRIPTION,
    -- 구에 KO_LABEL/EN_LABEL 있으면 LABEL로 사용
    ISNULL(LABEL, ISNULL(KO_LABEL, WORK_GROUP_NAME)),
    CASE
        WHEN KO_LABEL IS NOT NULL OR EN_LABEL IS NOT NULL
        THEN '{"ko_KR":"' + ISNULL(REPLACE(KO_LABEL, '"', '\\"'), '')
             + '","en_US":"' + ISNULL(REPLACE(EN_LABEL, '"', '\\"'), '') + '"}'
        ELSE NULL
    END,
    ISNULL(DELETE_YN, '0'),
    ISNULL(FIRST_REG_DATETIME, GETDATE()),
    ISNULL(FIRST_REGR_ID, 'migration'),
    ISNULL(LAST_MOD_DATETIME, GETDATE()),
    ISNULL(LAST_MODR_ID, 'migration')
FROM [구DB명].[dbo].TN_CF_WORK_GROUP src
WHERE ISNULL(DELETE_YN, '0') = '0'
  AND NOT EXISTS (
    SELECT 1 FROM TN_CF_WORKGROUP tgt
    WHERE tgt.WORKGROUP_ID = src.WORK_GROUP_ID
);

PRINT 'TN_CF_WORKGROUP 완료: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 4. TN_CF_WORKGROUP_ROLE 마이그레이션
--    구: TN_CF_WORK_GROUP_ROLE (WORK_GROUP_ID, USER_ROLE_ID, ROLE_ID, USER_ID)
--    신: TN_CF_WORKGROUP_ROLE  (WORKGROUP_ID,  USER_ROLE_ID, ROLE_ID, USER_ID)
--    ※ 신규에 존재하는 WORKGROUP만 이관 (구 DB에 삭제된 WORKGROUP 참조 행 제외)
-- =============================================
INSERT INTO TN_CF_WORKGROUP_ROLE (
    WORKGROUP_ID,
    USER_ROLE_ID,
    FROM_DATE,
    THRU_DATE,
    ROLE_ID,
    USER_ID,
    FIRST_REG_DATETIME,
    FIRST_REGR_ID,
    LAST_MOD_DATETIME,
    LAST_MODR_ID
)
SELECT
    WORK_GROUP_ID,
    USER_ROLE_ID,
    ISNULL(FROM_DATE, CONVERT(VARCHAR(8), GETDATE(), 112)),
    ISNULL(THRU_DATE, '99991231'),
    ROLE_ID,
    USER_ID,
    ISNULL(FIRST_REG_DATETIME, GETDATE()),
    ISNULL(FIRST_REGR_ID, 'migration'),
    ISNULL(LAST_MOD_DATETIME, GETDATE()),
    ISNULL(LAST_MODR_ID, 'migration')
FROM [구DB명].[dbo].TN_CF_WORK_GROUP_ROLE src
WHERE EXISTS (
    SELECT 1 FROM TN_CF_WORKGROUP wg
    WHERE wg.WORKGROUP_ID = src.WORK_GROUP_ID
)
AND EXISTS (
    SELECT 1 FROM TN_CF_ROLE r
    WHERE r.ROLE_ID = src.ROLE_ID
)
AND NOT EXISTS (
    SELECT 1 FROM TN_CF_WORKGROUP_ROLE tgt
    WHERE tgt.WORKGROUP_ID = src.WORK_GROUP_ID
      AND tgt.USER_ROLE_ID = src.USER_ROLE_ID
);

PRINT 'TN_CF_WORKGROUP_ROLE 완료: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 5. TN_CF_WORK_AUTHORIZATION 마이그레이션
--    구: TN_CF_WORK_AUTHORIZATION (WORK_GROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID)
--    신: TN_CF_WORK_AUTHORIZATION (WORKGROUP_ID,  SYS_RESOURCE_ID, AUTHORIZATION_ID)
--    ※ 신규에 존재하는 SYS_RESOURCE만 이관
-- =============================================
INSERT INTO TN_CF_WORK_AUTHORIZATION (
    WORKGROUP_ID,
    SYS_RESOURCE_ID,
    AUTHORIZATION_ID,
    FIRST_REG_DATETIME,
    FIRST_REGR_ID,
    LAST_MOD_DATETIME,
    LAST_MODR_ID
)
SELECT
    WORK_GROUP_ID,
    SYS_RESOURCE_ID,
    AUTHORIZATION_ID,
    ISNULL(FIRST_REG_DATETIME, GETDATE()),
    ISNULL(FIRST_REGR_ID, 'migration'),
    ISNULL(LAST_MOD_DATETIME, GETDATE()),
    ISNULL(LAST_MODR_ID, 'migration')
FROM [구DB명].[dbo].TN_CF_WORK_AUTHORIZATION src
WHERE EXISTS (
    SELECT 1 FROM TN_CF_SYS_RESOURCE sr
    WHERE sr.SYS_RESOURCE_ID = src.SYS_RESOURCE_ID
)
AND EXISTS (
    SELECT 1 FROM TN_CF_WORKGROUP wg
    WHERE wg.WORKGROUP_ID = src.WORK_GROUP_ID
)
AND NOT EXISTS (
    SELECT 1 FROM TN_CF_WORK_AUTHORIZATION tgt
    WHERE tgt.WORKGROUP_ID    = src.WORK_GROUP_ID
      AND tgt.SYS_RESOURCE_ID = src.SYS_RESOURCE_ID
      AND tgt.AUTHORIZATION_ID = src.AUTHORIZATION_ID
);

PRINT 'TN_CF_WORK_AUTHORIZATION 완료: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 6. TN_CF_USER_AUTHORIZATION 마이그레이션
--    구: TN_CF_SYS_AUTHORIZATION (SYS_RESOURCE_ID, AUTHORIZATION_ID) — USER_ID 없음
--    신: TN_CF_USER_AUTHORIZATION (USER_ID, WORKGROUP_ID, SYS_RESOURCE_ID, AUTHORIZATION_ID)
--    → WORKGROUP_ROLE을 통해 USER_ID + WORKGROUP_ID 조합 생성
-- =============================================
INSERT INTO TN_CF_USER_AUTHORIZATION (
    WORKGROUP_ID,
    SYS_RESOURCE_ID,
    AUTHORIZATION_ID,
    USER_ID,
    FROM_DATE,
    THRU_DATE,
    FIRST_REG_DATETIME,
    FIRST_REGR_ID,
    LAST_MOD_DATETIME,
    LAST_MODR_ID
)
SELECT DISTINCT
    WGR.WORK_GROUP_ID,
    SA.SYS_RESOURCE_ID,
    SA.AUTHORIZATION_ID,
    WGR.USER_ID,
    ISNULL(SA.FROM_DATE, CONVERT(VARCHAR(8), GETDATE(), 112)),
    ISNULL(SA.THRU_DATE, '99991231'),
    ISNULL(SA.FIRST_REG_DATETIME, GETDATE()),
    ISNULL(SA.FIRST_REGR_ID, 'migration'),
    ISNULL(SA.LAST_MOD_DATETIME, GETDATE()),
    ISNULL(SA.LAST_MODR_ID, 'migration')
FROM [구DB명].[dbo].TN_CF_SYS_AUTHORIZATION SA
JOIN [구DB명].[dbo].TN_CF_WORK_GROUP_ROLE WGR
    ON WGR.WORK_GROUP_ID = (
        SELECT TOP 1 WORK_GROUP_ID
        FROM [구DB명].[dbo].TN_CF_WORK_AUTHORIZATION
        WHERE SYS_RESOURCE_ID = SA.SYS_RESOURCE_ID
          AND AUTHORIZATION_ID = SA.AUTHORIZATION_ID
    )
WHERE EXISTS (
    SELECT 1 FROM TN_CF_SYS_RESOURCE sr
    WHERE sr.SYS_RESOURCE_ID = SA.SYS_RESOURCE_ID
)
AND NOT EXISTS (
    SELECT 1 FROM TN_CF_USER_AUTHORIZATION tgt
    WHERE tgt.USER_ID         = WGR.USER_ID
      AND tgt.WORKGROUP_ID    = WGR.WORK_GROUP_ID
      AND tgt.SYS_RESOURCE_ID = SA.SYS_RESOURCE_ID
);

PRINT 'TN_CF_USER_AUTHORIZATION 완료: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 7. LABEL_JSON 키 정규화 ({"ko":"...","en":"..."} → {"ko_KR":"...","en_US":"..."})
--    이미 이관된 데이터에 구 형식 키가 있는 경우 실행
--    SDL SDLLocale mixin이 locale 키(ko_KR, en_US)로 직접 접근하므로 통일 필요
-- =============================================

-- 대상 확인 (실행 전 건수 확인용)
-- SELECT COUNT(*) FROM TN_CF_MENU
-- WHERE LABEL_JSON LIKE '%"ko":%' AND LABEL_JSON NOT LIKE '%"ko_KR":%';

UPDATE TN_CF_MENU
SET LABEL_JSON = (
    -- "ko" → "ko_KR", "en" → "en_US" 치환
    -- 순서: en_US 먼저 치환 후 ko_KR 치환 (부분 문자열 중복 방지)
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(LABEL_JSON, '"en":', '"en_US":'),
                '"ko":', '"ko_KR":'
            ),
            -- 혹시 이미 en_US가 있는데 en도 있는 경우 중복 제거 방지용 역치환은 불필요
            -- (정상 데이터엔 ko/en 중 하나만 존재)
            '"en_US_US":', '"en_US":'  -- 이중 치환 방어
        ),
        '"ko_KR_KR":', '"ko_KR":'      -- 이중 치환 방어
    )
)
WHERE LABEL_JSON LIKE '%"ko":%'
   OR LABEL_JSON LIKE '%"en":%';

PRINT 'LABEL_JSON 정규화 완료 (TN_CF_MENU): ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- TN_CF_WORKGROUP도 동일하게 정규화
UPDATE TN_CF_WORKGROUP
SET LABEL_JSON = (
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(LABEL_JSON, '"en":', '"en_US":'),
                '"ko":', '"ko_KR":'
            ),
            '"en_US_US":', '"en_US":'
        ),
        '"ko_KR_KR":', '"ko_KR":'
    )
)
WHERE LABEL_JSON LIKE '%"ko":%'
   OR LABEL_JSON LIKE '%"en":%';

PRINT 'LABEL_JSON 정규화 완료 (TN_CF_WORKGROUP): ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 8. 검증 쿼리
-- =============================================
SELECT 'TN_CF_SYS_RESOURCE'       AS 테이블명, COUNT(*) AS 건수 FROM TN_CF_SYS_RESOURCE  WHERE DELETE_YN = '0'
UNION ALL
SELECT 'TN_CF_MENU',               COUNT(*) FROM TN_CF_MENU               WHERE DELETE_YN = '0'
UNION ALL
SELECT 'TN_CF_WORKGROUP',          COUNT(*) FROM TN_CF_WORKGROUP           WHERE DELETE_YN = '0'
UNION ALL
SELECT 'TN_CF_WORKGROUP_ROLE',     COUNT(*) FROM TN_CF_WORKGROUP_ROLE
UNION ALL
SELECT 'TN_CF_WORK_AUTHORIZATION', COUNT(*) FROM TN_CF_WORK_AUTHORIZATION
UNION ALL
SELECT 'TN_CF_USER_AUTHORIZATION', COUNT(*) FROM TN_CF_USER_AUTHORIZATION;
