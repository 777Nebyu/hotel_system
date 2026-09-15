#!/usr/bin/env node
/**
 * Generate placeholder icon assets for the YayeTech Hotel app.
 * Run: node scripts/generate-assets.js
 * Requires: node 18+ (uses built-in fetch + canvas-free SVG approach)
 *
 * This creates minimal valid PNG files as placeholders.
 * Replace with real designs before production release.
 */
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Minimal 1x1 PNG as a base (teal color #1f6f64)
const TEAL_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Larger placeholder: 1024x1024 teal square (for icon/splash)
// We'll generate a proper minimal PNG with IHDR, IDAT, IEND
function createMinimalPNG(width, height, r, g, b) {
  // For simplicity, create a base64 encoded minimal PNG
  // This is a 1x1 teal pixel PNG, scaled up by the system
  return TEAL_PIXEL;
}

const assets = [
  { name: 'icon.png', desc: 'App icon (1024x1024 recommended)' },
  { name: 'splash.png', desc: 'Splash screen (recommended: 1284x2778)' },
  { name: 'adaptive-icon.png', desc: 'Android adaptive icon foreground (1024x1024)' },
  { name: 'favicon.png', desc: 'Web favicon (48x48)' },
  { name: 'notification-icon.png', desc: 'Android notification icon (96x96)' },
];

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

for (const asset of assets) {
  const filePath = path.join(ASSETS_DIR, asset.name);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, TEAL_PIXEL);
    console.log(`Created: assets/${asset.name} — ${asset.desc}`);
  } else {
    console.log(`Skipped: assets/${asset.name} (already exists)`);
  }
}

console.log('\nDone! Replace these placeholder files with real designs before production.');
console.log('Recommended sizes:');
console.log('  icon.png:           1024 x 1024 px');
console.log('  splash.png:         1284 x 2778 px (or your splash dimensions)');
console.log('  adaptive-icon.png:  1024 x 1024 px');
console.log('  favicon.png:        48 x 48 px');
console.log('  notification-icon:  96 x 96 px');
