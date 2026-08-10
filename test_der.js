function parseEcdsaSignature(signature) {
  if (signature.length === 64) {
    return signature;
  }

  if (signature[0] !== 0x30) throw new Error('Signature is not a DER SEQUENCE');

  let offset = 2; // skip SEQUENCE and length (assuming length < 128 for ES256)
  if (signature[1] & 0x80) {
    const lenBytes = signature[1] & 0x7f;
    offset += lenBytes;
  }

  if (signature[offset++] !== 0x02) throw new Error('Expected INTEGER for r');
  let rLen = signature[offset++];
  if (rLen & 0x80) {
    const lenBytes = rLen & 0x7f;
    rLen = 0;
    for (let i = 0; i < lenBytes; i++) rLen = (rLen << 8) | signature[offset++];
  }
  const rBytes = signature.slice(offset, offset + rLen);
  offset += rLen;

  if (signature[offset++] !== 0x02) throw new Error('Expected INTEGER for s');
  let sLen = signature[offset++];
  if (sLen & 0x80) {
    const lenBytes = sLen & 0x7f;
    sLen = 0;
    for (let i = 0; i < lenBytes; i++) sLen = (sLen << 8) | signature[offset++];
  }
  const sBytes = signature.slice(offset, offset + sLen);

  const formatComponent = (comp) => {
    if (comp.length === 32) return comp;
    if (comp.length > 32) {
      let stripped = comp;
      while (stripped.length > 32 && stripped[0] === 0) {
        stripped = stripped.slice(1);
      }
      if (stripped.length > 32) throw new Error('Integer too large for P-256');
      const padded = new Uint8Array(32);
      padded.set(stripped, 32 - stripped.length);
      return padded;
    } else {
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

// Example DER signature for testing
const derSig = new Uint8Array([
  0x30, 0x45, 
  0x02, 0x21, 0x00, 0xbd, 0xc1, 0x3d, 0x11, 0xc4, 0x35, 0x67, 0x89, 0x0a, 0xbc, 0xde, 0xf0, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0x0a, 0xbc, 0xde, 0xf0, 0x12, 0x34, 0x56, 
  0x02, 0x20, 0xbd, 0xc1, 0x3d, 0x11, 0xc4, 0x35, 0x67, 0x89, 0x0a, 0xbc, 0xde, 0xf0, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0x0a, 0xbc, 0xde, 0xf0, 0x12, 0x34, 0x56
]);

const parsed = parseEcdsaSignature(derSig);
console.log("Parsed length:", parsed.length);
console.log("First byte of R:", parsed[0].toString(16));
