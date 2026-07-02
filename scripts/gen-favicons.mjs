// Regenerate raster icons from the tier-bars mark in src/app/icon.svg.
// Run after tweaking the design: node scripts/gen-favicons.mjs
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync } from "node:fs";

// Rounded source (matches the browser SVG). For iOS, drop the corner radius —
// it applies its own corner mask, so the icon should be a full-bleed square.
const rounded = readFileSync("src/app/icon.svg", "utf8");
const square = rounded.replace(/\srx="7"/, "");

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 512 }).resize(size, size).png().toBuffer();

const icoPngs = await Promise.all([16, 32, 48].map((s) => png(rounded, s)));
writeFileSync("src/app/favicon.ico", await pngToIco(icoPngs));
writeFileSync("src/app/apple-icon.png", await png(square, 180));

console.log("wrote src/app/favicon.ico (16/32/48) and src/app/apple-icon.png (180)");
