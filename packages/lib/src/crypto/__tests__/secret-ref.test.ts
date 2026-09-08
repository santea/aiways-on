import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  SecretCryptoError,
  createSecretVault,
  decryptSecret,
  encryptSecret,
} from '../secret-ref';

const ENV = { SDLC_SECRET_ENCRYPTION_KEY: 'unit-test-encryption-key-material' };

describe('encryptSecret / decryptSecret', () => {
  it('평문을 왕복해도 값이 보존된다', () => {
    const sealed = encryptSecret(ENV, 'ghp_super_secret_pat');
    expect(decryptSecret(ENV, sealed)).toBe('ghp_super_secret_pat');
  });

  it('암호문에 평문이 남지 않는다', () => {
    const sealed = encryptSecret(ENV, 'ghp_super_secret_pat');
    expect(sealed.ciphertext).not.toContain('ghp_super_secret_pat');
    expect(sealed.iv.length).toBeGreaterThan(0);
  });

  it('같은 평문도 매번 다른 IV·암호문을 낸다', () => {
    const a = encryptSecret(ENV, 'same');
    const b = encryptSecret(ENV, 'same');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('한글·긴 문자열도 왕복한다', () => {
    const long = '한글 비밀 '.repeat(200);
    expect(decryptSecret(ENV, encryptSecret(ENV, long))).toBe(long);
  });

  it('암호문이 변조되면 복호화가 실패한다 — 조용히 통과시키지 않는다', () => {
    const sealed = encryptSecret(ENV, 'tamper-me');
    const flipped = Buffer.from(sealed.ciphertext, 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    expect(() =>
      decryptSecret(ENV, { ...sealed, ciphertext: flipped.toString('base64') }),
    ).toThrow(SecretCryptoError);
  });

  it('다른 키로는 복호화되지 않는다', () => {
    const sealed = encryptSecret(ENV, 'tenant-a');
    expect(() =>
      decryptSecret({ SDLC_SECRET_ENCRYPTION_KEY: 'a-completely-different-key' }, sealed),
    ).toThrow(SecretCryptoError);
  });

  it('키가 하나도 없으면 암호화를 거부한다 — 평문 저장으로 물러나지 않는다', () => {
    expect(() => encryptSecret({}, 'x')).toThrow(SecretCryptoError);
  });

  it('전용 키가 없으면 AUTH_SECRET 으로 물러난다', () => {
    const env = { AUTH_SECRET: 'fallback-auth-secret' };
    expect(decryptSecret(env, encryptSecret(env, 'v'))).toBe('v');
  });

  // PBT-02 — 암호화/복호화 왕복 성질 (규칙이 명시적으로 지목하는 대상)
  it('PBT: decrypt(encrypt(x)) === x 가 임의의 평문에서 성립한다', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (plaintext) => {
        expect(decryptSecret(ENV, encryptSecret(ENV, plaintext))).toBe(plaintext);
      }),
      { numRuns: 60 },
    );
  });

  // PBT-03 — 불변식: 암호문에는 평문 조각이 남지 않는다
  it('PBT: 암호문·IV 어디에도 원본 평문이 그대로 나타나지 않는다', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 8, maxLength: 200 }), (plaintext) => {
        const sealed = encryptSecret(ENV, plaintext);
        expect(sealed.ciphertext.includes(plaintext)).toBe(false);
        expect(sealed.iv.includes(plaintext)).toBe(false);
      }),
      { numRuns: 60 },
    );
  });

  it('hint 는 저장되지만 평문을 담지 않는다', () => {
    const sealed = encryptSecret(ENV, 'ghp_abc', 'github-pat');
    expect(sealed.hint).toBe('github-pat');
  });
});

describe('createSecretVault', () => {
  const makeStore = () => {
    const rows = new Map<string, { ciphertext: string; iv: string; hint: string | null }>();
    let n = 0;
    return {
      rows,
      insert: async (row: { ciphertext: string; iv: string; hint: string | null }) => {
        const id = `ref-${++n}`;
        rows.set(id, row);
        return id;
      },
      findById: async (id: string) => rows.get(id) ?? null,
    };
  };

  it('store 는 참조 ID 만 돌려주고 평문을 저장하지 않는다', async () => {
    const store = makeStore();
    const vault = createSecretVault(ENV, store);
    const id = await vault.store('ghp_pat_value', 'github-pat');
    expect(id).toBe('ref-1');
    expect(JSON.stringify([...store.rows.values()])).not.toContain('ghp_pat_value');
  });

  it('reveal 은 저장한 평문을 되돌려준다', async () => {
    const vault = createSecretVault(ENV, makeStore());
    const id = await vault.store('ghp_pat_value');
    expect(await vault.reveal(id)).toBe('ghp_pat_value');
  });

  it('없는 참조는 null 이다 — 예외로 흐름을 끊지 않는다', async () => {
    const vault = createSecretVault(ENV, makeStore());
    expect(await vault.reveal('ref-없음')).toBeNull();
  });
});
