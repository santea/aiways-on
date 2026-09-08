-- ============================================================
-- VOC 관련 공통코드 이관
-- 구 DB(MOPORTAL_DEV) → 신 DB(SDL_DEV)
-- 대상: VOC_CATETC, VOC_CATSUB, VOC_APPLY, VOC_WIFI, VOC_STATUS (신 소스 실사용)
--       VOC_PROCEC, VOC_CATEGORY 는 신 소스 미사용 — 이관됐으나 화면/Mapper에서 참조 없음
-- ============================================================

-- STEP 0: 구 DB VOC 관련 코드 목록 확인 (구 DB에서 실행)
/*
SELECT COMM_CODE_TYPE_CODE, COUNT(*) AS cnt
FROM TC_CF_COMM_CODE
WHERE COMM_CODE_TYPE_CODE LIKE 'VOC%'
GROUP BY COMM_CODE_TYPE_CODE
ORDER BY COMM_CODE_TYPE_CODE;
*/

-- STEP 0-1: 신 DB 현재 상태 확인 (신 DB에서 실행)
/*
SELECT COMM_CODE_TYPE_CODE, COUNT(*) AS cnt
FROM TC_CF_COMM_CODE
WHERE COMM_CODE_TYPE_CODE LIKE 'VOC%'
  AND DELETE_YN = 0
GROUP BY COMM_CODE_TYPE_CODE
ORDER BY COMM_CODE_TYPE_CODE;
*/

-- ============================================================
-- STEP 1: TC_CF_COMM_CODE_TYPE — VOC 관련 코드타입 이관
-- ============================================================
INSERT INTO TC_CF_COMM_CODE_TYPE (
    COMM_CODE_TYPE_CODE, COMM_CODE_TYPE_NAME, DESCRIPTION,
    FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID,
    LABEL, LABEL_JSON, DELETE_YN, FROM_DATE, THRU_DATE
)
SELECT
    COMM_CODE_TYPE_CODE,
    ISNULL(KO_LABEL, COMM_CODE_TYPE_CODE),
    DESCRIPTION,
    FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID,
    ISNULL(EN_LABEL, ''),
    '{"ko_KR":"' + ISNULL(REPLACE(KO_LABEL, '"', ''), '') + '",'
    + '"en_US":"' + ISNULL(REPLACE(EN_LABEL, '"', ''), '') + '"}',
    CAST(ISNULL(DELETE_YN, '0') AS bit),
    FROM_DATE, THRU_DATE
FROM [MOPORTAL_DEV].[dbo].TC_CF_COMM_CODE_TYPE S
WHERE COMM_CODE_TYPE_CODE LIKE 'VOC%'
  AND NOT EXISTS (
    SELECT 1 FROM TC_CF_COMM_CODE_TYPE
    WHERE COMM_CODE_TYPE_CODE = S.COMM_CODE_TYPE_CODE
  );

-- ============================================================
-- STEP 2: TC_CF_COMM_CODE — VOC 관련 코드 이관
-- ============================================================

-- 2-1: 신 DB에 없는 코드만 신규 INSERT
INSERT INTO TC_CF_COMM_CODE (
    CODE_ID, CODE, UPPER_CODE_ID, DESCRIPTION,
    COMM_CODE_TYPE_CODE, HIERARCHY_LEVEL, ORD,
    FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID,
    LABEL, LABEL_JSON, DELETE_YN, FROM_DATE, THRU_DATE
)
SELECT
    CODE_ID, CODE, UPPER_CODE_ID, DESCRIPTION,
    COMM_CODE_TYPE_CODE, HIERARCHY_LEVEL, ORD,
    FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID,
    ISNULL(EN_LABEL, ''),
    '{"ko_KR":"' + ISNULL(REPLACE(KO_LABEL, '"', ''), '') + '",'
    + '"en_US":"' + ISNULL(REPLACE(EN_LABEL, '"', ''), '') + '"}',
    CAST(ISNULL(DELETE_YN, '0') AS bit),
    FROM_DATE, THRU_DATE
FROM [MOPORTAL_DEV].[dbo].TC_CF_COMM_CODE S
WHERE COMM_CODE_TYPE_CODE LIKE 'VOC%'
  AND ISNULL(S.DELETE_YN, '0') = '0'
  AND NOT EXISTS (
    SELECT 1 FROM TC_CF_COMM_CODE
    WHERE COMM_CODE_TYPE_CODE = S.COMM_CODE_TYPE_CODE
      AND CODE = S.CODE
  );

-- 2-2: 신 DB에 이미 있는 코드는 LABEL/LABEL_JSON 업데이트 (기존 내용이 불완전할 수 있으므로)
UPDATE T
SET T.LABEL      = ISNULL(S.EN_LABEL, ''),
    T.LABEL_JSON = '{"ko_KR":"' + ISNULL(REPLACE(S.KO_LABEL, '"', ''), '') + '",'
                 + '"en_US":"' + ISNULL(REPLACE(S.EN_LABEL, '"', ''), '') + '"}',
    T.ORD        = S.ORD,
    T.LAST_MOD_DATETIME = GETDATE(),
    T.LAST_MODR_ID      = 'admin'
FROM TC_CF_COMM_CODE T
JOIN [MOPORTAL_DEV].[dbo].TC_CF_COMM_CODE S
  ON T.COMM_CODE_TYPE_CODE = S.COMM_CODE_TYPE_CODE
 AND T.CODE = S.CODE
WHERE T.COMM_CODE_TYPE_CODE LIKE 'VOC%'
  AND ISNULL(S.DELETE_YN, '0') = '0';

-- ============================================================
-- 확인 쿼리
-- ============================================================
SELECT COMM_CODE_TYPE_CODE,
       CODE,
       JSON_VALUE(LABEL_JSON, '$.ko_KR') AS ko_label,
       ORD,
       DELETE_YN
FROM TC_CF_COMM_CODE
WHERE COMM_CODE_TYPE_CODE LIKE 'VOC%'
ORDER BY COMM_CODE_TYPE_CODE, ORD;
