const fs = require('fs');

async function test() {
  if (!fs.existsSync('config.json')) {
    console.error("❌ Fichier config.json manquant.");
    return;
  }

  const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
  const webhookUrl = config.google_sheets_webhook;

  if (!webhookUrl) {
    console.error("❌ URL Webhook manquante dans config.json.");
    return;
  }

  const dummyData = {
    departement: "99",
    ville: "TEST_VILLE",
    nom: "TEST_NOM",
    cabinet: "TEST_CABINET",
    nom_linkedin: "TEST_LINKEDIN",
    email: "test@example.com",
    telephone: "0102030405",
    specialisation: "Test Scraper",
    url_linkedin: "https://linkedin.com/in/test",
    url_doctolib: "https://doctolib.fr/test",
    url_pagesjaunes: "https://www.pagesjaunes.fr/pros/test"
  };

  console.log(`🚀 Envoi d'une donnée fictive (avec fetch) vers : ${webhookUrl}...`);
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dummyData)
    });
    
    const body = await response.text();
    console.log("✅ Réponse du serveur Google :", body);
    console.log("\n👉 Vérifiez maintenant votre Google Sheet ! Une ligne 'TEST_NOM' avec l'URL PagesJaunes doit être apparue.");
  } catch (err) {
    console.error("❌ Erreur lors de l'envoi :", err.message);
  }
}

test();
