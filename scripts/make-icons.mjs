import sharp from "sharp";

const forest = process.argv[2] ?? "#2d4a3e";
const coral = process.argv[3] ?? "#c45c4a";
const cream = process.argv[4] ?? "#faf6f1";

const svg = (
  pad,
) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${forest}"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
    <path d="M256 448s-176-104-176-232c0-56 44-104 100-104 34 0 62 18 76 44 14-26 42-44 76-44 56 0 100 48 100 104 0 128-176 232-176 232z" fill="${coral}"/>
    <path d="M256 448s-176-104-176-232c0-56 44-104 100-104 34 0 62 18 76 44" fill="none" stroke="${cream}" stroke-width="18" stroke-linecap="round"/>
  </g>
</svg>`;

const out = [
  ["public/icon-192.png", 192, 64],
  ["public/icon-512.png", 512, 64],
  ["public/icon-maskable-512.png", 512, 120],
  ["public/apple-touch-icon.png", 180, 64],
];
for (const [file, size, pad] of out) {
  await sharp(Buffer.from(svg(pad)))
    .resize(size, size)
    .png()
    .toFile(file);
  console.log("wrote", file);
}
