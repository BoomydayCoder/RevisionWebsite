// Store each PDF byte-for-byte. PDFs are usually already compressed.
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({length: 256}, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
async function crc32(blob) {
  let crc = 0xffffffff;
  const reader = blob.stream().getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      for (const byte of chunk.value) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    }
  } finally { reader.releaseLock(); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function packetManifest(sources) {
  return sources.map((s, i) => {
    const cleaned = s.name.normalize('NFC').replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N} _-]+/gu, '-').trim().slice(0, 90) || 'notes';
    const prefix = String(i + 1).padStart(3, '0');
    return { file: `pdfs/${prefix}-${cleaned}.pdf`, originalName: s.name, sourceId: s.id };
  });
}

async function storedZip(entries) {
  if (entries.length >= 65535) throw new Error('Choose fewer PDFs for this packet.');
  const parts = [], directory = [];
  let offset = 0, directorySize = 0;
  for (const {name, contents} of entries) {
    const bytes = await contents();
    const nameBytes = encoder.encode(name);
    const size = bytes.size;
    if (offset + size + 30 + nameBytes.length >= 0xffffffff) throw new Error('Choose fewer PDFs for this packet (ZIP limit is 4 GiB).');
    const checksum = await crc32(bytes);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed to extract
    local.setUint16(6, 0x800, true); // UTF-8 filenames
    local.setUint16(12, 33, true); // 1980-01-01, the earliest ZIP date
    local.setUint32(14, checksum, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(local.buffer, nameBytes, bytes);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    // Copy version, flags, storage method, timestamps, CRC, sizes and name length.
    new Uint8Array(central.buffer, 6, 24).set(new Uint8Array(local.buffer, 4, 24));
    central.setUint32(42, offset, true);
    directory.push(central.buffer, nameBytes);
    directorySize += 46 + nameBytes.length;
    offset += 30 + nameBytes.length + size;
  }
  if (offset + directorySize + 22 >= 0xffffffff) throw new Error('Choose fewer PDFs for this packet (ZIP limit is 4 GiB).');
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end.buffer], {type: 'application/zip'});
}
export function studyPacket(manifest, instructions, readPdf) {
  const text = (name, value) => ({name, contents: () => new Blob([value], {type: 'text/plain;charset=utf-8'})});
  return storedZip([
    text('instructions.txt', instructions),
    text('sources.json', JSON.stringify(manifest, null, 2)),
    ...manifest.map(item => ({name: item.file, contents: () => readPdf(item)}))
  ]);
}
