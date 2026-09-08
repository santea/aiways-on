-- ============================================================
-- 런처관리 > 보안서약서 메뉴 순서 변경
-- 플랫폼 전환 상태 관리(MENU_SEQUENCE=30) 바로 다음으로 이동
-- ============================================================
-- 현재 메뉴 순서:
--   플랫폼 전환 상태 관리  (AZbMQ-BqAACm_Dik)  SEQUENCE = 30
--   보안서약서             (AZfTGd-KAACm_Dhq)  SEQUENCE = 31  ← 올바른 위치

-- 확인 쿼리 (적용 전 현재 상태 확인)
SELECT M.MENU_ID, M.LABEL, M.MENU_SEQUENCE,
       SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE SR.UPPER_SYS_RESOURCE_ID = 'AVdQgpNMAAd_i4eq'
ORDER BY M.MENU_SEQUENCE;

-- 보안서약서 순서를 31로 변경 (플랫폼 전환 상태 관리=30 바로 다음)
UPDATE TN_CF_MENU
SET MENU_SEQUENCE = 31
WHERE MENU_ID = 'AZfTGd-KAACm_Dhq';  -- 보안서약서

PRINT '보안서약서 MENU_SEQUENCE → 31 변경 완료';

-- 적용 후 확인
SELECT M.MENU_ID, M.LABEL, M.MENU_SEQUENCE,
       SR.UPPER_SYS_RESOURCE_ID AS 부모ID
FROM TN_CF_MENU M
JOIN TN_CF_SYS_RESOURCE SR ON M.MENU_ID = SR.SYS_RESOURCE_ID
WHERE SR.UPPER_SYS_RESOURCE_ID = 'AVdQgpNMAAd_i4eq'
ORDER BY M.MENU_SEQUENCE;
