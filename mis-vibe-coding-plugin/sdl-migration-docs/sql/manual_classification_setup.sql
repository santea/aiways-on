-- ============================================================
-- 모바일 관리 매뉴얼 분류 데이터 등록 및 이관 게시글 연결
-- 구 DB 분류: AViKZD68AAEe-jRo=단말기, AViKZD68AAIe-jRo=보안 (manual 게시판만)
-- partner_manual에는 분류 없음
-- ============================================================

/* STEP 0: 구 DB 분류 조회 (참고)
SELECT BBS_CLSFTN_SERIAL_NO, BBS_CLSFTN_NAME, BBS_ID
FROM TN_CF_SDPBBS_CLSFTN
WHERE BBS_ID IN ('manual', 'partner_manual')
ORDER BY BBS_CLSFTN_SERIAL_NO;

-- 결과:
-- AViKZD68AAEe-jRo    단말기    manual
-- AViKZD68AAIe-jRo    보안      manual
*/

BEGIN TRANSACTION;

-- =============================================
-- STEP 1. TN_CF_BOARD 분류 사용 활성화
-- =============================================
UPDATE TN_CF_BOARD
SET    CLASSIFICATION_USE_YN        = 1,
       SEARCH_CLASSIFICATION_USE_YN = 1,
       LAST_MOD_DATETIME            = GETDATE(),
       LAST_MODR_ID                 = 'admin'
WHERE  BOARD_ID = 'MANUAL';
PRINT 'TN_CF_BOARD MANUAL CLASSIFICATION_USE_YN 활성화: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- STEP 2. TN_CF_BOARD_CLASSIFICATION 분류 등록
--         구 DB CLASSIFICATION_ID 그대로 사용
-- =============================================
IF NOT EXISTS (SELECT 1 FROM TN_CF_BOARD_CLASSIFICATION WHERE BOARD_ID = 'MANUAL' AND CLASSIFICATION_ID = 'AViKZD68AAEe-jRo')
BEGIN
    INSERT INTO TN_CF_BOARD_CLASSIFICATION
    (BOARD_ID, CLASSIFICATION_ID, CLASSIFICATION_NAME, DESCRIPTION,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    ('MANUAL', 'AViKZD68AAEe-jRo', '단말기', NULL,
     GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT '분류 [단말기] 등록 완료';
END
ELSE PRINT '분류 [단말기] 이미 존재';

IF NOT EXISTS (SELECT 1 FROM TN_CF_BOARD_CLASSIFICATION WHERE BOARD_ID = 'MANUAL' AND CLASSIFICATION_ID = 'AViKZD68AAIe-jRo')
BEGIN
    INSERT INTO TN_CF_BOARD_CLASSIFICATION
    (BOARD_ID, CLASSIFICATION_ID, CLASSIFICATION_NAME, DESCRIPTION,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID)
    VALUES
    ('MANUAL', 'AViKZD68AAIe-jRo', '보안', NULL,
     GETDATE(), 'admin', GETDATE(), 'admin');
    PRINT '분류 [보안] 등록 완료';
END
ELSE PRINT '분류 [보안] 이미 존재';

-- =============================================
-- STEP 3. 이관된 TN_CF_POST 게시글에 CLASSIFICATION_ID 연결
--         구 DB TN_CF_SDPCOMMU_CLSFTN.BBS_CLSFTN_SERIAL_NO → TN_CF_POST.CLASSIFICATION_ID
-- =============================================
UPDATE P
SET    P.CLASSIFICATION_ID = C.BBS_CLSFTN_SERIAL_NO,
       P.LAST_MOD_DATETIME = GETDATE()
FROM   TN_CF_POST P
JOIN   [MOPORTAL_DEV].[dbo].[TN_CF_SDPCOMMU_CLSFTN] C
       ON P.POST_ID = C.COMMU_ID
WHERE  P.BOARD_ID = 'MANUAL'
  AND  C.BBS_CLSFTN_SERIAL_NO IN ('AViKZD68AAEe-jRo', 'AViKZD68AAIe-jRo');
PRINT 'CLASSIFICATION_ID 연결 업데이트: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

COMMIT;

-- =============================================
-- STEP 4. 확인
-- =============================================
SELECT BC.CLASSIFICATION_NAME, COUNT(P.POST_ID) AS 건수
FROM   TN_CF_POST P
LEFT   JOIN TN_CF_BOARD_CLASSIFICATION BC
       ON P.BOARD_ID = BC.BOARD_ID AND P.CLASSIFICATION_ID = BC.CLASSIFICATION_ID
WHERE  P.BOARD_ID = 'MANUAL'
  AND  P.DELETE_YN = '0'
GROUP BY BC.CLASSIFICATION_NAME
ORDER BY BC.CLASSIFICATION_NAME;
