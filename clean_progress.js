const fs = require('fs');
const path = require('path');

const filePath = path.resolve('progress.json');
const raw = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(raw);

if (!data.extractedData) {
  console.log('Aucune donnée extraite trouvée.');
  process.exit(0);
}

const initialCount = data.extractedData.length;
data.extractedData = data.extractedData.filter(item => {
  const nom = (item.nom || '').toLowerCase();
  const isSecurity = nom.includes('sécurité') || nom.includes('security') || nom.includes('just a moment') || nom === '';
  return !isSecurity;
});

const finalCount = data.extractedData.length;
console.log(`Initial: ${initialCount}, Final: ${finalCount} (Supprimés: ${initialCount - finalCount})`);

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
