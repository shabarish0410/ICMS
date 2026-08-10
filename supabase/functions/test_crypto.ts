import { parseCoseKey, verifyAssertionSignature, decodeBase64url, encodeBase64url } from './_shared/webauthn.ts';

// Known values for testing P-256 ES256 WebAuthn verification
// 1. A dummy COSE key in base64url (generated from a valid P-256 key)
// Example COSE key for P-256: { 1: 2, 3: -7, -1: 1, -2: x, -3: y }
const coseKeyB64u = 'pQECAyYgASFYIOWoP9q2n4d8F5H1a_P8K_h2pYvjG0b-WpXq-r5eA5x-Ilgg0jQ-f1fW4sT_uP6G0h1eP8wQ-1n3tU-z4_s0G_t3uXw';
const x = new Uint8Array([229, 168, 63, 218, 182, 159, 135, 124, 23, 145, 245, 107, 243, 252, 43, 248, 118, 165, 139, 227, 27, 70, 254, 90, 149, 234, 250, 190, 94, 3, 156, 126]);
const y = new Uint8Array([210, 52, 62, 127, 87, 214, 226, 196, 255, 184, 254, 134, 210, 29, 94, 63, 204, 16, 251, 89, 119, 181, 79, 179, 227, 251, 52, 27, 251, 119, 185, 124]);
// Wait, we need an actual valid key/signature pair to test properly. 
// Since generating one by hand in Deno requires crypto.subtle.generateKey and sign, let's just write a dynamic test that generates a key, signs a message, DER-encodes it, and verifies it.

async function testCrypto() {
    console.log("=== Running Crypto Self-Test ===");
    
    // 1. Generate a P-256 key pair
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
    );

    // 2. Export public key to COSE format (mocked since our parseCoseKey just extracts x,y)
    const exportedPub = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    
    // Manually construct a minimal CBOR map for COSE Key
    // CBOR Map 4 items: A4
    // 1(kty) -> 2(EC2) : 01 02
    // 3(alg) -> -7(ES256) : 03 26
    // -1(crv) -> 1(P256) : 20 01
    // -2(x) -> bstr32 : 21 58 20 ...
    // -3(y) -> bstr32 : 22 58 20 ...
    const xBuf = decodeBase64url(exportedPub.x!);
    const yBuf = decodeBase64url(exportedPub.y!);
    const coseKey = new Uint8Array(1 + 2 + 2 + 2 + 2 + 34 + 2 + 34);
    let offset = 0;
    coseKey[offset++] = 0xA5; // Map of 5 items
    coseKey.set([0x01, 0x02, 0x03, 0x26, 0x20, 0x01], offset); offset += 6;
    coseKey[offset++] = 0x21; coseKey[offset++] = 0x58; coseKey[offset++] = 0x20;
    coseKey.set(xBuf, offset); offset += 32;
    coseKey[offset++] = 0x22; coseKey[offset++] = 0x58; coseKey[offset++] = 0x20;
    coseKey.set(yBuf, offset); offset += 32;

    const coseKeyStr = encodeBase64url(coseKey);
    console.log("Generated Mock COSE Key:", coseKeyStr.substring(0, 20) + "...");

    // 3. Parse it back using our function
    const parsedKey = await parseCoseKey(coseKeyStr);
    console.log("COSE Key parsed successfully.");

    // 4. Create dummy clientData and authData
    const clientDataJSON = new TextEncoder().encode('{"type":"webauthn.get","challenge":"abc","origin":"https://test"}');
    const authData = new Uint8Array(37); // mock 37-byte auth data
    crypto.getRandomValues(authData);

    // 5. Hash and sign
    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON));
    const signedData = new Uint8Array(authData.length + clientDataHash.length);
    signedData.set(authData, 0);
    signedData.set(clientDataHash, authData.length);

    // WebCrypto produces raw 64-byte r||s
    const rawSignature = new Uint8Array(await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        signedData
    ));

    console.log("Generated raw signature, length:", rawSignature.length);

    // 6. Convert to DER (simulate browser behavior)
    // Strip leading zeros for r and s as required by DER integers
    const r = rawSignature.slice(0, 32);
    const s = rawSignature.slice(32, 64);
    
    function toDerInt(buf: Uint8Array): Uint8Array {
        let start = 0;
        while(start < buf.length && buf[start] === 0) start++;
        if (start === buf.length) return new Uint8Array([0x02, 0x01, 0x00]);
        let stripped = buf.slice(start);
        if (stripped[0] & 0x80) { // pad with 0x00 if highest bit is set
            const pad = new Uint8Array(stripped.length + 1);
            pad[0] = 0;
            pad.set(stripped, 1);
            stripped = pad;
        }
        const res = new Uint8Array(2 + stripped.length);
        res[0] = 0x02;
        res[1] = stripped.length;
        res.set(stripped, 2);
        return res;
    }

    const derR = toDerInt(r);
    const derS = toDerInt(s);
    const derSignature = new Uint8Array(2 + derR.length + derS.length);
    derSignature[0] = 0x30;
    derSignature[1] = derR.length + derS.length;
    derSignature.set(derR, 2);
    derSignature.set(derS, 2 + derR.length);

    console.log("Simulated DER signature, length:", derSignature.length);

    // 7. Test verification with DER signature (Should parse to raw and pass)
    const result1 = await verifyAssertionSignature(parsedKey, derSignature, authData, clientDataJSON);
    console.log("Test 1 (Valid DER Signature):", result1.valid ? "PASS" : "FAIL", result1.debug);

    // 8. Test with RAW signature (Should pass)
    const resultRaw = await verifyAssertionSignature(parsedKey, rawSignature, authData, clientDataJSON);
    console.log("Test 2 (Valid RAW Signature):", resultRaw.valid ? "PASS" : "FAIL", resultRaw.debug);

    // 9. Test modified message (Should fail)
    const badAuthData = new Uint8Array(authData);
    badAuthData[0] ^= 0xFF;
    const result2 = await verifyAssertionSignature(parsedKey, derSignature, badAuthData, clientDataJSON);
    console.log("Test 3 (Modified Message):", !result2.valid ? "PASS" : "FAIL (it passed but shouldn't have)");

    // 10. Test modified signature (Should fail)
    const badSig = new Uint8Array(derSignature);
    badSig[badSig.length - 1] ^= 0xFF;
    const result3 = await verifyAssertionSignature(parsedKey, badSig, authData, clientDataJSON);
    console.log("Test 4 (Modified Signature):", !result3.valid ? "PASS" : "FAIL (it passed but shouldn't have)");
}

testCrypto().catch(console.error);
