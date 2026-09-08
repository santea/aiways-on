-- ============================================================
-- VOC_CATETC 활성 코드 수정
-- 구 소스 formUserVoc.jsp/listUserVocs.jsp 에서 실제 사용하는 코드만 활성화
-- ============================================================

-- 001 중복 제거 (이관 시 DELETE_YN=1 행이 중복 삽입된 경우)
DELETE FROM TC_CF_COMM_CODE
WHERE COMM_CODE_TYPE_CODE = 'VOC_CATETC'
  AND CODE = '001'
  AND DELETE_YN = 1;

-- 구 소스에서 실제 사용하는 코드 활성화
-- 005(포탈 문의), 006(포탈 오류), 009(기능개선 제안), 010(네트워크 LTE+VPN) 은 신 소스 미사용 → 비활성 유지
UPDATE TC_CF_COMM_CODE
SET DELETE_YN = 0,
    LAST_MOD_DATETIME = GETDATE(),
    LAST_MODR_ID = 'admin'
WHERE COMM_CODE_TYPE_CODE = 'VOC_CATETC'
  AND CODE IN ('002', '003', '004', '007', '008', '099')
  AND DELETE_YN = 1;

-- 확인
SELECT CODE, JSON_VALUE(LABEL_JSON, '$.ko_KR') AS label, ORD, DELETE_YN
FROM TC_CF_COMM_CODE
WHERE COMM_CODE_TYPE_CODE = 'VOC_CATETC'
ORDER BY ORD;
