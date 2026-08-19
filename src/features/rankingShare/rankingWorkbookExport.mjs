import {
  formatRankingMetricValue,
  getRankingColumnLabel,
  getRankingCriteria,
} from "../../domain/rankingCriteria.mjs";
import { TORNEIO360_LOGO, loadShareImage } from "../media/canvasTools.mjs";

const textEncoder = new TextEncoder();

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeFileName(value, fallback = "ranking") {
  const normalized = String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || fallback;
}

function safeSheetName(value, fallback = "Ranking") {
  const normalized = String(value || fallback).replace(/[\\/*?:\[\]]/g, " ").trim();
  return (normalized || fallback).slice(0, 31);
}

function columnName(index) {
  let value = Number(index) + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function inlineStringCell(reference, value, style = 0) {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numericCell(reference, value, style = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized)
    ? `<c r="${reference}" t="n" s="${style}"><v>${normalized}</v></c>`
    : inlineStringCell(reference, formatRankingMetricValue("", value), style);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);

  entries.forEach(({ name, data }) => {
    const nameBytes = textEncoder.encode(name);
    const dataBytes = typeof data === "string" ? textEncoder.encode(data) : new Uint8Array(data);
    const checksum = crc32(dataBytes);
    const localHeader = new ArrayBuffer(30);
    const localView = new DataView(localHeader);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localParts.push(localHeader, nameBytes, dataBytes);

    const centralHeader = new ArrayBuffer(46);
    const centralView = new DataView(centralHeader);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.byteLength + nameBytes.length + dataBytes.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new ArrayBuffer(22);
  const endView = new DataView(end);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);
  return new Blob([...localParts, ...centralParts, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function imageUrlToPng(url) {
  if (!url) return null;
  try {
    const image = await loadShareImage(url);
    if (!image) return null;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.94));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch (error) {
    console.warn("Não foi possível incluir uma imagem na planilha.", error);
    return null;
  }
}

function createStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="18"/><name val="Arial"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font>
    <font><b/><color rgb="FF101A35"/><sz val="12"/><name val="Arial"/></font>
    <font><b/><color rgb="FFD97706"/><sz val="11"/><name val="Arial"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF07163E"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF24368F"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEDF3FB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF4C2"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF7F9FC"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2"><border/><border><left style="thin"><color rgb="FFD9E2EF"/></left><right style="thin"><color rgb="FFD9E2EF"/></right><top style="thin"><color rgb="FFD9E2EF"/></top><bottom style="thin"><color rgb="FFD9E2EF"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function createWorksheetXml({ config, group, columns, hasDrawing }) {
  const totalColumns = Math.max(2, columns.length + 2);
  const lastColumn = columnName(totalColumns - 1);
  const rows = [];
  rows.push(`<row r="1" ht="68" customHeight="1">${inlineStringCell("A1", "TORNEIO360", 1)}${inlineStringCell(`${lastColumn}1`, config.arenaName || "Arena Torneio360", 8)}</row>`);
  rows.push(`<row r="2" ht="25" customHeight="1">${inlineStringCell("A2", config.title || "Ranking do circuito", 1)}</row>`);
  rows.push(`<row r="3" ht="20" customHeight="1">${inlineStringCell("A3", config.subtitle || group.title || "Ranking", 8)}</row>`);
  rows.push(`<row r="4" ht="30" customHeight="1">${inlineStringCell("A4", `Critérios: ${config.criteriaLabel || "Ranking Torneio360"}`, 3)}</row>`);
  rows.push(`<row r="6" ht="25" customHeight="1">${inlineStringCell("A6", group.title || "Ranking", 3)}</row>`);
  const headers = ["#", "Nome", ...columns.map(({ key, label }) => label || getRankingColumnLabel(key))];
  rows.push(`<row r="7" ht="34" customHeight="1">${headers.map((header, index) => inlineStringCell(`${columnName(index)}7`, header, 2)).join("")}</row>`);

  group.rows.forEach((entry, index) => {
    const rowNumber = index + 8;
    const rowStyle = index === 0 ? 5 : index % 2 === 0 ? 6 : 4;
    const cells = [
      inlineStringCell(`A${rowNumber}`, `${index + 1}º`, index === 0 ? 5 : 7),
      inlineStringCell(`B${rowNumber}`, entry.name || "Sem nome", rowStyle),
      ...columns.map(({ key }, columnIndex) => {
        const reference = `${columnName(columnIndex + 2)}${rowNumber}`;
        const value = entry[key];
        return typeof value === "number" && key !== "playTimeSeconds"
          ? numericCell(reference, value, index === 0 ? 5 : 7)
          : inlineStringCell(reference, formatRankingMetricValue(key, value), index === 0 ? 5 : 7);
      }),
    ];
    rows.push(`<row r="${rowNumber}" ht="25" customHeight="1">${cells.join("")}</row>`);
  });

  const merges = [`A1:${Math.max(1, totalColumns - 2) > 1 ? columnName(totalColumns - 3) : "A"}1`, `A2:${lastColumn}2`, `A3:${lastColumn}3`, `A4:${lastColumn}4`, `A6:${lastColumn}6`];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="2" width="36" customWidth="1"/><col min="3" max="${totalColumns}" width="19" customWidth="1"/></cols>
  <sheetData>${rows.join("")}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((reference) => `<mergeCell ref="${reference}"/>`).join("")}</mergeCells>
  <autoFilter ref="A7:${lastColumn}${Math.max(7, group.rows.length + 7)}"/>
  <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
  ${hasDrawing ? '<drawing r:id="rId1"/>' : ""}
</worksheet>`;
}

function createDrawingXml(hasLogo, hasArenaPhoto) {
  const anchors = [];
  let relationshipIndex = 1;
  if (hasLogo) {
    anchors.push(`<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>2</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${relationshipIndex}" name="Logo Torneio360"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${relationshipIndex}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`);
    relationshipIndex += 1;
  }
  if (hasArenaPhoto) {
    anchors.push(`<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${relationshipIndex}" name="Foto da arena"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${relationshipIndex}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors.join("")}</xdr:wsDr>`;
}

async function createRankingWorkbook(config) {
  const groups = (Array.isArray(config?.workbookGroups) ? config.workbookGroups : config?.groups || [])
    .filter((group) => Array.isArray(group?.rows) && group.rows.length > 0);
  if (groups.length === 0) throw new Error("Não há dados para exportar na planilha.");
  const criteria = getRankingCriteria(config?.rankingCriteria);
  const columns = Array.isArray(config?.workbookColumns) && config.workbookColumns.length
    ? config.workbookColumns
    : Array.isArray(config?.columns) && config.columns.length
      ? config.columns
      : criteria.order.map((key) => ({ key, label: getRankingColumnLabel(key) }));
  const [logoBytes, arenaPhotoBytes] = await Promise.all([
    imageUrlToPng(TORNEIO360_LOGO),
    imageUrlToPng(config?.arenaPhotoUrl),
  ]);
  const hasImages = Boolean(logoBytes || arenaPhotoBytes);
  const entries = [];
  const contentTypeOverrides = [];
  const workbookSheets = [];
  const workbookRelationships = [];

  groups.forEach((group, index) => {
    const sheetNumber = index + 1;
    const sheetName = safeSheetName(group.title, `Ranking ${sheetNumber}`);
    workbookSheets.push(`<sheet name="${escapeXml(sheetName)}" sheetId="${sheetNumber}" r:id="rId${sheetNumber}"/>`);
    workbookRelationships.push(`<Relationship Id="rId${sheetNumber}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetNumber}.xml"/>`);
    entries.push({
      name: `xl/worksheets/sheet${sheetNumber}.xml`,
      data: createWorksheetXml({ config, group, columns, hasDrawing: hasImages }),
    });
    contentTypeOverrides.push(`<Override PartName="/xl/worksheets/sheet${sheetNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    if (hasImages) {
      entries.push({
        name: `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`,
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${sheetNumber}.xml"/></Relationships>`,
      });
      entries.push({ name: `xl/drawings/drawing${sheetNumber}.xml`, data: createDrawingXml(Boolean(logoBytes), Boolean(arenaPhotoBytes)) });
      const imageRelationships = [];
      let imageRelationshipIndex = 1;
      if (logoBytes) {
        imageRelationships.push(`<Relationship Id="rId${imageRelationshipIndex}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/>`);
        imageRelationshipIndex += 1;
      }
      if (arenaPhotoBytes) {
        imageRelationships.push(`<Relationship Id="rId${imageRelationshipIndex}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/arena.png"/>`);
      }
      entries.push({
        name: `xl/drawings/_rels/drawing${sheetNumber}.xml.rels`,
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${imageRelationships.join("")}</Relationships>`,
      });
      contentTypeOverrides.push(`<Override PartName="/xl/drawings/drawing${sheetNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
    }
  });

  workbookRelationships.push(`<Relationship Id="rId${groups.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);
  if (logoBytes) entries.push({ name: "xl/media/logo.png", data: logoBytes });
  if (arenaPhotoBytes) entries.push({ name: "xl/media/arena.png", data: arenaPhotoBytes });
  entries.push(
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${hasImages ? '<Default Extension="png" ContentType="image/png"/>' : ""}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${contentTypeOverrides.join("")}</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    },
    {
      name: "docProps/app.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Torneio360</Application><AppVersion>1.0</AppVersion></Properties>`,
    },
    {
      name: "docProps/core.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(config?.title || "Ranking Torneio360")}</dc:title><dc:creator>Torneio360</dc:creator><cp:lastModifiedBy>Torneio360</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`,
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${workbookSheets.join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelationships.join("")}</Relationships>`,
    },
    { name: "xl/styles.xml", data: createStylesXml() },
  );

  return createZip(entries);
}

async function downloadRankingWorkbook(config) {
  const blob = await createRankingWorkbook(config);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(config?.workbookTitle || config?.title, "ranking")}-torneio360.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
  return true;
}

export { createRankingWorkbook, downloadRankingWorkbook };
