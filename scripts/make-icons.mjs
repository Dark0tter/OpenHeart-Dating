// Builds every icon, splash screen and the social share image from the logo.
// Run from the repo root: node scripts/make-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import sharp from "sharp";

const PLUM = "#2c1239";
const MASTER = "brand/kindred-kinks-logo-master.jpg";
const FAVICON_SVG = readFileSync("public/favicon.svg");

/** The mark without most of the surrounding background, for splash screens and Android. */
const markCrop = await sharp(MASTER)
  .extract({ left: 122, top: 133, width: 780, height: 780 })
  .toBuffer();

const save = async (file, image) => {
  mkdirSync(dirname(file), { recursive: true });
  await image.png().toFile(file);
  console.log("wrote", file);
};

const full = (size) =>
  sharp(MASTER).resize(size, size).flatten({ background: PLUM });

/** Plum canvas with the mark centered at `scale` of the shorter side. */
const onCanvas = async (width, height, scale) => {
  const side = Math.round(Math.min(width, height) * scale);
  const mark = await sharp(markCrop).resize(side, side).toBuffer();
  return sharp({
    create: { width, height, channels: 4, background: PLUM },
  }).composite([
    {
      input: mark,
      left: Math.round((width - side) / 2),
      top: Math.round((height - side) / 2),
    },
  ]);
};

// Website
await save("public/icon-192.png", full(192));
await save("public/icon-512.png", full(512));
await save("public/icon-maskable-512.png", full(512));
await save("public/apple-touch-icon.png", full(180));

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(
  icoSizes.map((s) => sharp(FAVICON_SVG).resize(s, s).png().toBuffer()),
);
const header = Buffer.alloc(6 + 16 * icoSizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = header.length;
icoSizes.forEach((s, i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(s, at);
  header.writeUInt8(s, at + 1);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(icoImages[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += icoImages[i].length;
});
writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...icoImages]));
console.log("wrote src/app/favicon.ico");

const ogText =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <text x="600" y="282" font-family="Georgia, serif" font-size="84" fill="#fdecd2">Kindred Kinks</text>
  <text x="604" y="352" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#fa9285">Privacy-first dating and community</text>
  <text x="604" y="394" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#fa9285">for LGBTQIA+ and kink-positive adults</text>
</svg>`);
await save(
  "public/og-image.png",
  sharp({
    create: { width: 1200, height: 630, channels: 4, background: PLUM },
  }).composite([
    {
      input: await sharp(markCrop).resize(560, 560).toBuffer(),
      left: 40,
      top: 35,
    },
    { input: ogText, left: 0, top: 0 },
  ]),
);

// iOS
const ios = "mobile/ios/App/App/Assets.xcassets";
await save(`${ios}/AppIcon.appiconset/AppIcon-512@2x.png`, full(1024));
for (const name of [
  "splash-2732x2732.png",
  "splash-2732x2732-1.png",
  "splash-2732x2732-2.png",
]) {
  await save(`${ios}/Splash.imageset/${name}`, await onCanvas(2732, 2732, 0.3));
}

// Android
const res = "mobile/android/app/src/main/res";
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const circle = (s) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`,
  );
for (const [d, k] of Object.entries(densities)) {
  const launcher = 48 * k;
  await save(`${res}/mipmap-${d}/ic_launcher.png`, full(launcher));
  await save(
    `${res}/mipmap-${d}/ic_launcher_round.png`,
    sharp(await full(launcher).png().toBuffer()).composite([
      { input: circle(launcher), blend: "dest-in" },
    ]),
  );
  // Adaptive icons show the middle 72 of 108dp; keep the mark inside the 66dp safe zone.
  const fg = 108 * k;
  await save(
    `${res}/mipmap-${d}/ic_launcher_foreground.png`,
    await onCanvas(fg, fg, 66 / 108),
  );
}
const splashes = {
  drawable: [480, 320],
  "drawable-land-mdpi": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1600, 960],
  "drawable-land-xxxhdpi": [1920, 1280],
  "drawable-port-mdpi": [320, 480],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [960, 1600],
  "drawable-port-xxxhdpi": [1280, 1920],
};
for (const [dir, [w, h]] of Object.entries(splashes)) {
  await save(`${res}/${dir}/splash.png`, await onCanvas(w, h, 0.45));
}
