/**
 * _shared/webauthn.ts
 *
 * Pure WebAuthn cryptographic helpers for ICMS Edge Functions.
 * Uses only the Web Crypto API (available natively in Deno — no npm packages needed).
 *
 * Supports ES256 (alg: -7, ECDSA P-256), which covers 99%+ of real-world
 * authenticators (Android, iOS, Windows Hello, YubiKey).
 */

// ─── Encoding ────────────────────────────────────────────────────────────────

/** Encode a Uint8Array as a base64url string (no padding). */
export function encodeBase64url(buf: Uint8Array): string {
  let binary = '';
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Decode a base64url string (with or without padding) into a Uint8Array. */
export function decodeBase64url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padLen));
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

// ─── Challenge Generation ─────────────────────────────────────────────────────

/** Generate a cryptographically random 32-byte challenge as base64url. */
export function generateChallenge(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return encodeBase64url(bytes);
}

// ─── COSE Public Key Parsing ──────────────────────────────────────────────────

/**
 * Parse a COSE-encoded ES256 public key (CBOR map) stored as base64url.
 * Returns a CryptoKey suitable for `crypto.subtle.verify()`.
 *
 * COSE key map (RFC 8152):
 *  1  (kty)  = 2 (EC2)
 *  3  (alg)  = -7 (ES256)
 * -1  (crv)  = 1 (P-256)
 * -2  (x)    = x coordinate (32 bytes)
 * -3  (y)    = y coordinate (32 bytes)
 */
export async function parseCoseKey(publicKeyCoseBase64url: string): Promise<CryptoKey> {
  const bytes = decodeBase64url(publicKeyCoseBase64url);

  // Walk the CBOR map to extract x and y.
  // CBOR map header for 5-element map: 0xa5
  // We do minimal CBOR parsing — just enough for ES256 P-256 keys.
  const x = extractCoseParam(bytes, -2); // x coordinate
  const y = extractCoseParam(bytes, -3); // y coordinate

  if (!x || !y) {
    throw new Error('Unable to extract EC coordinates from COSE key');
  }

  // Build uncompressed EC point: 0x04 || x || y
  const rawKey = new Uint8Array(65);
  rawKey[0] = 0x04;
  rawKey.set(x, 1);
  rawKey.set(y, 33);

  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
}

/**
 * Minimal CBOR integer key extractor.
 * Finds a negative integer key in a CBOR map and returns its byte-string value.
 */
function extractCoseParam(cbor: Uint8Array, key: number): Uint8Array | null {
  // We scan byte-by-byte for the CBOR encoding of our integer key.
  // Negative int n is encoded as 0x20 + (-1 - n) for values -1..-24, or
  // 0x38, <uint8> for -25..-256, etc.
  let keyByte: number;
  if (key >= -24 && key <= -1) {
    keyByte = 0x20 + (-1 - key); // e.g. -2 → 0x21, -3 → 0x22
  } else {
    return null; // unsupported for this minimal parser
  }

  for (let i = 0; i < cbor.length - 1; i++) {
    if (cbor[i] === keyByte) {
      const nextByte = cbor[i + 1];
      // bstr (byte string) header: 0x40–0x57 for length 0–23, or 0x58,len for longer
      if (nextByte >= 0x40 && nextByte <= 0x57) {
        const len = nextByte - 0x40;
        return cbor.slice(i + 2, i + 2 + len);
      } else if (nextByte === 0x58) {
        const len = cbor[i + 2];
        return cbor.slice(i + 3, i + 3 + len);
      }
    }
  }
  return null;
}

// ─── Authenticator Data Parsing ───────────────────────────────────────────────

export interface ParsedAuthData {
  rpIdHash: Uint8Array;         // 32 bytes
  flags: number;                // bitfield: UP=0x01, UV=0x04, AT=0x40
  signCount: number;            // 4 bytes, big-endian
  credentialId?: Uint8Array;    // present when AT flag set (registration)
  credentialPublicKey?: Uint8Array; // present when AT flag set (COSE key bytes)
}

/** Parse the raw authenticatorData bytes from a WebAuthn response. */
export function parseAuthData(authData: Uint8Array): ParsedAuthData {
  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32];
  const signCount = new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0, false);

  let credentialId: Uint8Array | undefined;
  let credentialPublicKey: Uint8Array | undefined;

  const AT_FLAG = 0x40;
  if (flags & AT_FLAG) {
    // Attested credential data present (registration)
    // aaguid: 16 bytes at offset 37
    const credIdLen = new DataView(authData.buffer, authData.byteOffset + 53, 2).getUint16(0, false);
    credentialId = authData.slice(55, 55 + credIdLen);
    credentialPublicKey = authData.slice(55 + credIdLen);
  }

  return { rpIdHash, flags, signCount, credentialId, credentialPublicKey };
}

// ─── Signature Verification ───────────────────────────────────────────────────

/**
 * Parse an ASN.1 DER-encoded ECDSA signature and return a raw 64-byte r||s (IEEE P1363)
 * required by Web Crypto.
 */
function parseEcdsaSignature(signature: Uint8Array): Uint8Array {
  // If it's already exactly 64 bytes, it might be raw P1363 (though browsers usually send DER)
  if (signature.length === 64) {
    return signature;
  }

  // Basic DER parser for SEQUENCE { r INTEGER, s INTEGER }
  // 0x30 = SEQUENCE
  if (signature[0] !== 0x30) throw new Error('Signature is not a DER SEQUENCE');

  let offset = 2; // skip SEQUENCE and length (assuming length < 128 for ES256)
  if (signature[1] & 0x80) {
    // long form length
    const lenBytes = signature[1] & 0x7f;
    offset += lenBytes;
  }

  // 0x02 = INTEGER (r)
  if (signature[offset++] !== 0x02) throw new Error('Expected INTEGER for r');
  let rLen = signature[offset++];
  if (rLen & 0x80) {
    const lenBytes = rLen & 0x7f;
    rLen = 0;
    for (let i = 0; i < lenBytes; i++) rLen = (rLen << 8) | signature[offset++];
  }
  const rBytes = signature.slice(offset, offset + rLen);
  offset += rLen;

  // 0x02 = INTEGER (s)
  if (signature[offset++] !== 0x02) throw new Error('Expected INTEGER for s');
  let sLen = signature[offset++];
  if (sLen & 0x80) {
    const lenBytes = sLen & 0x7f;
    sLen = 0;
    for (let i = 0; i < lenBytes; i++) sLen = (sLen << 8) | signature[offset++];
  }
  const sBytes = signature.slice(offset, offset + sLen);

  // Convert to exactly 32-byte buffers (pad left or strip leading zeros)
  const formatComponent = (comp: Uint8Array) => {
    if (comp.length === 32) return comp;
    if (comp.length > 32) {
      // Strip leading zeros (usually added in DER to prevent negative integers)
      let stripped = comp;
      while (stripped.length > 32 && stripped[0] === 0) {
        stripped = stripped.slice(1);
      }
      if (stripped.length > 32) throw new Error('Integer too large for P-256');
      const padded = new Uint8Array(32);
      padded.set(stripped, 32 - stripped.length);
      return padded;
    } else {
      // Pad with leading zeros
      const padded = new Uint8Array(32);
      padded.set(comp, 32 - comp.length);
      return padded;
    }
  };

  const r32 = formatComponent(rBytes);
  const s32 = formatComponent(sBytes);

  const rawSig = new Uint8Array(64);
  rawSig.set(r32, 0);
  rawSig.set(s32, 32);

  return rawSig;
}

/**
 * Verify an ES256 WebAuthn assertion signature.
 *
 * signedData = authenticatorData || SHA-256(clientDataJSON)
 */
export async function verifyAssertionSignature(
  publicKey: CryptoKey,
  signature: Uint8Array,
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array,
): Promise<{ valid: boolean; debug: any }> {
  let sigToVerify = signature;
  let signatureFormat = 'unknown';
  let sigError = '';

  try {
    sigToVerify = parseEcdsaSignature(signature);
    signatureFormat = sigToVerify.length === 64 ? 'P1363' : 'unknown';
  } catch (e: any) {
    sigError = e.message;
  }

  const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON));
  const signedData = new Uint8Array(authenticatorData.length + clientDataHash.length);
  signedData.set(authenticatorData, 0);
  signedData.set(clientDataHash, authenticatorData.length);

  let valid = false;
  try {
      valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        sigToVerify,
        signedData,
      );
  } catch (e) {
      valid = false;
  }

  return {
      valid,
      debug: {
          signatureFormat,
          originalSignatureLength: signature.length,
          parsedSignatureLength: sigToVerify.length,
          sigParseError: sigError,
      }
  };
}

// ─── RP ID Hash Verification ──────────────────────────────────────────────────

/** Verify that the rpIdHash in authData matches SHA-256(expectedRpId). */
export async function verifyRpIdHash(rpIdHash: Uint8Array, expectedRpId: string): Promise<boolean> {
  const expected = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expectedRpId)),
  );
  if (rpIdHash.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (rpIdHash[i] !== expected[i]) return false;
  }
  return true;
}
