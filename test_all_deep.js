const { chromium } = require('playwright');
const { searchDoctolib } = require('./doctolib_helper');
const { searchLinkedIn } = require('./linkedin_helper');
const fs = require('fs');

const CDP_URL = 'http://127.0.0.1:9222';
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

async function testExtraction() {
  console.log('🔌 Connexion au navigateur...');
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  const page = contexts[0].pages()[0];

  const practitioner = {
    nom: "Christophe GAZAGNE",
    ville: "Narbonne",
    url_pagesjaunes: "https://www.pagesjaunes.fr/pros/56568768",
    emails: []
  };

  console.log(`\n🧪 TEST D'EXTRACTION PROFONDE - ${practitioner.nom}`);

  // 1. PagesJaunes Phone Button Click
  console.log('--- PAGESJAUNES ---');
  await page.goto(practitioner.url_pagesjaunes, { waitUntil: 'domcontentloaded' });
  try {
    const telBtn = await page.$('.button.btn_tel, button[aria-label="Afficher le numéro"]');
    if (telBtn) {
      console.log('    🖱 Clic sur "Afficher le numéro"...');
      await telBtn.click();
      await page.waitForTimeout(1500);
    }
    const phone = await page.evaluate(() => document.querySelector('.nb-phone, .num')?.innerText.trim());
    console.log(`    📞 Téléphone PJ: ${phone || 'NON TROUVÉ'}`);
    practitioner.telephone = phone;
  } catch (e) {
    console.error('    ❌ Erreur PJ:', e.message);
  }

  // 2. Doctolib Deep Scrape
  console.log('\n--- DOCTOLIB ---');
  const docResult = await searchDoctolib(page, practitioner);
  console.log('    📊 Résultat Doctolib:', JSON.stringify(docResult, null, 2));

  // 3. LinkedIn Deep Scrape
  console.log('\n--- LINKEDIN ---');
  const linResult = await searchLinkedIn(page, practitioner);
  console.log('    📊 Résultat LinkedIn:', JSON.stringify(linResult, null, 2));

  console.log('\n✅ TEST TERMINÉ.');
  await browser.disconnect();
}

testExtraction().catch(console.error);
