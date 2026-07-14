const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const concertCopy = {
  'anh-trai-say-hi': {
    theme: 'High-energy pop concert with dance-heavy staging and fan interaction.',
    highlights: [
      'Bright, fast-paced show design for a large arena audience.',
      'Strong choreography moments and an emphasis on crowd call-and-response.',
      'Optimized for promo text on the concert detail page.',
    ],
  },
  'anh-trai-vuot-ngan-chong-gai': {
    theme: 'Nostalgic live band concert built around veteran performers and sing-along moments.',
    highlights: [
      'Warm stage tone with live instrumentation front and center.',
      'Audience sing-along sections and memorable retro arrangements.',
      'Fits an artist introduction that feels polished but grounded.',
    ],
  },
  'em-xinh-say-hi': {
    theme: 'Fashion-forward pop concert with upbeat energy and choreography-led staging.',
    highlights: [
      'Visual-first presentation with polished wardrobe and lighting cues.',
      'Young-pop lineup with high-tempo set lists and playful audience moments.',
      'Works well as a concise public-facing concert summary.',
    ],
  },
  'chi-dep-dap-gio-re-song': {
    theme: 'Cross-generation female performance showcase with vocal highlights and collaborative stages.',
    highlights: [
      'Balanced between emotional ballads and powerful dance numbers.',
      'Designed to read as warm, premium, and audience-friendly.',
      'Useful for generating both artist bios and concert intros.',
    ],
  },
};

function escapePdfText(value) {
  return String(value).replace(/[\\()]/g, '\\$&');
}

function wrapText(text, maxCharsPerLine = 72) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
      continue;
    }

    if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function buildPressKitLines(concert) {
  const copy = concertCopy[concert.slug] || {
    theme: `Concert press kit for ${concert.name}.`,
    highlights: [
      'Public-facing summary generated from the sample manifest.',
      'Can be used to test AI press-kit extraction and draft generation.',
      'Provides a clean sample for both artist and concert targets.',
    ],
  };

  return [
    'TicketBox Press Kit',
    `Concert: ${concert.name}`,
    `Venue: ${concert.venue}`,
    `Primary theme: ${copy.theme}`,
    `Key highlights: ${copy.highlights.join(' ')}`,
    'Public summary hint: write concise, polished copy for the concert detail page.',
    'AI source hint: use this PDF as a clean input for press-kit extraction and draft generation.',
  ];
}

function makePdf(lines) {
  const wrappedLines = lines.flatMap((line) => wrapText(line));
  const lineHeight = 28;
  const topY = 760;
  const eol = '\r\n';
  const contentLines = [
    'BT',
    '/F1 16 Tf',
    `72 ${topY} Td`,
    ...wrappedLines.flatMap((line, index) => [
      ...(index === 0 ? [] : [`0 -${lineHeight} Td`]),
      `(${escapePdfText(line)}) Tj`,
    ]),
    'ET',
  ];

  const stream = `${contentLines.join('\n')}\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}endstream`,
  ];

  let output = `%PDF-1.4${eol}% TicketBox sample PDF${eol}`;
  const offsets = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(output, 'utf8'));
    output += `${index + 1} 0 obj${eol}${objects[index]}${eol}endobj${eol}`;
  }

  const xrefOffset = Buffer.byteLength(output, 'utf8');
  output += `xref${eol}0 ${objects.length + 1}${eol}0000000000 65535 f ${eol}`;
  for (let index = 1; index < offsets.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, '0')} 00000 n ${eol}`;
  }
  output += `trailer${eol}<< /Size ${objects.length + 1} /Root 1 0 R >>${eol}startxref${eol}${xrefOffset}${eol}%%EOF${eol}`;
  return output;
}

function main() {
  const outputDir = path.join(__dirname, '..', 'press-kits');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const concert of manifest.concerts) {
    const filePath = path.join(outputDir, `${concert.slug}-press-kit.pdf`);
    const lines = buildPressKitLines(concert);
    fs.writeFileSync(filePath, makePdf(lines));
  }
}

main();
