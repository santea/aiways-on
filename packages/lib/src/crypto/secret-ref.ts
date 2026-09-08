/**
 * `secret_refs` 비밀값 암호화 — F-2 (U2 Part 1 발견).
 *
 * 명세는 비밀값을 **AES-256-GCM 으로 암호화해 `secret_refs` 에만 저장**하라고 정한다
 * (`04-db-schema.md` §8.1 · `01-auth-github.md` §6 · NFR-10). 그런데 U1 은 테이블만
 * 만들고 이 코드를 만들지 않았다. 방치하면 U2(GitHub PAT · repo 파일 · env var)와
 * U6(MCP 접근 토큰)가 **암호화를 각각 구현**하게 되어, AD-2 가 인증에서 막으려던
 * 분산이 암호화에서 그대로 일어난다. 그래서 U1 공유 영역에 단 하나만 둔다.
 *
 * ⚠️ 키 출처: 명세 `10-k8s-infrastructure.md` §7 환경변수 표에 **암호화 전용 키가 없다.**
 *    `SDLC_IMAGE_SIGNING_SECRET` 이 "비어 있으면 AUTH_SECRET 재사용"으로 규정된 것과
 *    같은 방식을 따라 `SDLC_SECRET_ENCRYPTION_KEY` → `AUTH_SECRET` 순으로 읽는다.
 *    명세 문서는 고치지 않았다 — 환경변수 이름 확정은 사용자 판단이다.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/** 암호화 실패. **평문 저장으로 물러나지 않는다** — 실패는 실패로 끝낸다. */
export class SecretCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretCryptoError';
  }
}

/** `secret_refs` 한 행의 저장 형태. 평문은 어디에도 없다. */
export interface SealedSecret {
  readonly ciphertext: string;
  readonly iv: string;
  readonly hint: string | null;
}

export interface SecretCryptoEnv {
  readonly SDLC_SECRET_ENCRYPTION_KEY?: string;
  readonly AUTH_SECRET?: string;
}

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
/** 고정 salt — 키 자체가 비밀이므로 salt 는 도메인 분리 용도다. */
const KEY_SALT = 'aiways-on/secret-refs/v1';
const TAG_BYTES = 16;

function deriveKey(env: SecretCryptoEnv): Buffer {
  const material = env.SDLC_SECRET_ENCRYPTION_KEY ?? env.AUTH_SECRET;
  if (!material) {
    throw new SecretCryptoError(
      'SDLC_SECRET_ENCRYPTION_KEY 도 AUTH_SECRET 도 없다 — 비밀값을 암호화할 수 없다',
    );
  }
  return scryptSync(material, KEY_SALT, KEY_BYTES);
}

/** 평문을 봉인한다. 인증 태그는 암호문 뒤에 붙여 한 값으로 보관한다. */
export function encryptSecret(
  env: SecretCryptoEnv,
  plaintext: string,
  hint: string | null = null,
): SealedSecret {
  const key = deriveKey(env);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([body, tag]).toString('base64'),
    iv: iv.toString('base64'),
    hint,
  };
}

/** 봉인을 푼다. 변조·키 불일치는 모두 `SecretCryptoError` 다 — 조용히 통과시키지 않는다. */
export function decryptSecret(env: SecretCryptoEnv, sealed: SealedSecret): string {
  const key = deriveKey(env);
  const raw = Buffer.from(sealed.ciphertext, 'base64');
  // 태그는 정확히 16바이트다. 평문이 빈 문자열이면 암호문 본문이 0바이트이므로
  // 전체 길이가 정확히 16이 되고 그것은 **유효한 값**이다 — `<= 16` 으로 막으면
  // 빈 평문의 왕복이 깨진다 (PBT 왕복 성질이 잡아낸 결함).
  if (raw.length < TAG_BYTES) {
    throw new SecretCryptoError('암호문이 너무 짧다 — 인증 태그가 없다');
  }
  const body = raw.subarray(0, raw.length - TAG_BYTES);
  const tag = raw.subarray(raw.length - TAG_BYTES);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(sealed.iv, 'base64'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    // 원인 메시지를 그대로 올리지 않는다 (NFR-16).
    throw new SecretCryptoError('비밀값을 복호화할 수 없다 — 키 불일치 또는 변조');
  }
}

/** 저장소 어댑터. 드리즐을 직접 부르지 않아 유닛 테스트가 DB 없이 돈다. */
export interface SecretRefStore {
  insert(row: SealedSecret): Promise<string>;
  findById(id: string): Promise<SealedSecret | null>;
}

export interface SecretVault {
  /** 평문을 암호화해 저장하고 **참조 ID 만** 반환한다. */
  store(plaintext: string, hint?: string | null): Promise<string>;
  /** 참조 ID 로 평문을 복원한다. 행이 없으면 `null`. */
  reveal(secretRefId: string): Promise<string | null>;
}

export function createSecretVault(env: SecretCryptoEnv, store: SecretRefStore): SecretVault {
  return {
    async store(plaintext, hint = null) {
      return store.insert(encryptSecret(env, plaintext, hint));
    },
    async reveal(secretRefId) {
      const row = await store.findById(secretRefId);
      return row ? decryptSecret(env, row) : null;
    },
  };
}
