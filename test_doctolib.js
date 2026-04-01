const { chromium } = require('playwright');
const { searchDoctolib, enrichProfile } = require('./doctolib_helper');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Recherche Doctolib...");
  const practitioner = { nom: "Antoine Susini", ville: "Auch" };
  const res = await searchDoctolib(page, practitioner);
  console.log("Résultat:", res);
  
  await browser.close();
}

test().catch(console.error);
