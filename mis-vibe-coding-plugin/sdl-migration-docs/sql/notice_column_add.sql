-- =============================================
-- TN_CF_POST 공지사항 확장 컬럼 추가
-- 목적: 포털 공지사항 기능에서 사용하는 USE_YN(사용여부), EMP_TYPE(직원구분) 컬럼 추가
-- 실행 전 조건: 없음 (IF NOT EXISTS로 중복 실행 안전)
-- =============================================

-- USE_YN: 공지 사용여부 (Y=사용, N=미사용)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('TN_CF_POST') AND name = 'USE_YN'
)
BEGIN
    ALTER TABLE TN_CF_POST ADD USE_YN NVARCHAR(1) NOT NULL DEFAULT 'Y';
    PRINT 'USE_YN 컬럼 추가 완료';
END
ELSE
    PRINT 'USE_YN 컬럼 이미 존재';

-- EMP_TYPE: 대상 직원 구분 (N=직원, P=협력직, ''=전체)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('TN_CF_POST') AND name = 'EMP_TYPE'
)
BEGIN
    ALTER TABLE TN_CF_POST ADD EMP_TYPE NVARCHAR(1) NULL;
    PRINT 'EMP_TYPE 컬럼 추가 완료';
END
ELSE
    PRINT 'EMP_TYPE 컬럼 이미 존재';

-- =============================================
-- 기존 데이터 기본값 세팅 (더미 데이터 등)
-- =============================================
UPDATE TN_CF_POST
SET    USE_YN   = ISNULL(USE_YN, 'Y'),
       EMP_TYPE = ISNULL(EMP_TYPE, '')
WHERE  BOARD_ID = 'NOTICE';

PRINT '기존 NOTICE 데이터 USE_YN/EMP_TYPE 기본값 세팅 완료: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- =============================================
-- 확인 쿼리
-- =============================================
SELECT POST_ID, POST_TITLE, USE_YN, EMP_TYPE, FIRST_REG_DATETIME
FROM   TN_CF_POST
WHERE  BOARD_ID = 'NOTICE'
ORDER BY FIRST_REG_DATETIME DESC;
