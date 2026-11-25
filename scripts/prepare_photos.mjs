import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDir = path.resolve(process.argv[2] ?? ".source-photos");
const outputDir = path.resolve(process.argv[3] ?? "public/photos");

const photoNames = [
  "IMG_6360.JPG",
  "IMG_6355.JPG",
  "007.jpg",
  "009.jpg",
  "031.jpg",
  "030.jpg",
  "033.jpg",
  "044.jpg",
  "046.jpg",
  "IMG_6354.JPG",
  "IMG_6359.JPG",
];

await mkdir(outputDir, { recursive: true });

for (const fileName of photoNames) {
  const outputName = `${path.parse(fileName).name.toLowerCase()}.webp`;
  await sharp(path.join(sourceDir, fileName))
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, effort: 6, smartSubsample: true })
    .toFile(path.join(outputDir, outputName));
}

// A contact sheet is generated only alongside the source files for visual QA.
const availableFiles = (await readdir(sourceDir)).filter((file) => /\.(jpe?g)$/i.test(file));
const tileWidth = 320;
const tileHeight = 400;
const labelHeight = 38;
const gap = 18;
const columns = 4;
const rows = Math.ceil(availableFiles.length / columns);
const composite = [];

for (const [index, fileName] of availableFiles.entries()) {
  const left = gap + (index % columns) * (tileWidth + gap);
  const top = gap + Math.floor(index / columns) * (tileHeight + labelHeight + gap);
  const image = await sharp(path.join(sourceDir, fileName))
    .rotate()
    .resize(tileWidth, tileHeight, { fit: "cover" })
    .webp({ quality: 78 })
    .toBuffer();
  const label = Buffer.from(
    `<svg width="${tileWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#f4eee3"/><text x="10" y="25" font-family="Arial" font-size="18" fill="#1b3236">${fileName}</text></svg>`,
  );
  composite.push({ input: image, left, top });
  composite.push({ input: label, left, top: top + tileHeight });
}

await sharp({
  create: {
    width: gap + columns * (tileWidth + gap),
    height: gap + rows * (tileHeight + labelHeight + gap),
    channels: 3,
    background: "#d8d0c4",
  },
})
  .composite(composite)
  .webp({ quality: 82 })
  .toFile(path.join(sourceDir, "contact-sheet.webp"));

console.log(`Prepared ${photoNames.length} WebP photographs in ${outputDir}`);
