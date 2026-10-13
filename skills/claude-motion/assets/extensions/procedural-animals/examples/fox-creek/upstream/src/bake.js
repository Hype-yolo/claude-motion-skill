// .animal bake files: a built individual, stored so it loads instantly (no SDF meshing, no weights).
// Layout: "PANM" | u32 version | u32 headerBytes | header JSON (utf-8, padded to 8) | array blobs (8-aligned)
import { ARRAY_KEYS, FORMAT_VERSION } from './core/build/pipeline.js';

const TYPES = { Float32Array, Uint32Array, Uint16Array, Int16Array, Uint8Array, Int8Array, Int32Array };

export function writeBake(data) {
  const header = {};
  for (const [k, v] of Object.entries(data)) if (!ARRAY_KEYS.includes(k)) header[k] = v;
  header.arrays = [];
  let offset = 0;
  for (const k of ARRAY_KEYS) {
    const a = data[k];
    header.arrays.push({ key: k, type: a.constructor.name, length: a.length, offset });
    offset += Math.ceil(a.byteLength / 8) * 8;
  }
  let json = new TextEncoder().encode(JSON.stringify(header));
  const hb = Math.ceil((json.length) / 8) * 8;
  const total = 12 + hb + offset;
  const buf = new ArrayBuffer(Math.ceil(total / 8) * 8 + 8);
  const u8 = new Uint8Array(buf);
  u8.set([80, 65, 78, 77], 0); // "PANM"
  const dv = new DataView(buf);
  dv.setUint32(4, FORMAT_VERSION, true);
  dv.setUint32(8, hb, true);
  u8.set(json, 12);
  for (let i = 12 + json.length; i < 12 + hb; i++) u8[i] = 32;
  const base = 16 + hb - ((16 + hb) % 8 === 0 ? 0 : (16 + hb) % 8) ;
  // blobs start at an 8-aligned offset after the header
  const start = align8(12 + hb);
  for (const a of header.arrays) u8.set(new Uint8Array(data[a.key].buffer, data[a.key].byteOffset, data[a.key].byteLength), start + a.offset);
  void base;
  return buf.slice(0, start + offset);
}

export function readBake(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] !== 80 || u8[1] !== 65 || u8[2] !== 78 || u8[3] !== 77) throw new Error('not a .animal file');
  const dv = new DataView(buf);
  const version = dv.getUint32(4, true);
  if (version !== FORMAT_VERSION) throw new Error(`.animal version ${version} is not supported (expected ${FORMAT_VERSION})`);
  const hb = dv.getUint32(8, true);
  const header = JSON.parse(new TextDecoder().decode(u8.subarray(12, 12 + hb)));
  const start = align8(12 + hb);
  const data = { ...header };
  for (const a of header.arrays) data[a.key] = new TYPES[a.type](buf, start + a.offset, a.length);
  delete data.arrays;
  return data;
}

const align8 = (n) => Math.ceil(n / 8) * 8;
