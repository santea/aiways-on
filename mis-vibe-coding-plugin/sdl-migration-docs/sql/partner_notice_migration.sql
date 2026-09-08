-- ============================================================
-- Partner 공지사항 데이터 이관 SQL
-- 구 DB: MOPORTAL_DEV (TN_CF_SDPCOMMU, BBS_ID='partner_notice')
-- 신 DB: SDL_DEV      (TN_CF_POST, BOARD_ID='PARTNER_NOTICE')
-- 이관 건수: 15건 (사용자 확인)
-- ============================================================
-- [컬럼 매핑]
-- COMMU_ID        → POST_ID
-- COMMU_TITLE     → POST_TITLE
-- COMMU_DETAIL    → POST_DETAIL (HTML 엔티티 디코딩)
-- UPPER_COMMU_ID  → UPPER_POST_ID
-- HIERARCHY_LEVEL → HIERARCHY_LEVEL
-- REPLY_PRIORITY  → REPLY_SEQUENCE
-- BBS_ID='partner_notice' → BOARD_ID='PARTNER_NOTICE', EMP_TYPE='P'
-- DELETE_YN nvarchar('N'=미삭제,'Y'=삭제) → bit (0/1)
-- USE_YN: NOT NULL — 기본값 'Y' 적용
-- NOTICE_POPUP_YN, NOTICE_LABEL_YN: bit NOT NULL — 0 적용
-- ============================================================

-- STEP 0: 이관 전 건수 확인
/*
-- 구 DB에서 실행
SELECT COUNT(*) AS 건수 FROM [MOPORTAL_DEV].[dbo].[TN_CF_SDPCOMMU]
WHERE BBS_ID = 'partner_notice';
-- 예상: 15

-- 신 DB에서 실행
SELECT COUNT(*) AS 기존건수 FROM TN_CF_POST WHERE BOARD_ID = 'PARTNER_NOTICE';
-- 예상: 0
*/

BEGIN TRANSACTION;

-- =============================================
-- STEP 1. TN_CF_BOARD 게시판 정의 등록
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_BOARD WHERE BOARD_ID = 'PARTNER_NOTICE')
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
        'PARTNER_NOTICE', 'BOARD', 'Partner 공지사항', 'Partner 공지사항 게시판',
        20,
        1, 0, 1,
        0,
        1, 0, 0,
        1,
        0, 0,
        0, 0, 0,
        0, 0,
        'FIRST_REG_DATETIME', 'DESC',
        0,
        GETDATE(), 'admin',
        GETDATE(), 'admin'
    );
    PRINT 'TN_CF_BOARD PARTNER_NOTICE 등록 완료';
END
ELSE PRINT 'TN_CF_BOARD PARTNER_NOTICE 이미 존재';

-- =============================================
-- STEP 2. TN_CF_POST 데이터 이관 (15건)
-- =============================================
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
    'PARTNER_NOTICE'                                    AS BOARD_ID,
    S.COMMU_ID                                          AS POST_ID,
    S.COMMU_TITLE                                       AS POST_TITLE,
    -- HTML 엔티티 디코딩 (v-html 렌더링 정상화)
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        CAST(S.COMMU_DETAIL AS NVARCHAR(MAX)),
        '&lt;',   '<'),
        '&gt;',   '>'),
        '&amp;',  '&'),
        '&quot;', '"'),
        '&#39;',  '''')                                 AS POST_DETAIL,
    S.UPPER_COMMU_ID                                    AS UPPER_POST_ID,
    ISNULL(S.HIERARCHY_LEVEL, 1)                        AS HIERARCHY_LEVEL,
    ISNULL(S.REPLY_PRIORITY, 0)                         AS REPLY_SEQUENCE,
    0                                                   AS NOTICE_POPUP_YN,
    0                                                   AS NOTICE_LABEL_YN,
    CASE WHEN ISNULL(S.DELETE_YN, 'N') = 'Y' THEN 1 ELSE 0 END AS DELETE_YN,
    'Y'                                                 AS USE_YN,
    'P'                                                 AS EMP_TYPE,
    ISNULL(S.FIRST_REG_DATETIME, GETDATE())             AS FIRST_REG_DATETIME,
    ISNULL(S.FIRST_REGR_ID, 'admin')                    AS FIRST_REGR_ID,
    ISNULL(S.LAST_MOD_DATETIME, GETDATE())              AS LAST_MOD_DATETIME,
    ISNULL(S.LAST_MODR_ID, 'admin')                     AS LAST_MODR_ID
FROM [MOPORTAL_DEV].[dbo].[TN_CF_SDPCOMMU] S
WHERE S.BBS_ID = 'partner_notice'
  AND NOT EXISTS (
      SELECT 1 FROM TN_CF_POST WHERE POST_ID = S.COMMU_ID
  );

PRINT 'PARTNER_NOTICE 이관: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

COMMIT;

-- 이관 후 확인
SELECT BOARD_ID, COUNT(*) AS 건수
FROM TN_CF_POST
WHERE BOARD_ID = 'PARTNER_NOTICE'
GROUP BY BOARD_ID;
