const fs = require('fs');
const PROGRESS_FILE = 'progress.json';

try {
    let progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    progress.processed_urls = [];
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
    console.log('✅ progress.json réinitialisé : processed_urls est vide.');
} catch (e) {
    console.error('❌ Erreur réinitialisation progress.json:', e.message);
}
