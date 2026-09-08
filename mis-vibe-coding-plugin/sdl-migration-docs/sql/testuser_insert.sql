-- =============================================
-- testuser TN_CF_USER UPSERT
-- 목적: accessLog FK_CF_SYS_USE_LOG_01 위반 해결
--       TN_CF_SYS_USE_LOG.USER_ID → TN_CF_USER.USER_ID FK
-- =============================================

IF NOT EXISTS (SELECT 1 FROM TN_CF_USER WHERE USER_ID = 'testuser')
BEGIN
    INSERT INTO TN_CF_USER
    (USER_ID, PASSWORD, DESCRIPTION, ACTIVE_FLAG, SYS_ID,
     EMP_NO, RECENT_LOGIN_IP, RECENT_LOGIN_DATETIME,
     FIRST_REG_DATETIME, FIRST_REGR_ID, LAST_MOD_DATETIME, LAST_MODR_ID,
     KNOX_ID, FIRST_NAME, LAST_NAME, EN_USER_NAME, EN_FIRST_NAME, EN_LAST_NAME,
     LANGUAGE_CODE, DISPLAY_NAME, USER_NAME,
     COMP_NAME, EN_COMP_NAME, COMP_CODE,
     DEPT_NAME, EN_DEPT_NAME, DEPT_CODE,
     GRD_NAME, EN_GRD_NAME, GRD_CODE,
     COMP_TEL_NO, MOBILE_TEL_NO, EMAIL_ADDRESS, NICK_NAME,
     EXTERNAL_USER_FLAG, TIME_ZONE_CODE, USER_TYPE, DELETED,
     TIME_ZONE_ID, LOGIN_ERROR_COUNT, LAST_PW_CHANGE_DATETIME,
     SERVER_LOCATION, LAST_ACTIVITY_TIME, JWT)
    VALUES
    ('testuser', '$2a$10$dummyhashforlocaltestonly1234567', NULL, '1', NULL,
     'E001', NULL, NULL,
     GETDATE(), 'admin', GETDATE(), 'admin',
     'testuser', '테스트', '사용자', 'Test User', 'Test', 'User',
     'ko_KR', '테스트 사용자', '테스트 사용자',
     'company', 'domain Electronics', 'SEC',
     '개발팀', 'Dev Team', 'DEV01',
     NULL, NULL, NULL,
     NULL, NULL, 'testuser@domain.com', NULL,
     '0', NULL, 'EMPLOYEE', '0',
     'Asia/Seoul', 0, NULL,
     NULL, NULL, NULL)
    PRINT 'testuser INSERT 완료'
END
ELSE
BEGIN
    UPDATE TN_CF_USER
    SET    USER_NAME    = '테스트 사용자',
           KNOX_ID      = 'testuser',
           EMP_NO       = 'E001',
           EMAIL_ADDRESS= 'testuser@domain.com',
           DEPT_NAME    = '개발팀',
           DEPT_CODE    = 'DEV01',
           COMP_NAME    = 'company',
           COMP_CODE    = 'SEC',
           USER_TYPE    = 'EMPLOYEE',
           ACTIVE_FLAG  = '1',
           DELETED      = '0',
           LAST_MOD_DATETIME = GETDATE(),
           LAST_MODR_ID = 'admin'
    WHERE  USER_ID = 'testuser'
    PRINT 'testuser UPDATE 완료'
END

-- 확인
SELECT USER_ID, USER_NAME, ACTIVE_FLAG, DELETED, EMAIL_ADDRESS
FROM   TN_CF_USER
WHERE  USER_ID = 'testuser';
