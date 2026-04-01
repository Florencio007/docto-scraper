/**
 * Scraper Ophtalmologues Zone 3 – PagesJaunes / PagesBlanches
 * ============================================================
 * Connexion : Chrome avec --remote-debugging-port=9222
 *
 * Lancer Chrome AVANT ce script :
 *   google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-scraper
 *
 * Usage :
 *   node scraper_ophtalmologues_zone3.js          → Phase 1 + Phase 2
 *   node scraper_ophtalmologues_zone3.js --phase1  → Phase 1 uniquement
 *   node scraper_ophtalmologues_zone3.js --phase2  → Phase 2 uniquement (links déjà dans progress.json)
 */

const { chromium } = require('playwright');
const ExcelJS = require('exceljs');
const { searchDoctolib } = require('./doctolib_helper');
const { loginLinkedIn, searchLinkedIn } = require('./linkedin_helper');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────
const CDP_URL = 'http://localhost:9222';
const PROGRESS_FILE = path.resolve('progress.json');
const OUTPUT_FILE = path.resolve('ophtalmologues_zone3.xlsx');
const LINK_PATTERN = /\/pros\/\d+/;

const DEPARTEMENTS = [
  // Occitanie
  { code: '09', nom: 'Ariège',          region: 'Occitanie' },
  { code: '11', nom: 'Aude',            region: 'Occitanie' },
  { code: '12', nom: 'Aveyron',         region: 'Occitanie' },
  { code: '30', nom: 'Gard',            region: 'Occitanie' },
  { code: '31', nom: 'Haute-Garonne',   region: 'Occitanie' },
  { code: '32', nom: 'Gers',            region: 'Occitanie' },
  { code: '34', nom: 'Hérault',         region: 'Occitanie' },
  { code: '46', nom: 'Lot',             region: 'Occitanie' },
  { code: '48', nom: 'Lozère',          region: 'Occitanie' },
  { code: '65', nom: 'Hautes-Pyrénées', region: 'Occitanie' },
  { code: '66', nom: 'Pyrénées-Orientales', region: 'Occitanie' },
  { code: '81', nom: 'Tarn',            region: 'Occitanie' },
  { code: '82', nom: 'Tarn-et-Garonne', region: 'Occitanie' },
  // Nouvelle-Aquitaine
  { code: '16', nom: 'Charente',        region: 'Nouvelle-Aquitaine' },
  { code: '17', nom: 'Charente-Maritime', region: 'Nouvelle-Aquitaine' },
  { code: '19', nom: 'Corrèze',         region: 'Nouvelle-Aquitaine' },
  { code: '23', nom: 'Creuse',          region: 'Nouvelle-Aquitaine' },
  { code: '24', nom: 'Dordogne',        region: 'Nouvelle-Aquitaine' },
  { code: '33', nom: 'Gironde',         region: 'Nouvelle-Aquitaine' },
  { code: '40', nom: 'Landes',          region: 'Nouvelle-Aquitaine' },
  { code: '47', nom: 'Lot-et-Garonne',  region: 'Nouvelle-Aquitaine' },
  { code: '64', nom: 'Pyrénées-Atlantiques', region: 'Nouvelle-Aquitaine' },
  { code: '79', nom: 'Deux-Sèvres',    region: 'Nouvelle-Aquitaine' },
  { code: '86', nom: 'Vienne',          region: 'Nouvelle-Aquitaine' },
  { code: '87', nom: 'Haute-Vienne',    region: 'Nouvelle-Aquitaine' },
  // Centre-Val de Loire
  { code: '18', nom: 'Cher',            region: 'Centre-Val de Loire' },
  { code: '28', nom: 'Eure-et-Loir',   region: 'Centre-Val de Loire' },
  { code: '36', nom: 'Indre',           region: 'Centre-Val de Loire' },
  { code: '37', nom: 'Indre-et-Loire',  region: 'Centre-Val de Loire' },
  { code: '41', nom: 'Loir-et-Cher',   region: 'Centre-Val de Loire' },
  { code: '45', nom: 'Loiret',          region: 'Centre-Val de Loire' },
  // Île-de-France
  { code: '77', nom: 'Seine-et-Marne',  region: 'Île-de-France' },
];

const DELAYS = {
  resultPage: [500, 1000],   // Mode Turbo
  detailPage:  [300, 800],    // Mode Turbo
  cloudflare:  8000,
  retry:       [1000, 2000, 4000], 
};

// ─────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randDelay = ([min, max]) => sleep(rand(min, max));

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
    catch { /* fichier corrompu */ }
  }
  return { links: {}, processed: [] };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`);
}

function cleanPhone(text) {
  if (!text) return '';
  // Garde tous les chiffres et le signe +
  return text.replace(/[^\d+]/g, '');
}

// ─────────────────────────────────────────────
// EXCEL – écriture ligne par ligne
// ─────────────────────────────────────────────
class ExcelHelper {
  constructor(filePath) {
    this.filePath = filePath;
    this.workbook = new ExcelJS.Workbook();
    this.sheet = null;
  }

  async init() {
    if (fs.existsSync(this.filePath)) {
      await this.workbook.xlsx.readFile(this.filePath);
      this.sheet = this.workbook.getWorksheet(1);
    } else {
      this.sheet = this.workbook.addWorksheet('Ophtalmologues');
      // En-têtes Row 2 (Catégories)
      const row2 = this.sheet.getRow(2);
      row2.getCell(2).value = 'PROSPECTS';
      row2.getCell(6).value = 'LINKEDIN';
      row2.getCell(8).value = 'CONTACT';
      row2.getCell(10).value = 'PRISE DE CONTACT';
      row2.getCell(13).value = 'DATE';
      row2.getCell(16).value = 'SPECIALITE';
      row2.getCell(18).value = 'OBS';

      // En-têtes Row 3 (Colonnes)
      const row3 = this.sheet.getRow(3);
      row3.getCell(2).value = 'DEPARTEMENT';
      row3.getCell(3).value = 'VILLE';
      row3.getCell(4).value = 'NOM DU MEDECIN';
      row3.getCell(5).value = 'CENTRE';
      row3.getCell(6).value = 'STATUT'; // LinkedIn Search Status or similar
      row3.getCell(7).value = 'NOM LINKEDIN';
      row3.getCell(8).value = 'MAIL';
      row3.getCell(9).value = 'TELEPHONE';
      row3.getCell(10).value = 'ENVOI';
      row3.getCell(11).value = 'ETAPE DE CONVERSATION';
      row3.getCell(12).value = 'RESULTAT';
      row3.getCell(13).value = 'DATE ENVOI';
      row3.getCell(14).value = 'DATE DE RELANCE';
      row3.getCell(16).value = 'SPECIALITE';
      row3.getCell(18).value = 'OBS';
      row3.getCell(19).value = 'LIEN LINKEDIN';
      row3.getCell(20).value = 'LIEN DOCTOLIB';
      row3.getCell(21).value = 'LIEN SITE INTERNET';
      row3.getCell(22).value = 'LIEN PAGESJAUNES';

      // Style
      row2.font = { bold: true };
      row3.font = { bold: true };
      await this.save();
    }
  }

  async save() {
    await this.workbook.xlsx.writeFile(this.filePath);
  }

  async addRow(data) {
    const row = this.sheet.addRow([]);
    row.getCell(2).value  = data.departement;
    row.getCell(3).value  = data.ville;
    row.getCell(4).value  = data.nom;
    row.getCell(5).value  = data.cabinet;
    row.getCell(6).value  = (data.url_linkedin) ? 'Oui' : 'Non';
    row.getCell(7).value  = data.nom_linkedin || '';
    
    // Fusion des emails uniques
    const emailList = [...new Set(data.emails || [])].filter(e => e).join(', ');
    row.getCell(8).value  = emailList || data.email || '';
    
    row.getCell(9).value  = data.telephone || '';
    row.getCell(16).value = data.specialisation || 'Ophtalmologue';
    row.getCell(18).value = data.obs || '';
    row.getCell(19).value = data.url_linkedin || '';
    row.getCell(20).value = data.url_doctolib || '';
    row.getCell(21).value = data.url_site || '';
    row.getCell(22).value = data.url_pagesjaunes || '';
    await this.save();
  }
}

// ─────────────────────────────────────────────
// GESTION COOKIES & CLOUDFLARE
// ─────────────────────────────────────────────
async function handleCookieConsent(page) {
  try {
    const consentBtn = await page.$('#sp-cc-accept, #axe-allow-all, button:has-text("Tout accepter"), .pj-button[id*="accept"]');
    if (consentBtn) {
      log('🍪 Bandeau cookies détecté -> acceptation');
      await consentBtn.click();
      await sleep(1000);
    }
  } catch (err) {}
}

async function detectAndWaitCloudflare(page) {
  const title = await page.title().catch(() => '');
  if (title.includes('Sécurité') || title.includes('Security') || title.includes('Just a moment')) {
    log('⚠️  Page Cloudflare détectée – attente 15s...');
    await sleep(DELAYS.cloudflare);
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// NAVIGATION ROBUSTE (retry x3 + backoff)
// ─────────────────────────────────────────────
async function gotoWithRetry(page, url, retries = 3) {
  const t0 = Date.now();
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Timeout plus court pour échapper au "tarpitting" (le serveur ralentit volontairement)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await handleCookieConsent(page);

      // Scroll pour lazy-load (limité à 1 seconde max pour ne pas bloquer)
      await page.evaluate(() => {
        return new Promise(resolve => {
          let totalHeight = 0;
          const distance = 500; // Plus grand pas
          let scrolls = 0;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            scrolls++;
            if (totalHeight >= document.body.scrollHeight || scrolls > 10) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      const isCF = await detectAndWaitCloudflare(page);
      if (isCF) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
        await detectAndWaitCloudflare(page);
      }
      
      const t1 = Date.now();
      if ((t1 - t0) > 10000) log(`  ⚡ Navigation complétée en ${Math.round((t1-t0)/1000)}s`);
      return true;
    } catch (err) {
      if (attempt < retries - 1) {
        const wait = DELAYS.retry[attempt];
        log(`  ↺ Tentative ${attempt + 2}/${retries} pour ${url} (attente ${wait}ms)`);
        await sleep(wait);
      } else {
        log(`  ✗ Échec après ${retries} tentatives : ${url}`);
        return false;
      }
    }
  }
}

// ─────────────────────────────────────────────
// PHASE 1 – Collecte des liens
// ─────────────────────────────────────────────
async function phase1(page, progress) {
  log('═══════════════════════════════════════════');
  log('  PHASE 1 – Collecte des liens             ');
  log('═══════════════════════════════════════════');

  for (const dep of DEPARTEMENTS) {
    if (progress.links[dep.code] && progress.links[dep.code].done) {
      log(`[DEP ${dep.code}] ✓ Déjà collecté (${progress.links[dep.code].urls.length} liens)`);
      continue;
    }

    if (!progress.links[dep.code]) {
      progress.links[dep.code] = { urls: [], done: false };
    }

    const baseUrl = `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=Ophtalmologue&ou=${dep.code}&univers=pagesjaunes&idOu=`;
    let pageNum = 1;
    let totalPages = 1;
    let cumul = progress.links[dep.code].urls.length;

    log(`[DEP ${dep.code}] ${dep.nom} (${dep.region}) – début collecte`);

    while (pageNum <= totalPages) {
      const url = pageNum === 1 ? baseUrl : `${baseUrl}&page=${pageNum}`;
      const ok = await gotoWithRetry(page, url);

      if (!ok) {
        pageNum++;
        continue;
      }

      // Attendre que la liste soit chargée
      try {
        await page.waitForSelector('.bi-list, .paj-results, [data-pjlb-list]', { timeout: 10000 });
      } catch (e) {
        log(`  ⚠ Liste non détectée sur page ${pageNum} (peut-être aucun résultat)`);
      }

      // Scroll robuste pour lazy-load
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.scrollBy(0, 800);
          await new Promise(r => setTimeout(r, 400));
        }
      });

      // Détection du nombre de pages (ex: "Page 1 / 4")
      if (pageNum === 1) {
        try {
          const paginationText = await page.evaluate(() => {
            const el = document.querySelector('.pagination-compteur, #SEL-compteur');
            return el ? el.textContent.trim() : '';
          });
          
          if (paginationText) {
            const match = paginationText.match(/\/\s*(\d+)/);
            if (match && match[1]) {
              totalPages = parseInt(match[1]);
              log(`  ✨ ${totalPages} pages détectées pour ce département`);
            }
          }
        } catch (e) {
          totalPages = 1;
        }
      }

      // Extraire les liens de fiches détail
      const links = await page.$$eval('a.bi-denomination.pj-link', anchors =>
        anchors
          .map(a => a.href)
          .filter(href => /\/pros\/\d+/.test(href))
          .map(href => {
            try { return new URL(href).origin + new URL(href).pathname; }
            catch { return href.split('?')[0]; }
          })
      ).catch(() => []);

      // Dédoublonner
      const existing = new Set(progress.links[dep.code].urls);
      const newLinks = [...new Set(links)].filter(l => !existing.has(l));
      progress.links[dep.code].urls.push(...newLinks);
      cumul += newLinks.length;

      log(`[DEP ${dep.code}] Page ${pageNum}/${totalPages} → ${newLinks.length} liens (cumul: ${cumul})`);

      saveProgress(progress);

      if (pageNum < totalPages) {
        await randDelay(DELAYS.resultPage);
      }
      pageNum++;
    }

    progress.links[dep.code].done = true;
    saveProgress(progress);
    log(`[DEP ${dep.code}] ✓ Terminé – ${progress.links[dep.code].urls.length} liens`);
  }

  const total = Object.values(progress.links).reduce((s, d) => s + (d.urls?.length || 0), 0);
  log(`\n✅ Phase 1 terminée – ${total} liens collectés au total`);
}

// ─────────────────────────────────────────────
// PHASE 2 – Extraction des données
// ─────────────────────────────────────────────
async function extractFiche(page, url, depInfo) {
  const data = {
    nom:            '',
    cabinet:        '',
    adresse:        '',
    ville:          '',
    departement:    depInfo.nom,
    code_dep:       depInfo.code,
    region:         depInfo.region,
    telephone:      '',
    email:          '',
    specialisation: 'Ophtalmologue',
    url:            url,
    url_pagesjaunes: url
  };

  try {
    // Nom du médecin
    // 📞 Extraction du téléphone (Bouton "Afficher le numéro")
    try {
      const telButton = await page.$('.button.btn_tel, button[aria-label="Afficher le numéro"], .zone-fantomas a');
      if (telButton) {
        await telButton.click();
        await page.waitForTimeout(800); // Animation accélérée
      }
    } catch (e) {}

    let phone = await page.evaluate(() => {
      // On cherche spécifiquement la valeur du numéro, pas le label
      const el = document.querySelector('.nb-phone, .num, [itemprop="telephone"]');
      if (!el) return null;
      // On clone pour ne pas modifier le DOM et on enlève les éléments "label"
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.screenreader, .num-tel-label, i').forEach(n => n.remove());
      return clone.innerText.trim();
    });
    phone = cleanPhone(phone);

    const rawNom = await page.evaluate(() => {
      const el = document.querySelector('h1.denomination-links, h1, .identity-name');
      return el ? el.textContent.trim() : '';
    });

    const rawCabinet = await page.evaluate(() => {
      const el = document.querySelector('.company-name, [itemprop="legalName"], .lb-establishment-name, .workplace-name, .bi-denomination h3');
      const text = el ? el.textContent.trim() : '';
      
      // Filtre de mots-clés : un centre doit ressembler à un centre (pas à un nom de personne seule)
      const centerKeywords = ['centre', 'cabinet', 'clinique', 'ophtalmolog', 'groupe', 'scm', 'selarl', 'institut', 'fondation', 'hopital'];
      const isCenter = centerKeywords.some(kw => text.toLowerCase().includes(kw));
      
      // Si ce n'est pas un nom de centre connu, et que ça ressemble à un "Prénom Nom" (2-3 mots), on l'exclut
      const words = text.split(' ').filter(w => w.length > 0);
      if (!isCenter && words.length <= 3) return '';
      
      return text;
    });

    // Nettoyage intelligent : si le cabinet est le même que le nom, on laisse cabinet vide
    if (rawCabinet.toLowerCase() === rawNom.toLowerCase()) {
      data.nom = rawNom;
      data.cabinet = '';
    } else {
      data.nom = rawNom;
      data.cabinet = rawCabinet;
    }

    // Adresse et Ville
    const adrBlock = await page.evaluate(() => {
      const selectors = ['.address.streetAddress', '.teaser-item span', '[itemprop="streetAddress"]', '.lb-address', 'address'];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const text = el.textContent.trim().replace(/\s+/g, ' ');
          // Éviter les blocs téléphoniques : "Tél : 01...", "Afficher...", ou chaînes trop courtes/numériques
          const isPhone = text.includes('Téléphone') || text.includes('Afficher') || text.includes('Tél') || /^[0-9\s.]{10,14}$/.test(text.replace(/\s+/g, ''));
          if (text && !isPhone && text.length > 5) {
            return text;
          }
        }
      }
      return '';
    });

    if (adrBlock) {
      data.adresse = adrBlock;
      // Tentative d'extraction de la ville (ex: "11 route Foix 09100 Pamiers")
      const m = adrBlock.match(/^(.*?)\s*(\d{5})\s+(.+)$/);
      if (m) {
        data.adresse = m[1].trim() || adrBlock;
        data.ville = m[3].trim();
      } else {
        // Fallback si pas de CP (souvent le dernier mot après un espace ou une virgule)
        const parts = adrBlock.split(/,|\s{2,}/);
        data.ville = parts.pop().trim();
      }
    }

    // Téléphone – clic nécessaire sur le bouton "Afficher le numéro"
    try {
      const showBtn = await page.$('.fantomas, [data-phone-reveal], .icon-telephone, a[title*="numéro"]');
      if (showBtn) {
        await showBtn.scrollIntoViewIfNeeded().catch(() => {});
        await showBtn.click({ timeout: 5000 }).catch(() => {});
        await sleep(2000); 
      }

      data.telephone = phone || await page.evaluate(() => {
        const selectors = ['.num', '.phone-number', '[data-phone]', '[data-href^="tel:"]', '.fantomas'];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            let val = el.getAttribute('data-phone') || el.getAttribute('data-href') || el.textContent.replace(/\s+/g, '').trim();
            if (val && !val.includes('Afficher')) {
              val = val.replace(/^tel:/, '').replace(/[^0-9]/g, '');
              if (val.length >= 10) return val;
            }
          }
        }
        return '';
      });
    } catch (err) {
      // Pas de log d'erreur ici
    }

    // Email
    const emailEl = await page.$('a[href^="mailto:"]').catch(() => null);
    if (emailEl) {
      const href = await emailEl.getAttribute('href');
      data.email = href.replace(/^mailto:/, '').split('?')[0].trim();
    }

    // Spécialisation (peut contenir des sous-spécialités)
    const specs = await page.$$eval(
      '[itemprop="medicalSpecialty"], .specialty, .lb-specialty, .profession-name',
      els => els.map(el => el.textContent.trim()).filter(Boolean)
    ).catch(() => []);
    if (specs.length) {
      data.specialisation = specs.join(', ');
    }

  } catch (err) {
    log(`  ⚠ Erreur extraction fiche : ${err.message}`);
  }

  return data;
}

// ─────────────────────────────────────────────
// ENRICHISSEMENT (Recherche Google / Doctolib / LinkedIn)
// ─────────────────────────────────────────────
async function enrichProfile(page, practitioner, linkedinCredentials = null) {
  log(`  🔍 Enrichissement pour ${practitioner.nom}...`);
  if (!practitioner.emails) practitioner.emails = [];
  if (practitioner.email) practitioner.emails.push(practitioner.email);
  
  // 🔵 DOCTOLIB
  const doctolibResult = await searchDoctolib(page, practitioner);
  if (doctolibResult && doctolibResult.url) {
    practitioner.url_doctolib = doctolibResult.url;
    if (doctolibResult.specialisation) practitioner.specialisation = doctolibResult.specialisation;
    
    // Fusionner proprement les téléphones
    if (doctolibResult.telephone) {
      const cleanDocTel = cleanPhone(doctolibResult.telephone);
      if (cleanDocTel && practitioner.telephone !== cleanDocTel) {
        practitioner.telephone = practitioner.telephone ? `${practitioner.telephone} / ${cleanDocTel}` : cleanDocTel;
      }
    }
  }

  // 🔵 LINKEDIN
  if (linkedinCredentials) {
    const linkedinResult = await searchLinkedIn(page, practitioner);
    if (linkedinResult && linkedinResult.url) {
      practitioner.url_linkedin = linkedinResult.url;
      practitioner.nom_linkedin = linkedinResult.name || '';
      
      if (linkedinResult.email) practitioner.emails.push(linkedinResult.email);
      if (linkedinResult.telephone && !practitioner.telephone) {
        practitioner.telephone = linkedinResult.telephone;
      }
    }
  }
}
// ─────────────────────────────────────────────
// SYNC GOOGLE SHEETS
// ─────────────────────────────────────────────
async function sendToGoogleWebhook(webhookUrl, data) {
  if (!webhookUrl) return;
  
  try {
    const emailList = [...new Set(data.emails || [])].filter(e => e).join(', ');
    const postData = {
      departement: data.departement,
      ville: data.ville,
      nom: data.nom,
      cabinet: data.cabinet,
      nom_linkedin: data.nom_linkedin || '',
      email: emailList || data.email || '',
      telephone: data.telephone || '',
      specialisation: data.specialisation || 'Ophtalmologue',
      url_linkedin: data.url_linkedin || '',
      url_doctolib: data.url_doctolib || '',
      url_pagesjaunes: data.url_pagesjaunes || ''
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData)
    });
    
    if (!response.ok) {
      console.error(`    ⚠ Webhook Google: HTTP ${response.status}`);
    }
  } catch (e) {
    console.error(`    ⚠ Erreur Webhook Google: ${e.message}`);
  }
}

async function phase2(page, progress, excel, linkedinCredentials = null, webhookUrl = null) {
  log('═══════════════════════════════════════════');
  log('  PHASE 2 – Extraction des données         ');
  log('═══════════════════════════════════════════');

  // Construire la liste complète de toutes les URLs avec leur dep associé
  const allTasks = [];
  for (const dep of DEPARTEMENTS) {
    const urls = progress.links[dep.code]?.urls || [];
    for (const url of urls) {
      allTasks.push({ url, dep });
    }
  }

  const processedSet = new Set(progress.processed || []);
  const todo = allTasks.filter(t => !processedSet.has(t.url));

  log(`📋 ${allTasks.length} fiches au total | ${processedSet.size} déjà traitées | ${todo.length} restantes`);

  let count = processedSet.size;
  let sinceLastSave = 0;

  for (const task of todo) {
    const { url, dep } = task;
    count++;

    const ok = await gotoWithRetry(page, url);
    if (!ok) {
      log(`  ✗ [${count}] Impossible d'accéder à ${url}`);
      continue;
    }

    const data = await extractFiche(page, url, dep);

    // Enrichissement multi-sources (Doctolib, LinkedIn, Site)
    await enrichProfile(page, data, linkedinCredentials);

    // Écritures
    await excel.addRow(data);
    await sendToGoogleWebhook(webhookUrl, data);
    
    progress.processed_urls.push(url);
    progress.processed.push(url);
    sinceLastSave++;

    log(`✓ [${count}] ${data.nom || '(sans nom)'} | ${data.ville} | ${data.telephone || '–'}`);

    // Sauvegarde progress toutes les 10 fiches
    if (sinceLastSave >= 10) {
      saveProgress(progress);
      sinceLastSave = 0;
    }

    await randDelay(DELAYS.detailPage);
  }

  // Sauvegarde finale
  saveProgress(progress);
  log(`\n✅ Phase 2 terminée – ${count} fiches traitées`);
  log(`📁 Fichier Excel : ${OUTPUT_FILE}`);
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const runPhase1 = !args.includes('--phase2');
  const runPhase2 = !args.includes('--phase1');
  const depArg = args.find(a => a.startsWith('--dep'));
  const targetDep = depArg ? depArg.split('=')[1] || args[args.indexOf('--dep') + 1] : null;

  if (targetDep) {
    const dep = DEPARTEMENTS.find(d => d.code === targetDep);
    if (!dep) {
      log(`❌ Département ${targetDep} non trouvé.`);
      process.exit(1);
    }
    // Mutation temporaire pour le run courant
    DEPARTEMENTS.length = 0;
    DEPARTEMENTS.push(dep);
    log(`🎯 Ciblage du département : ${dep.nom} (${dep.code})`);
  }

  log('🔌 Connexion à Chrome via CDP...');
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (err) {
    console.error(`\n❌ Impossible de se connecter à Chrome sur ${CDP_URL}`);
    console.error('   Lancez d\'abord Chrome avec :');
    console.error('   google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-scraper\n');
    process.exit(1);
  }

  // Récupérer le contexte et la page existants (session active)
  const contexts = browser.contexts();
  const context  = contexts.length ? contexts[0] : await browser.newContext();
  const pages    = context.pages();
  const page     = pages.length ? pages[0] : await context.newPage();

  log('✅ Connecté au navigateur Chrome (session active)');

  // Charger le progrès existant
  const progress = loadProgress();
  if (!progress.processed) progress.processed = [];
  if (!progress.processed_urls) progress.processed_urls = [];
  if (!progress.links)     progress.links = {};

  // Initialiser Excel
  const excel = new ExcelHelper(OUTPUT_FILE);
  await excel.init();

  // Charger config (LinkedIn + Webhook)
  let linkedinCredentials = null;
  let webhookUrl = null;
  if (fs.existsSync('config.json')) {
    try {
      const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
      if (config.linkedin) linkedinCredentials = config.linkedin;
      if (config.google_sheets_webhook) webhookUrl = config.google_sheets_webhook;
    } catch (e) {}
  }

  try {
    if (runPhase1) {
      await phase1(page, progress);
    }

    if (runPhase2) {
      // Login LinkedIn une seule fois au début de la Phase 2 si nécessaire
      if (linkedinCredentials) {
        await loginLinkedIn(page, linkedinCredentials);
      }
      await phase2(page, progress, excel, linkedinCredentials, webhookUrl);
    }
  } catch (err) {
    log(`\n💥 Erreur fatale : ${err.message}`);
    saveProgress(progress);
    console.error(err);
  } finally {
    // Ne pas fermer le navigateur (session partagée)
    log('🔌 Déconnexion du navigateur (Chrome reste ouvert)');
    await browser.close();
  }
}

main();
