const { chromium } = require('playwright');
const { searchLinkedIn } = require('./linkedin_helper');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  console.log("Recherche LinkedIn...");
  const practitioner = { nom: "Antoine Susini", ville: "Auch" };
  const res = await searchLinkedIn(page, practitioner);
  console.log("Résultat LinkedIn:", res);
  
  await browser.close();
}

test().catch(console.error);
