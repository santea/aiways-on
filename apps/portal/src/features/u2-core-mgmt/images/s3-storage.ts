/**
 * S3 호환 오브젝트 스토리지 — `10-k8s-infrastructure.md` §7 의 `S3_*` 환경변수를 쓴다.
 *
 * SDK 를 들이지 않고 SigV4 를 직접 서명한다. 필요한 동작이 PUT·GET 두 개뿐이라
 * 의존성 하나를 더 얹을 이유가 없다 (YAGNI).
 */
import { createHash, createHmac } from 'node:crypto';
import type { ObjectStorage } from './image-service';

export interface S3Env {
  readonly S3_ENDPOINT?: string;
  readonly S3_BUCKET?: string;
  readonly S3_ACCESS_KEY?: string;
  readonly S3_SECRET_KEY?: string;
  readonly S3_REGION?: string;
  readonly S3_PREFIX?: string;
}

const sha256Hex = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');

const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac('sha256', key).update(data).digest();

function signingKey(secret: string, date: string, region: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), 's3'), 'aws4_request');
}

/** 없는 설정을 기본값으로 얼버무리지 않는다 — 어느 변수가 빠졌는지 이름으로 알린다. */
function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} 가 설정되지 않았다`);
  return value;
}

export function createS3Storage(env: S3Env, fetchImpl: typeof fetch = fetch): ObjectStorage {
  const endpoint = required(env.S3_ENDPOINT, 'S3_ENDPOINT');
  const bucket = required(env.S3_BUCKET, 'S3_BUCKET');
  const accessKey = required(env.S3_ACCESS_KEY, 'S3_ACCESS_KEY');
  const secretKey = required(env.S3_SECRET_KEY, 'S3_SECRET_KEY');
  const region = env.S3_REGION ?? 'us-east-1';
  const prefix = env.S3_PREFIX ?? '';

  const keyOf = (objectKey: string) => `${prefix}${objectKey}`.replace(/^\/+/, '');

  /** path-style 주소 — 사내 S3 호환 스토리지는 대부분 virtual-host 를 지원하지 않는다. */
  const urlOf = (objectKey: string) =>
    new URL(`/${bucket}/${keyOf(objectKey)}`, endpoint);

  async function signedFetch(
    method: 'PUT' | 'GET',
    objectKey: string,
    body?: Uint8Array,
    contentType?: string,
  ): Promise<Response> {
    const url = urlOf(objectKey);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex(body ?? '');

    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...(contentType ? { 'content-type': contentType } : {}),
    };

    const signedHeaders = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaders.map((h) => `${h}:${headers[h] ?? ''}\n`).join('');
    const signedHeaderList = signedHeaders.join(';');

    const canonicalRequest = [
      method,
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaderList,
      payloadHash,
    ].join('\n');

    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signature = hmac(signingKey(secretKey, dateStamp, region), stringToSign).toString('hex');

    return fetchImpl(url, {
      method,
      headers: {
        ...headers,
        Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaderList}, Signature=${signature}`,
      },
      // Uint8Array 는 lib.dom 의 BodyInit 이 아니므로 Blob 으로 감싼다.
      ...(body ? { body: new Blob([new Uint8Array(body)]) } : {}),
    });
  }

  return {
    async put(objectKey, body, mimeType) {
      const response = await signedFetch('PUT', objectKey, body, mimeType);
      if (!response.ok) {
        // 응답 본문을 올리지 않는다 — 서명·자격증명이 에코될 수 있다 (NFR-16).
        throw new Error(`오브젝트 스토리지 업로드 실패 (${response.status})`);
      }
    },

    async get(objectKey) {
      const response = await signedFetch('GET', objectKey);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`오브젝트 스토리지 조회 실패 (${response.status})`);
      return {
        body: new Uint8Array(await response.arrayBuffer()),
        mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
      };
    },
  };
}
