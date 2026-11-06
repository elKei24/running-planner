// Renders public/icon.svg to the PNG sizes the web manifest needs.
// Uses whatever playwright is resolvable (project or global install).
const { chromium } = require('playwright');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

(async () => {
  const svg = readFileSync(path.join(__dirname, '../public/icon.svg'), 'utf8');
  const browser = await chromium.launch();
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</body></html>`);
    const png = await page.screenshot({ omitBackground: true, type: 'png' });
    writeFileSync(path.join(__dirname, `../public/icon-${size}.png`), png);
    await page.close();
  }
  await browser.close();
  console.log('icons written');
})();
