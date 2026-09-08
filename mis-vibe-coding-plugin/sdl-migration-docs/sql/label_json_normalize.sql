-- =============================================
-- LABEL_JSON 키 정규화
-- {"ko":"...","en":"..."} → {"ko_KR":"...","en_US":"..."}
--
-- 배경: 구 DB 이관 시 SDL SDLLocale mixin은 Vuex locale(ko_KR, en_US) 키로
--       labelJson 객체에 직접 접근하므로, 구 형식 키(ko, en)로 저장된 경우
--       언어 전환 시 메뉴명이 표시되지 않음.
--
-- 실행 시점: migration_menu_auth.sql 실행 후 또는 기존 DB 정규화 시
-- =============================================

-- ① 정규화 대상 건수 확인
SELECT
    'TN_CF_MENU' AS 테이블,
    COUNT(*) AS 정규화대상건수
FROM TN_CF_MENU
WHERE LABEL_JSON LIKE '%"ko":%' AND LABEL_JSON NOT LIKE '%"ko_KR":%'
   OR LABEL_JSON LIKE '%"en":%' AND LABEL_JSON NOT LIKE '%"en_US":%'
UNION ALL
SELECT
    'TN_CF_WORKGROUP',
    COUNT(*)
FROM TN_CF_WORKGROUP
WHERE LABEL_JSON LIKE '%"ko":%' AND LABEL_JSON NOT LIKE '%"ko_KR":%'
   OR LABEL_JSON LIKE '%"en":%' AND LABEL_JSON NOT LIKE '%"en_US":%';

-- ② TN_CF_MENU 정규화
UPDATE TN_CF_MENU
SET LABEL_JSON = REPLACE(REPLACE(LABEL_JSON, '"en":', '"en_US":'), '"ko":', '"ko_KR":')
WHERE LABEL_JSON LIKE '%"ko":%' AND LABEL_JSON NOT LIKE '%"ko_KR":%'
   OR LABEL_JSON LIKE '%"en":%' AND LABEL_JSON NOT LIKE '%"en_US":%';

PRINT 'TN_CF_MENU 정규화 완료: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- ③ TN_CF_WORKGROUP 정규화
UPDATE TN_CF_WORKGROUP
SET LABEL_JSON = REPLACE(REPLACE(LABEL_JSON, '"en":', '"en_US":'), '"ko":', '"ko_KR":')
WHERE LABEL_JSON LIKE '%"ko":%' AND LABEL_JSON NOT LIKE '%"ko_KR":%'
   OR LABEL_JSON LIKE '%"en":%' AND LABEL_JSON NOT LIKE '%"en_US":%';

PRINT 'TN_CF_WORKGROUP 정규화 완료: ' + CAST(@@ROWCOUNT AS VARCHAR) + '건';

-- ④ 정규화 결과 확인
SELECT TOP 20
    MENU_ID, LABEL, LABEL_JSON
FROM TN_CF_MENU
WHERE LABEL_JSON IS NOT NULL
ORDER BY MENU_LEVEL, MENU_SEQUENCE;
