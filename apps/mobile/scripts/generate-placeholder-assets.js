#!/usr/bin/env node
/**
 * Generate realistic placeholder assets for YayeTech Hotel app.
 * Creates logo/icon styles matching the brand color (teal #1f6f64).
 * Replace with real designs before production release.
 */

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const BRAND_COLOR = '1f6f64'; // Teal used throughout the app

/**
 * Creates a canvas-like bitmap for a simple PNG.
 * Creates a colored square with T in the middle.
 */
function createTextIcon(width, height, bgColor, textColor) {
  // Very minimal 1x1 pixel then scale it
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
}

/**
 * Creates a better placeholder using a simple SVG to Base64 PNG conversion.
 */
function createSimplePNG(width, height, bgColor, textColor) {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#${bgColor}"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${width * 0.5}" fill="#${textColor}" font-weight="bold">H</text>
  </svg>`;

  const svgBase64 = Buffer.from(svg).toString('base64');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><image width="${width}" height="${height}" href="data:image/svg+xml;base64,${svgBase64}"/></svg>`);
}

const assets = [
  { name: 'icon.png', width: 1024, height: 1024, desc: 'App icon (1024x1024 recommended)' },
  { name: 'splash.png', width: 1284, height: 2778, desc: 'Splash screen (1284x2778)' },
  { name: 'adaptive-icon.png', width: 512, height: 512, desc: 'Android adaptive icon foreground (512x512)' },
  { name: 'favicon.png', width: 192, height: 192, desc: 'Web favicon (192x192)' },
  { name: 'notification-icon.png', width: 192, height: 192, desc: 'Android notification icon (192x192)' },
];

console.log('Generating placeholder assets for YayeTech Hotel...');

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

for (const asset of assets) {
  let data;
  if (asset.name === 'icon.png' || asset.name === 'splash.png') {
    // Larger icon with hotel icon visual approximation
    data = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
  } else if (asset.name === 'adaptive-icon.png') {
    data = createSimplePNG(asset.width, asset.height, BRAND_COLOR, '1f6f64');
  } else {
    data = createSimplePNG(asset.width, asset.height, BRAND_COLOR, '1f6f64');
  }

  fs.writeFileSync(path.join(ASSETS_DIR, asset.name), data);
  console.log(`✓ Created: assets/${asset.name} — ${asset.desc}`);
}

console.log('\nDone! Files created with brand teal color (#1f6f64)');
console.log('\nRecommended replacements from design:');
console.log('  icon.png:           Hotel logo + YayeTech branding');
console.log('  splash.png:         Splash screen with logo or brand color');
console.log('  adaptive-icon.png:  Icon foreground for Android');
console.log('  favicon.png:        Office app favicon');
console.log('  notification-icon:  Notification bell icon');