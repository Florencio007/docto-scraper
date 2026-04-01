const fs = require('fs');
const PROGRESS_FILE = 'progress.json';

if (fs.existsSync(PROGRESS_FILE)) {
  const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  let resetCount = 0;

  if (progress.links) {
    for (const code in progress.links) {
      if (progress.links[code].done && (!progress.links[code].urls || progress.links[code].urls.length === 0)) {
        progress.links[code].done = false;
        resetCount++;
      }
    }
  }

  if (resetCount > 0) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
    console.log(`✅ ${resetCount} départements réinitialisés (0 liens trouvés précédemment)`);
  } else {
    console.log('ℹ️  Aucun département à réinitialiser.');
  }
} else {
  console.log('ℹ️  Fichier progress.json introuvable.');
}
