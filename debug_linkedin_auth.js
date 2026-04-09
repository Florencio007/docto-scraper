const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = '/tmp/chrome-scraper';
const CONFIG_FILE = path.resolve('config.json');

async function debugLogin() {
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const { email, password } = config.linkedin;

  console.log('🚀 Lancement du test de login LinkedIn...');
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await context.newPage();
  
  try {
    console.log('🔗 Navigation vers LinkedIn...');
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
    
    if (page.url().includes('/feed/')) {
      console.log('✅ Déjà connecté !');
    } else {
      console.log('📝 Remplissage des identifiants...');
      await page.fill('#username', email);
      await page.fill('#password', password);
      await page.click('button[type="submit"]');
      
      console.log('⏳ Attente de la redirection...');
      await page.waitForTimeout(10000); // Laisser le temps pour 2FA ou redirection
      
      console.log(`📍 URL actuelle: ${page.url()}`);
      await page.screenshot({ path: 'linkedin_auth_debug.png', fullPage: true });
      console.log('📸 Screenshot sauvegardé: linkedin_auth_debug.png');
      
      if (page.url().includes('/checkpoint/')) {
        console.log('🚨 CHALLENGE détecté (2FA / Captcha)');
      }
    }
  } catch (err) {
    console.error(`❌ Erreur: ${err.message}`);
  } finally {
    await context.close();
  }
}

debugLogin();
