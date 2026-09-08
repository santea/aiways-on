-- ============================================================
-- 모바일 관리 매뉴얼 데이터 이관 SQL
-- 구 DB: MOPORTAL_DEV (TN_CF_SDPCOMMU, BBS_ID='manual' / 'partner_manual')
-- 신 DB: SDL_DEV      (TN_CF_POST, BOARD_ID='MANUAL')
-- ============================================================
-- [컬럼 매핑 요약]
-- COMMU_ID          → POST_ID
-- COMMU_TITLE       → POST_TITLE
-- COMMU_DETAIL      → POST_DETAIL (HTML 엔티티 디코딩 적용)
-- UPPER_COMMU_ID    → UPPER_POST_ID
-- HIERARCHY_LEVEL   → HIERARCHY_LEVEL (그대로)
-- REPLY_PRIORITY    → REPLY_SEQUENCE (그대로)
-- BBS_ID='manual'         → BOARD_ID='MANUAL', EMP_TYPE='N' (직원용)
-- BBS_ID='partner_manual' → BOARD_ID='MANUAL', EMP_TYPE='P' (협력직용)
-- DELETE_YN nvarchar('N'=미삭제,'Y'=삭제) → bit (0/1)
-- USE_YN: 신 DB NOT NULL — 기본값 'Y' 적용
-- NOTICE_POPUP_YN, NOTICE_LABEL_YN: bit NOT NULL — 0 적용
-- ============================================================
-- [샘플 데이터 확인 결과]
-- 구 DB COMMU_DETAIL: HTML 엔티티 인코딩 상태 (&lt; &gt; &amp; 등)
--   → REPLACE로 디코딩 후 이관 (v-html 렌더링 시 정상 표시 위해)
-- REPLY_PRIORITY: 실제 값(1 등) 존재 — ISNULL로 0 대체하지 않고 그대로 사용
-- ============================================================

-- STEP 0: 이관 전 건수 확인
/*
-- 구 DB에서 실행
SELECT BBS_ID, COUNT(*) AS 건수
FROM [MOPORTAL_DEV].[dbo].[TN_CF_SDPCOMMU]
WHERE BBS_ID IN ('manual', 'partner_manual')
GROUP BY BBS_ID;
-- 예상: manual=129, partner_manual=27

-- 신 DB에서 실행
SELECT COUNT(*) AS 기존건수 FROM TN_CF_POST WHERE BOARD_ID = 'MANUAL';
-- 예상: 0
*/

BEGIN TRANSACTION;

-- =============================================
-- STEP 1. TN_CF_BOARD 게시판 정의 등록
--         NOTICE 게시판 정의 참조하여 MANUAL 게시판 추가
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_BOARD WHERE BOARD_ID = 'MANUAL')
BEGIN
    INSERT INTO TN_CF_BOARD (
        BOARD_ID, BOARD_TYPE, BOARD_NAME, DESCRIPTION,
        PAGE_SIZE,
        SEARCH_CONDITION_USE_YN, SEARCH_CLASSIFICATION_USE_YN, SEARCH_DATE_USE_YN,
        CLASSIFICATION_USE_YN,
        NOTICE_POPUP_USE_YN, NOTICE_POPUP_UNFOLD_YN, NOTICE_LABEL_USE_YN,
        EDITOR_USE_YN,
        ANSWER_USE_YN, ANSWER_NOTICE_YN,
        COMMENT_USE_YN, COMMENT_NOTICE_YN, REPLY_COMMENT_USE_YN,
        FILE_ATTACH_USE_YN, IMAGE_ATTACH_USE_YN,
        SORT_COLUMN, SORT_METHOD,
        DELETE_YN,
        FIRST_REG_DATETIME, FIRST_REGR_ID,
        LAST_MOD_DATETIME,  LAST_MODR_ID
    ) VALUES (
        'MANUAL', 'BOARD', '모바일 관리 매뉴얼', '모바일 관리 매뉴얼 게시판',
        20,
        1, 0, 1,  -- 검색조건/기간 사용
        0,
        0, 0, 0,  -- 팝업/라벨 미사용
        1,        -- 에디터 사용
        0, 0,
        0, 0, 0,  -- 댓글 미사용
        1, 0,     -- 파일첨부 사용
        'FIRST_REG_DATETIME', 'DESC',
        0,
        GETDATE(), 'admin',
        GETDATE(), 'admin'
    );
    PRINT 'TN_CF_BOARD MANUAL 등록 완료';
END
ELSE PRINT 'TN_CF_BOARD MANUAL 이미 존재';

-- =============================================
-- STEP 2. TN_CF_POST 데이터 이관
-- =============================================

-- 직원용 매뉴얼 (BBS_ID='manual' → BOARD_ID='MANUAL', EMP_TYPE='N')
INSERT INTO TN_CF_POST (
    BOARD_ID,
    POST_ID,
    POST_TITLE,
    POST_DETAIL,
    UPPER_POST_ID,
    HIERARCHY_LEVEL,
    REPLY_SEQUENCE,
    NOTICE_POPUP_YN,
    NOTICE_LABEL_YN,
    DELETE_YN,
    USE_YN,
    EMP_TYPE,
    FIRST_REG_DATETIME,
    FIRST_REGR_ID,
    LAST_MOD_DATETIME,
    LAST_MODR_ID
)
SELECT
    'MANUAL'                                        AS BOARD_ID,
    S.COMMU_ID                                      AS POST_ID,
    S.COMMU_TITLE                                   AS POST_TITLE,
    -- 변환: COMMU_DETAIL HTML 엔티티 → 실제 문자 디코딩 (v-html 렌더링 정상화)
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        CAST(S.COMMU_DETAIL AS NVARCHAR(MAX)),
        '&lt;',   '<'),
        '&gt;',   '>'),
        '&amp;',  '&'),
        '&quot;', '"'),
        '&#39;',  '''')                             AS POST_DETAIL,
    S.UPPER_COMMU_ID                                AS UPPER_POST_ID,
    ISNULL(S.HIERARCHY_LEVEL, 1)                    AS HIERARCHY_LEVEL,
    ISNULL(S.REPLY_PRIORITY, 0)                     AS REPLY_SEQUENCE,
    0                                               AS NOTICE_POPUP_YN,
    0                                               AS NOTICE_LABEL_YN,
    -- 변환: DELETE_YN nvarchar('N'=미삭제,'Y'=삭제) → bit (0/1)
    CASE WHEN ISNULL(S.DELETE_YN, 'N') = 'Y' THEN 1 ELSE 0 END AS DELETE_YN,
    'Y'                                             AS USE_YN,
    'N'                                             AS EMP_TYPE,
    ISNULL(S.FIRST_REG_DATETIME, GETDATE())         AS FIRST_REG_DATETIME,
    ISNULL(S.FIRST_REGR_ID, 'admin')                AS FIRST_REGR_ID,
    ISNULL(S.LAST_MOD_DATETIME, GETDATE())          AS LAST_MOD_DATETIME,
    ISNULL(S.LAST_MODR_ID, 'admin')                 AS LAST_MODR_ID
FROM [MOPORTAL_DEV].[dbo].[TN_CF_SDPCOMMU] S
WHERE S.BBS_ID = 'manual'
  AND NOT EXISTS (
      SELECT 1 FROM TN_CF_POST WHERE POST_ID = S.COMMU_ID
  );

PRINT '직원용 매뉴얼 이관: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- 협력직용 매뉴얼 (BBS_ID='partner_manual' → BOARD_ID='MANUAL', EMP_TYPE='P')
INSERT INTO TN_CF_POST (
    BOARD_ID,
    POST_ID,
    POST_TITLE,
    POST_DETAIL,
    UPPER_POST_ID,
    HIERARCHY_LEVEL,
    REPLY_SEQUENCE,
    NOTICE_POPUP_YN,
    NOTICE_LABEL_YN,
    DELETE_YN,
    USE_YN,
    EMP_TYPE,
    FIRST_REG_DATETIME,
    FIRST_REGR_ID,
    LAST_MOD_DATETIME,
    LAST_MODR_ID
)
SELECT
    'MANUAL'                                        AS BOARD_ID,
    S.COMMU_ID                                      AS POST_ID,
    S.COMMU_TITLE                                   AS POST_TITLE,
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        CAST(S.COMMU_DETAIL AS NVARCHAR(MAX)),
        '&lt;',   '<'),
        '&gt;',   '>'),
        '&amp;',  '&'),
        '&quot;', '"'),
        '&#39;',  '''')                             AS POST_DETAIL,
    S.UPPER_COMMU_ID                                AS UPPER_POST_ID,
    ISNULL(S.HIERARCHY_LEVEL, 1)                    AS HIERARCHY_LEVEL,
    ISNULL(S.REPLY_PRIORITY, 0)                     AS REPLY_SEQUENCE,
    0                                               AS NOTICE_POPUP_YN,
    0                                               AS NOTICE_LABEL_YN,
    CASE WHEN ISNULL(S.DELETE_YN, 'N') = 'Y' THEN 1 ELSE 0 END AS DELETE_YN,
    'Y'                                             AS USE_YN,
    'P'                                             AS EMP_TYPE,
    ISNULL(S.FIRST_REG_DATETIME, GETDATE())         AS FIRST_REG_DATETIME,
    ISNULL(S.FIRST_REGR_ID, 'admin')                AS FIRST_REGR_ID,
    ISNULL(S.LAST_MOD_DATETIME, GETDATE())          AS LAST_MOD_DATETIME,
    ISNULL(S.LAST_MODR_ID, 'admin')                 AS LAST_MODR_ID
FROM [MOPORTAL_DEV].[dbo].[TN_CF_SDPCOMMU] S
WHERE S.BBS_ID = 'partner_manual'
  AND NOT EXISTS (
      SELECT 1 FROM TN_CF_POST WHERE POST_ID = S.COMMU_ID
  );

PRINT '협력직용 매뉴얼 이관: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

COMMIT;

-- 이관 후 확인
SELECT EMP_TYPE, COUNT(*) AS 건수
FROM TN_CF_POST
WHERE BOARD_ID = 'MANUAL'
GROUP BY EMP_TYPE;
