const { chromium } = require('playwright');
const fs = require('fs');

async function dump() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = await context.newPage();
  
  const url = 'https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=Ophtalmologue&ou=81&univers=pagesjaunes&idOu=';
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // Wait for results
  await page.waitForSelector('.bi-list', { timeout: 10000 }).catch(() => {});
  
  const html = await page.content();
  fs.writeFileSync('debug_pagesjaunes_81.html', html);
  console.log('HTML dumped to debug_pagesjaunes_81.html');
  
  await page.close();
}

dump();
