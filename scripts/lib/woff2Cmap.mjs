import fs from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';

// WOFF2's known-tag table. cmap is untransformed, so checking coverage does
// not require a native decoder or Python in the normal test pipeline.
const tags = ['cmap','head','hhea','hmtx','maxp','name','OS/2','post','cvt ','fpgm','glyf','loca','prep','CFF ','VORG','EBDT','EBLC','gasp','hdmx','kern','LTSH','PCLT','VDMX','vhea','vmtx','BASE','GDEF','GPOS','GSUB','EBSC','JSTF','MATH','CBDT','CBLC','COLR','CPAL','SVG ','sbix','acnt','avar','bdat','bloc','bsln','cvar','fdsc','feat','fmtx','fvar','gvar','hsty','just','lcar','mort','morx','opbd','prop','trak','Zapf','Silf','Glat','Gloc','Feat','Sill'];

export function cmap(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 0, 4) !== 'wOF2') throw Error(`Not a WOFF2 font: ${file}`);
  let cursor = 48;
  function uintBase128() {
    let result = 0;
    for (let i = 0; i < 5; i++) {
      const byte = buffer[cursor++];
      result = result * 128 + (byte & 127);
      if (!(byte & 128)) return result;
    }
    throw Error('Invalid WOFF2 table length');
  }
  const tables = [];
  for (let i = 0; i < buffer.readUInt16BE(12); i++) {
    const flags = buffer[cursor++];
    let tag = tags[flags & 63];
    if ((flags & 63) === 63) {
      tag = buffer.toString('ascii', cursor, cursor + 4);
      cursor += 4;
    }
    const length = uintBase128(), version = flags >> 6;
    const transformed = ['glyf', 'loca'].includes(tag) ? version !== 3 : version !== 0;
    if (tag === 'cmap' && transformed) throw Error('Unsupported transformed cmap');
    tables.push({ tag, length: transformed ? uintBase128() : length });
  }
  const raw = brotliDecompressSync(buffer.subarray(cursor, cursor + buffer.readUInt32BE(20)));
  let offset = 0, table;
  for (const entry of tables) {
    if (entry.tag === 'cmap') table = raw.subarray(offset, offset + entry.length);
    offset += entry.length;
  }
  if (!table) throw Error('Missing cmap');
  const chars = new Set();
  for (let i = 0; i < table.readUInt16BE(2); i++) {
    const record = 4 + i * 8;
    const platform = table.readUInt16BE(record), encoding = table.readUInt16BE(record + 2);
    if (platform !== 0 && !(platform === 3 && [1, 10].includes(encoding))) continue;
    const start = table.readUInt32BE(record + 4), format = table.readUInt16BE(start);
    if (format === 12) {
      for (let group = 0; group < table.readUInt32BE(start + 12); group++) {
        const at = start + 16 + group * 12;
        const lo = table.readUInt32BE(at), hi = table.readUInt32BE(at + 4), glyph = table.readUInt32BE(at + 8);
        for (let cp = lo; cp <= hi; cp++) if (glyph + cp - lo) chars.add(cp);
      }
    } else if (format === 4) {
      const count = table.readUInt16BE(start + 6) / 2;
      const ends = start + 14, starts = ends + 2 * count + 2;
      const deltas = starts + 2 * count, ranges = deltas + 2 * count;
      for (let segment = 0; segment < count; segment++) {
        const lo = table.readUInt16BE(starts + 2 * segment), hi = table.readUInt16BE(ends + 2 * segment);
        const delta = table.readInt16BE(deltas + 2 * segment), range = table.readUInt16BE(ranges + 2 * segment);
        for (let cp = lo; cp <= hi; cp++) {
          const glyph = range ? table.readUInt16BE(ranges + 2 * segment + range + 2 * (cp - lo)) : cp;
          if ((range ? glyph !== 0 : true) && ((glyph + delta) & 65535)) chars.add(cp);
        }
      }
    }
  }
  if (!chars.size) throw Error('No supported Unicode cmap');
  return chars;
}
