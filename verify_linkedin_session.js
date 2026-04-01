const { chromium } = require('playwright');

const CDP_URL = 'http://127.0.0.1:9222';

async function verify() {
  console.log('🔌 Connexion au navigateur...');
  const browser = await chromium.connectOverCDP(CDP_URL);
  
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.log('❌ Aucun contexte trouvé.');
    return;
  }
  
  const pages = contexts[0].pages();
  const page = pages.find(p => p.url().includes('linkedin.com/search')) || pages[0];
  
  console.log(`📄 Page active: ${page.url()}`);
  
  // Test sélecteur premier résultat
  const result = await page.evaluate(() => {
    const firstResult = document.querySelector('.reusable-search__result-container');
    if (!firstResult) return "❌ Aucun résultat trouvé avec .reusable-search__result-container";
    
    const nameEl = firstResult.querySelector('.entity-result__title-text a');
    const linkEl = firstResult.querySelector('a.app-aware-link');
    
    return {
      name: nameEl ? nameEl.innerText.trim() : "NOM INTROUVABLE",
      link: linkEl ? linkEl.href : "LIEN INTROUVABLE"
    };
  });
  
  console.log('🔍 Résultat de l\'extraction test :');
  console.log(JSON.stringify(result, null, 2));

  // Screenshot pour preuve visuelle (sauvegardé en tant qu'artifact via Antigravity indirectement si je le lis après)
  await page.screenshot({ path: 'linkedin_test_capture.png' });
  console.log('📸 Capture d\'écran effectuée: linkedin_test_capture.png');

  await browser.disconnect();
}

verify().catch(console.error);
