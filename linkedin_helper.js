const randDelay = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

/**
 * Connecte le navigateur à LinkedIn si nécessaire.
 */
async function loginLinkedIn(page, credentials) {
  const { email, password } = credentials;
  
  try {
    console.log('    🔐 Connexion à LinkedIn...');
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
    await randDelay(2000, 4000);

    // Vérifier si déjà connecté
    if (page.url().includes('/feed/')) {
      console.log('    ✅ Déjà connecté à LinkedIn');
      return true;
    }

    // Remplir le formulaire
    await page.fill('#username', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    
    if (page.url().includes('/feed/')) {
      console.log('    ✅ Connexion LinkedIn réussie');
      return true;
    } else {
      console.warn('    ⚠ Vérification manuelle (2FA ?) requise sur LinkedIn');
      // On laisse une chance à l'utilisateur d'intervenir
      await page.waitForTimeout(10000); 
    }
  } catch (err) {
    console.error(`    ❌ Erreur login LinkedIn: ${err.message}`);
  }
  return false;
}

/**
 * Visite un profil LinkedIn et extrait les coordonnées (Email, Téléphone).
 */
async function extractLinkedInContactInfo(page, profileUrl) {
  try {
    console.log(`    🌐 Visite du profil: ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
    await randDelay(500, 1000); // ++Accéléré

    // Cliquer sur "Contact info"
    const contactInfoBtn = await page.$('#top-card-text-details-contact-info, a[href*="/contact-info/"]');
    if (contactInfoBtn) {
      await contactInfoBtn.click();
      await page.waitForSelector('.pv-contact-info__contact-type', { timeout: 5000 }).catch(() => {});
      await randDelay(1000, 2000);

      const contactData = await page.evaluate(() => {
        const result = { email: null, telephone: null };
        
        const sections = Array.from(document.querySelectorAll('.pv-contact-info__contact-type'));
        
        // Extraction Email
        const emailSection = sections.find(el => el.innerText.toLowerCase().includes('email') || el.querySelector('a[href^="mailto:"]'));
        if (emailSection) {
          const link = emailSection.querySelector('a[href^="mailto:"]');
          if (link) result.email = link.innerText.trim();
        }

        // Extraction Téléphone
        const phoneSection = sections.find(el => el.innerText.toLowerCase().includes('téléphone') || el.innerText.toLowerCase().includes('phone'));
        if (phoneSection) {
          const phoneEl = phoneSection.querySelector('ul li span') || phoneSection.querySelector('span');
          if (phoneEl) result.telephone = phoneEl.innerText.trim();
        }

        return result;
      });

      if (contactData.email) console.log(`    📧 Email LinkedIn: ${contactData.email}`);
      if (contactData.telephone) console.log(`    📞 Téléphone LinkedIn: ${contactData.telephone}`);
      
      return contactData;
    }
  } catch (err) {
    console.error(`    ⚠ Erreur extraction contact LinkedIn: ${err.message}`);
  }
  return { email: null, telephone: null };
}

/**
 * Recherche un praticien sur LinkedIn via Google et tente d'extraire les coordonnées.
 */
async function searchLinkedIn(page, practitioner) {
  const { nom, ville } = practitioner;
  const searchUrl = `https://fr.search.yahoo.com/search?p=${encodeURIComponent('site:linkedin.com/in "' + nom + '" ophtalmologue ' + (ville || ''))}`;
  
  try {
    console.log(`    🔍 Recherche profil LinkedIn (via Yahoo): ${nom}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'linkedin_test.jpg' });
    
    // Cookie banner potentiel
    const acceptBtn = await page.$('.consent-form button[type="submit"][name="agree"]');
    if(acceptBtn) await acceptBtn.click().catch(() => {});
    
    await randDelay(500, 1000); // ++Accéléré

    const profileUrl = await page.evaluate((pratNom) => {
      const slugify = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ');
      const words = slugify(pratNom).split(' ').filter(w => w.length > 2); // Ex: ['antoine', 'susini']

      const links = Array.from(document.querySelectorAll('a.ac-algo, .algo a, h3 a, a'));
      const validLink = links.find(a => {
        let href = a.href ? a.href.toLowerCase() : '';
        if (href.includes('yahoo.com/')) {
           try {
             const decoded = decodeURIComponent(href);
             const ruMatch = decoded.match(/RU=(https?:\/\/[^/]*linkedin\.com\/in\/[^/]+)/i);
             if (ruMatch) href = ruMatch[1].toLowerCase();
           } catch(e) {}
        }
        
        if (href.includes('/google-search/') || !href.includes('linkedin.com/in/')) return false;

        const textSlug = slugify(a.innerText || '');
        
        // Au moins 2 mots clés du praticien doivent se retrouver dans le lien ou le texte Yahoo
        const matchCount = words.filter(w => href.includes(w) || textSlug.includes(w)).length;
        return matchCount >= Math.min(2, words.length);
      });
      
      if (validLink) {
        let finalHref = validLink.href;
        if (finalHref.includes('yahoo.com/')) {
           try {
             const decoded = decodeURIComponent(finalHref);
             const ruMatch = decoded.match(/RU=(https?:\/\/[^/]*linkedin\.com\/in\/[^/]+)/i);
             if (ruMatch) finalHref = ruMatch[1];
           } catch(e) {}
        }
        return finalHref.split('&')[0].split('?')[0];
      }
      return null;
    }, nom);

    if (profileUrl) {
      console.log(`    ✅ Profil LinkedIn localisé: ${profileUrl}`);
      const result = { url: profileUrl, name: nom, email: null, telephone: null };

      // Tentative d'extraction profonde
      try {
        const contactInfo = await extractLinkedInContactInfo(page, profileUrl);
        Object.assign(result, contactInfo);
      } catch (e) {
        console.warn(`      ⚠ Échec extraction contact LinkedIn (${e.message}). Lien conservé.`);
      }

      return result;
    }
  } catch (err) {
    console.error(`    ⚠ Erreur recherche LinkedIn: ${err.message}`);
  }
  return null;
}

module.exports = { loginLinkedIn, searchLinkedIn };
