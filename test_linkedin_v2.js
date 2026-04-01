const { chromium } = require('playwright');
const { searchLinkedIn } = require('./linkedin_helper');

const CDP_URL = 'http://127.0.0.1:9222';

async function test() {
  console.log('🔌 Connexion au navigateur...');
  const browser = await chromium.connectOverCDP(CDP_URL);
  
  const contexts = browser.contexts();
  const page = contexts[0].pages()[0];

  const practitioner = {
    nom: "RAFITOSON DIAMONDRA",
    ville: "Albi"
  };

  console.log(`🧪 Test du nouveau moteur LinkedIn pour: ${practitioner.nom}...`);
  
  const result = await searchLinkedIn(page, practitioner);
  
  console.log('\n📊 RÉSULTAT DU TEST :');
  console.log(JSON.stringify(result, null, 2));

  await browser.disconnect();
}

test().catch(console.error);
