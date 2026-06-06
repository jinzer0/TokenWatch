import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import {
  reportOutputOptionsSchema,
  reportPngRenderInputSchema,
  type GraphReport,
  type ReportPngRenderInput,
  type WrappedReport
} from './reportContracts.js';

const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

type Rgba = readonly [number, number, number, number];

const colors = {
  background: [250, 251, 252, 255] as const,
  ink: [24, 32, 43, 255] as const,
  muted: [88, 99, 112, 255] as const,
  grid: [219, 225, 232, 255] as const,
  accent: [22, 101, 216, 255] as const,
  accentSoft: [153, 194, 255, 255] as const,
  warning: [194, 111, 0, 255] as const,
  white: [255, 255, 255, 255] as const
};

export function renderReportPng(input: ReportPngRenderInput): Buffer {
  const parsed = reportPngRenderInputSchema.parse(input);
  const pixels = createCanvas(parsed.width, parsed.height, colors.background);
  drawReport(pixels, parsed);
  return encodePng(pixels.width, pixels.height, pixels.data);
}

export async function writeReportPng(
  input: ReportPngRenderInput & { outputPath: string }
): Promise<Buffer> {
  const { outputPath: rawOutputPath, ...renderInput } = input;
  const { outputPath } = reportOutputOptionsSchema.parse({
    outputPath: rawOutputPath,
    format: 'png'
  });
  if (!outputPath) throw new Error('invalid_output_path');
  const png = renderReportPng(renderInput);
  await writeFile(outputPath, png);
  return png;
}

export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (width < 1 || height < 1 || rgba.length !== width * height * 4) {
    throw new Error('invalid_report_option');
  }
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (width * 4 + 1);
    const pixelOffset = y * width * 4;
    raw[rawOffset] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + pixelOffset, width * 4).copy(raw, rawOffset + 1);
  }
  return Buffer.concat([
    pngSignature,
    chunk('IHDR', ihdr(width, height)),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function drawReport(canvas: Canvas, input: ReportPngRenderInput): void {
  drawRect(canvas, 0, 0, canvas.width, canvas.height, colors.background);
  drawText(canvas, input.title ?? defaultTitle(input.report), 32, 28, colors.ink, 2);
  drawText(canvas, summaryLine(input.report), 32, 58, colors.muted, 1);
  const chart = { x: 48, y: 96, width: canvas.width - 96, height: canvas.height - 152 };
  drawRect(canvas, chart.x - 1, chart.y - 1, chart.width + 2, chart.height + 2, colors.grid);
  drawRect(canvas, chart.x, chart.y, chart.width, chart.height, colors.white);
  for (let i = 1; i < 4; i += 1) {
    const y = chart.y + Math.round((chart.height * i) / 4);
    drawRect(canvas, chart.x, y, chart.width, 1, colors.grid);
  }
  const points = reportPoints(input.report);
  if (points.length === 0) {
    drawText(canvas, 'No usage events in range', chart.x + 24, chart.y + 32, colors.muted, 2);
  } else {
    drawBars(canvas, chart, points);
  }
  const unknown = input.report.unknownCostEvents;
  if (unknown > 0) {
    drawText(
      canvas,
      `${unknown} event(s) with unknown cost`,
      32,
      canvas.height - 36,
      colors.warning,
      1
    );
  } else {
    drawText(
      canvas,
      'Privacy: sanitized report, no metadata chunks',
      32,
      canvas.height - 36,
      colors.muted,
      1
    );
  }
}

type Canvas = { width: number; height: number; data: Uint8Array };
type Chart = { x: number; y: number; width: number; height: number };
type Point = { key: string; value: number };

function createCanvas(width: number, height: number, color: Rgba): Canvas {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data.set(color, index);
  }
  return { width, height, data };
}

function drawBars(canvas: Canvas, chart: Chart, points: Point[]): void {
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const gap = Math.max(2, Math.floor(chart.width / Math.max(points.length, 1) / 5));
  const barWidth = Math.max(
    2,
    Math.floor((chart.width - gap * (points.length + 1)) / points.length)
  );
  points.forEach((point, index) => {
    const barHeight = Math.max(1, Math.round((point.value / maxValue) * (chart.height - 32)));
    const x = chart.x + gap + index * (barWidth + gap);
    const y = chart.y + chart.height - barHeight;
    drawRect(canvas, x, y, barWidth, barHeight, colors.accent);
    drawRect(canvas, x, y, barWidth, Math.min(3, barHeight), colors.accentSoft);
    if (index < 8)
      drawText(canvas, point.key.slice(0, 10), x, chart.y + chart.height + 8, colors.muted, 1);
  });
}

function reportPoints(report: GraphReport | WrappedReport): Point[] {
  if (report.kind === 'graph') {
    return report.series.map((point) => ({
      key: point.key,
      value: graphPointValue(report, point)
    }));
  }
  return report.monthly.map((point) => ({ key: point.key, value: point.tokens || point.events }));
}

function graphPointValue(report: GraphReport, point: GraphReport['series'][number]): number {
  if (report.metric === 'events') return point.events;
  if (report.metric === 'cost') return point.estimatedCostUsd ?? 0;
  return point.tokens;
}

function defaultTitle(report: GraphReport | WrappedReport): string {
  return report.kind === 'graph'
    ? `TokenWatch ${report.metric} graph`
    : `TokenWatch wrapped ${report.year}`;
}

function summaryLine(report: GraphReport | WrappedReport): string {
  const cost =
    report.totals.estimatedCostUsd === null
      ? 'unknown cost'
      : `$${report.totals.estimatedCostUsd.toFixed(2)}`;
  return `${report.totals.events} events | ${report.totals.tokens} tokens | ${cost}`;
}

function drawRect(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Rgba
): void {
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  const right = Math.min(canvas.width, x + width);
  const bottom = Math.min(canvas.height, y + height);
  for (let row = top; row < bottom; row += 1) {
    for (let column = left; column < right; column += 1) {
      canvas.data.set(color, (row * canvas.width + column) * 4);
    }
  }
}

function drawText(
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  color: Rgba,
  scale: number
): void {
  let cursor = x;
  for (const character of text.toUpperCase()) {
    drawGlyph(canvas, character, cursor, y, color, scale);
    cursor += 6 * scale;
  }
}

function drawGlyph(
  canvas: Canvas,
  character: string,
  x: number,
  y: number,
  color: Rgba,
  scale: number
): void {
  const glyph = font[character] ?? font['?'];
  glyph.forEach((row, rowIndex) => {
    for (let column = 0; column < row.length; column += 1) {
      if (row[column] === '1') {
        drawRect(canvas, x + column * scale, y + rowIndex * scale, scale, scale, color);
      }
    }
  });
}

function ihdr(width: number, height: number): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const font: Record<string, string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '?': ['11110', '00001', '00001', '00110', '00100', '00000', '00100'],
  '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '-': ['00000', '00000', '00000', '11110', '00000', '00000', '00000'],
  $: ['01110', '10100', '10100', '01110', '00101', '00101', '11110'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111']
};
