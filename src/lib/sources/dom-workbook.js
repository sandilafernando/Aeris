import { inflateRawSync } from "node:zlib";
import * as cheerio from "cheerio";

/**
 * The Department of Meteorology publishes its 3-hourly station table as an
 * Excel workbook. The public page renders a small HTML subset of this table,
 * but the workbook is the authoritative feed used by the Department's own
 * `script.js`, and it is the only published source that includes the WMO
 * station identifiers, wind, pressure, cloud cover, and dew point.
 *
 * This module deliberately implements a very small, read-only XLSX reader
 * instead of pulling in a general spreadsheet library. The workbook is tiny,
 * public, and has a stable shape, while a general parser would add a large
 * dependency and a wider attack surface for a server route.
 */
export const SRI_LANKA_DOM_WORKBOOK_URL =
  "https://meteo.gov.lk/excels/3hourly.xlsx";

export const DOM_WORKBOOK_MAX_BYTES = 8 * 1024 * 1024;
export const DOM_WORKBOOK_MAX_XML_BYTES = 4 * 1024 * 1024;
export const DOM_WORKBOOK_MAX_ENTRIES = 512;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT_SIZE = 65_535;

const HEADER_ALIASES = Object.freeze({
  stationid: "stationId",
  stationname: "stationName",
  reporttime: "reportTime",
  rainfallmm: "rainfall3hMm",
  totrfsince830am: "rainfallSince0830Mm",
  temperaturec: "temperatureC",
  rh: "relativeHumidity",
  weathertype: "weatherType",
  winddirection: "windDirection",
  windspeedkmh1: "windSpeedKmh",
  cloudcover: "cloudCoverOktas",
  mslp: "pressureHpa",
  dewpoint: "dewPointC",
});

export const DOM_WORKBOOK_HEADERS = Object.freeze([
  "stationId",
  "stationName",
  "reportTime",
  "rainfall3hMm",
  "rainfallSince0830Mm",
  "temperatureC",
  "relativeHumidity",
  "weatherType",
  "windDirection",
  "windSpeedKmh",
  "cloudCoverOktas",
  "pressureHpa",
  "dewPointC",
]);

export class DomWorkbookError extends Error {
  constructor(message, code = "workbook") {
    super(message);
    this.name = "DomWorkbookError";
    this.code = code;
  }
}

function asBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  throw new DomWorkbookError(
    "The official workbook response was not binary data.",
    "invalid-buffer",
  );
}

function readUInt16LE(buffer, offset) {
  if (offset < 0 || offset + 2 > buffer.length) {
    throw new DomWorkbookError("The official workbook has a truncated header.", "truncated");
  }
  return buffer.readUInt16LE(offset);
}

function readUInt32LE(buffer, offset) {
  if (offset < 0 || offset + 4 > buffer.length) {
    throw new DomWorkbookError("The official workbook has a truncated header.", "truncated");
  }
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer) {
  const earliest = Math.max(0, buffer.length - EOCD_MIN_SIZE - MAX_COMMENT_SIZE);
  for (let offset = buffer.length - EOCD_MIN_SIZE; offset >= earliest; offset -= 1) {
    if (readUInt32LE(buffer, offset) !== EOCD_SIGNATURE) continue;
    const commentLength = readUInt16LE(buffer, offset + 20);
    if (offset + EOCD_MIN_SIZE + commentLength <= buffer.length) return offset;
  }
  return -1;
}

/**
 * Read the ZIP archive entries from an XLSX container. Only the storage and
 * deflate methods used by Office are supported. Every size is bounded before
 * decompression so a malformed upstream response cannot exhaust memory.
 */
export function readZipEntries(input) {
  const buffer = asBuffer(input);
  if (buffer.length < EOCD_MIN_SIZE) {
    throw new DomWorkbookError("The official workbook is too small to be valid.", "truncated");
  }
  if (buffer.length > DOM_WORKBOOK_MAX_BYTES) {
    throw new DomWorkbookError("The official workbook exceeds the size limit.", "too-large");
  }

  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) {
    throw new DomWorkbookError("The official workbook is not a readable ZIP archive.", "not-zip");
  }

  const entryCount = readUInt16LE(buffer, eocdOffset + 10);
  const centralOffset = readUInt32LE(buffer, eocdOffset + 16);
  if (entryCount === 0 || entryCount > DOM_WORKBOOK_MAX_ENTRIES) {
    throw new DomWorkbookError("The official workbook has an unsupported entry count.", "entry-count");
  }
  if (centralOffset < 0 || centralOffset >= eocdOffset) {
    throw new DomWorkbookError("The official workbook has an invalid central directory.", "bad-directory");
  }

  const entries = new Map();
  let offset = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32LE(buffer, offset) !== CENTRAL_SIGNATURE) {
      throw new DomWorkbookError("The official workbook has a corrupt entry.", "bad-entry");
    }

    const flags = readUInt16LE(buffer, offset + 8);
    const method = readUInt16LE(buffer, offset + 10);
    const compressedSize = readUInt32LE(buffer, offset + 20);
    const uncompressedSize = readUInt32LE(buffer, offset + 24);
    const nameLength = readUInt16LE(buffer, offset + 28);
    const extraLength = readUInt16LE(buffer, offset + 30);
    const commentLength = readUInt16LE(buffer, offset + 32);
    const localOffset = readUInt32LE(buffer, offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) {
      throw new DomWorkbookError("The official workbook entry name is truncated.", "truncated");
    }

    const name = buffer.subarray(nameStart, nameEnd).toString("utf8");
    offset = nameEnd + extraLength + commentLength;
    if (offset > buffer.length) {
      throw new DomWorkbookError("The official workbook directory is truncated.", "truncated");
    }

    if (!name || name.endsWith("/")) continue;
    if (flags & 0x1) {
      throw new DomWorkbookError("Encrypted workbooks are not supported.", "encrypted");
    }
    if (uncompressedSize > DOM_WORKBOOK_MAX_XML_BYTES) {
      throw new DomWorkbookError("The official workbook entry is too large.", "too-large");
    }
    if (compressedSize > DOM_WORKBOOK_MAX_BYTES || compressedSize > buffer.length) {
      throw new DomWorkbookError("The official workbook entry is invalid.", "bad-entry");
    }

    if (readUInt32LE(buffer, localOffset) !== LOCAL_SIGNATURE) {
      throw new DomWorkbookError("The official workbook local header is corrupt.", "bad-entry");
    }
    const localNameLength = readUInt16LE(buffer, localOffset + 26);
    const localExtraLength = readUInt16LE(buffer, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length || dataStart < 0) {
      throw new DomWorkbookError("The official workbook data is truncated.", "truncated");
    }

    const compressed = buffer.subarray(dataStart, dataEnd);
    let data;
    if (method === 0) {
      data = Buffer.from(compressed);
    } else if (method === 8) {
      try {
        data = inflateRawSync(compressed, {
          maxOutputLength: DOM_WORKBOOK_MAX_XML_BYTES,
        });
      } catch {
        throw new DomWorkbookError("The official workbook could not be decompressed.", "inflate");
      }
    } else {
      throw new DomWorkbookError("The official workbook uses an unsupported compression method.", "compression");
    }

    if (uncompressedSize > 0 && data.length !== uncompressedSize) {
      throw new DomWorkbookError("The official workbook entry size does not match.", "size-mismatch");
    }
    entries.set(name, data);
  }

  return entries;
}

function readTextEntry(entries, name) {
  const data = entries.get(name);
  if (!data) return null;
  if (data.length > DOM_WORKBOOK_MAX_XML_BYTES) {
    throw new DomWorkbookError("The official workbook XML entry is too large.", "too-large");
  }
  return data.toString("utf8");
}

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizePartPath(base, target) {
  const raw = String(target || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw.slice(1);
  if (raw.startsWith("xl/")) return raw;
  return `${base}${raw}`;
}

export function findWorkbookSheetPath(entries) {
  const workbookXml = readTextEntry(entries, "xl/workbook.xml");
  const relsXml = readTextEntry(entries, "xl/_rels/workbook.xml.rels");

  if (workbookXml && relsXml) {
    const workbook = cheerio.load(workbookXml, { xmlMode: true });
    const relationships = cheerio.load(relsXml, { xmlMode: true });
    const targets = new Map();
    relationships("Relationship").each((_, element) => {
      const id = element.attribs?.Id;
      const target = element.attribs?.Target;
      if (id && target) targets.set(id, normalizePartPath("xl/", target));
    });

    let firstVisible = null;
    let firstAny = null;
    workbook("sheet").each((_, element) => {
      const state = element.attribs?.state || "visible";
      const relationshipId =
        element.attribs?.["r:id"] || element.attribs?.id || null;
      const target = relationshipId ? targets.get(relationshipId) : null;
      const candidate = target || null;
      if (!candidate) return;
      if (!firstAny) firstAny = { path: candidate, name: element.attribs?.name || "" };
      if (!firstVisible && state === "visible") {
        firstVisible = { path: candidate, name: element.attribs?.name || "" };
      }
    });

    if (firstVisible) return firstVisible;
    if (firstAny) return firstAny;
  }

  const names = [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => {
      const first = Number(/(\d+)\.xml$/.exec(a)?.[1] || 0);
      const second = Number(/(\d+)\.xml$/.exec(b)?.[1] || 0);
      return first - second;
    });
  if (names.length) return { path: names[0], name: "" };
  return null;
}

export function readSharedStrings(entries) {
  const xml = readTextEntry(entries, "xl/sharedStrings.xml");
  if (!xml) return [];
  const $ = cheerio.load(xml, { xmlMode: true });
  const strings = [];
  $("si").each((_, element) => {
    const text = $(element)
      .find("t")
      .toArray()
      .map((node) => $(node).text())
      .join("");
    strings.push(text);
  });
  return strings;
}

function cellValue($, cell, sharedStrings) {
  const type = cell.attribs?.t || "n";
  const raw =
    type === "inlineStr"
      ? $(cell).find("is t").toArray().map((node) => $(node).text()).join("")
      : $(cell).find("v").first().text();

  if (raw === "") return null;
  if (type === "s") {
    const index = Number(raw);
    return Number.isInteger(index) ? sharedStrings[index] ?? null : null;
  }
  if (type === "str" || type === "inlineStr") return raw;
  if (type === "b") return raw === "1";
  if (type === "e") return null;

  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : raw;
}

function parseNullableNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text || /^(na|n\/a|null|-|—)$/i.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCloudCover(value) {
  const parsed = parseNullableNumber(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded >= 0 && rounded <= 8 ? rounded : null;
}

function parseStationIdentifier(value) {
  const text = String(value ?? "").trim();
  return /^\d{3,6}$/.test(text) ? text : null;
}

/**
 * Parse the first visible worksheet into a header map and typed rows. Rows
 * without a station identifier and name are skipped and counted so a changed
 * upstream layout produces a clear diagnostic rather than empty data.
 */
export function parseWorkbookRows(input) {
  const entries = readZipEntries(input);
  const sheet = findWorkbookSheetPath(entries);
  if (!sheet) {
    throw new DomWorkbookError("The official workbook has no worksheet.", "no-sheet");
  }

  const sheetXml = readTextEntry(entries, sheet.path);
  if (!sheetXml) {
    throw new DomWorkbookError("The official workbook sheet could not be read.", "no-sheet");
  }

  const sharedStrings = readSharedStrings(entries);
  const $ = cheerio.load(sheetXml, { xmlMode: true });
  const rows = [];
  let header = null;
  let headerRowIndex = -1;
  let invalidRows = 0;

  $("row").each((rowIndex, rowElement) => {
    const cells = {};
    $(rowElement)
      .children("c")
      .each((_, cell) => {
        const reference = cell.attribs?.r || "";
        const column = /^([A-Z]+)/.exec(reference)?.[1] || null;
        if (!column) return;
        cells[column] = cellValue($, cell, sharedStrings);
      });

    if (!header) {
      const candidate = {};
      for (const [column, value] of Object.entries(cells)) {
        const key = HEADER_ALIASES[normalizeHeader(value)];
        if (key) candidate[key] = column;
      }
      if (candidate.stationId && candidate.stationName) {
        header = candidate;
        headerRowIndex = rowIndex;
      }
      return;
    }

    const hasValue = Object.values(cells).some(
      (value) => value != null && String(value).trim() !== "",
    );
    if (!hasValue) return;

    const stationName = String(cells[header.stationName] ?? "").trim();
    const stationId = parseStationIdentifier(cells[header.stationId]);
    if (!stationName || !stationId) {
      invalidRows += 1;
      return;
    }

    const record = {
      stationId,
      stationName,
      reportTime:
        cells[header.reportTime] == null
          ? null
          : String(cells[header.reportTime]).trim() || null,
      rainfall3hMm: parseNullableNumber(cells[header.rainfall3hMm]),
      rainfallSince0830Mm: parseNullableNumber(cells[header.rainfallSince0830Mm]),
      temperatureC: parseNullableNumber(cells[header.temperatureC]),
      relativeHumidity: parseNullableNumber(cells[header.relativeHumidity]),
      weatherType:
        cells[header.weatherType] == null
          ? null
          : String(cells[header.weatherType]).trim() || null,
      windDirection:
        cells[header.windDirection] == null
          ? null
          : String(cells[header.windDirection]).trim().toUpperCase() || null,
      windSpeedKmh: parseNullableNumber(cells[header.windSpeedKmh]),
      cloudCoverOktas: parseCloudCover(cells[header.cloudCoverOktas]),
      pressureHpa: parseNullableNumber(cells[header.pressureHpa]),
      dewPointC: parseNullableNumber(cells[header.dewPointC]),
    };
    rows.push(record);
  });

  if (!header) {
    throw new DomWorkbookError(
      "The official workbook does not contain the expected station header.",
      "unexpected-layout",
    );
  }
  if (rows.length === 0) {
    throw new DomWorkbookError(
      "The official workbook contains no readable station rows.",
      "no-stations",
    );
  }

  return {
    rows,
    rowCount: rows.length,
    invalidRows,
    headerRowIndex,
    sheetName: sheet.name || "Sheet1",
    sheetPath: sheet.path,
  };
}

export function parseDomWorkbook(input) {
  const parsed = parseWorkbookRows(input);
  return {
    ...parsed,
    sourceUrl: SRI_LANKA_DOM_WORKBOOK_URL,
  };
}
