const randDelay = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

/**
 * Recherche un praticien sur Doctolib via DuckDuckGo et extrait les infos du profil.
 */
async function searchDoctolib(page, practitioner) {
  const { nom, ville } = practitioner;
  const searchUrl = `https://fr.search.yahoo.com/search?p=${encodeURIComponent('site:doctolib.fr "' + nom + '" ' + (ville || ''))}`;
  
  try {
    console.log(`    🔍 Recherche Doctolib via Yahoo: ${nom}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'ddg_test.jpg' });
    
    // Cookie banner potentiel
    const acceptBtn = await page.$('.consent-form button[type="submit"][name="agree"]');
    if(acceptBtn) await acceptBtn.click().catch(() => {});
    
    await randDelay(500, 1000); // ++Accéléré

    // Extraire un lien qui ressemble au nom (filtre assoupli)
    const profileUrl = await page.evaluate((pratNom) => {
      const slugify = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ');
      const words = slugify(pratNom).split(' ').filter(w => w.length > 2); // Garder les mots de > 2 lettres (exclure Dr, Pr)
      
      const links = Array.from(document.querySelectorAll('a.ac-algo, .algo a, h3 a, a'));
      const validLink = links.find(a => {
        const href = a.href ? a.href.toLowerCase() : '';
        if (!href.includes('doctolib.fr')) return false;
        
        // Un lien est valide si l'URL contient au moins 2 mots du nom (ex: Nom + Ville ou Prénom + Nom)
        const matchCount = words.filter(w => href.includes(w)).length;
        return (href.includes('/ophtalmologue/') || href.includes('/cabinet-medical/')) && matchCount >= 1;
      });
      return validLink ? validLink.href.split('&')[0] : null;
    }, nom);

    if (profileUrl) {
      console.log(`    ✅ Trouvé sur Doctolib: ${profileUrl}`);
      
      const result = { url: profileUrl, emails: [], specialisation: null, telephone: null };

      // Tentative de visite pour l'enrichissement profond
      try {
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await randDelay(500, 1000); // ++Accéléré

        // Détection Cloudflare
        if (await page.content().then(c => c.includes('cf-turnstile') || c.includes('Une dernière étape') || c.includes('Retry later'))) {
          console.warn('      ⚠ Blocage Cloudflare/RateLimit Doctolib. On garde juste le lien.');
        } else {
          const info = await page.evaluate(() => {
            const res = { emails: [], specialisation: null, telephone: null };
            const specEl = document.querySelector('.dl-profile-header-speciality, h2.dl-text-body, [data-test="profile-speciality"]');
            if (specEl) res.specialisation = specEl.innerText.trim();

            const telEl = document.querySelector('.dl-profile-practice-phone, [href^="tel:"]');
            if (telEl) {
              res.telephone = telEl.innerText.replace(/[^\d+]/g, '');
            } else {
               // Fallback global par regex si pas trouvé dans les éléments clés
               const telMatch = document.body.innerText.match(/(?:(?:\+|00)33|0)[ -]?[1-9](?:[ -]*\d{2}){4,}/);
               if (telMatch) res.telephone = telMatch[0].replace(/[^\d+]/g, '');
            }

            // Déduplication si répétition exacte
            if (res.telephone && res.telephone.length >= 10 && res.telephone.length % 2 === 0) {
              const half = res.telephone.length / 2;
              if (res.telephone.slice(0, half) === res.telephone.slice(half)) {
                res.telephone = res.telephone.slice(0, half);
              }
            }

            const bodyText = document.body.innerText;
            const emailMatches = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
            if (emailMatches) res.emails = [...new Set(emailMatches)];
            return res;
          });
          Object.assign(result, info);
        }
      } catch (e) {
        console.warn(`      ⚠ Impossible de visiter le profil Doctolib (${e.message}). Lien conservé.`);
      }

      return result;
    }
  } catch (err) {
    console.error(`    ⚠ Erreur recherche Doctolib: ${err.message}`);
  }
  return null;
}

module.exports = { searchDoctolib };
