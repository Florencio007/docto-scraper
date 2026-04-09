const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const PROGRESS_FILE = path.resolve('progress.json');
const EXCEL_FILE = path.resolve('ophtalmologues_zone3.xlsx');

async function cleanAll() {
  console.log('🧹 Nettoyage des entrées "Sécurité"...');

  // 1. Nettoyage de progress.json
  if (fs.existsSync(PROGRESS_FILE)) {
    let progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    const initialProcessedCount = progress.processed ? progress.processed.length : 0;
    
    // Note: Dans cet environnement, progress.processed contient les URLs.
    // Mais on ne sait pas lesquelles correspondent à "Sécurité" sans le fichier Excel
    // ou sans re-scanner. Cependant, si on a le nom dans progress.extractedData (s'il existe), on peut filtrer.
    
    // Si la structure a évolué et contient extractedData:
    if (progress.extractedData) {
      progress.extractedData = progress.extractedData.filter(item => {
        const nom = (item.nom || '').toLowerCase();
        return !nom.includes('sécurité') && !nom.includes('security');
      });
    }
    
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    console.log('✅ progress.json nettoyé.');
  }

  // 2. Nettoyage de l'Excel
  if (fs.existsSync(EXCEL_FILE)) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE);
    const sheet = workbook.getWorksheet(1);
    
    let deletedCount = 0;
    // On parcourt à l'envers pour ne pas décaler les indices lors de la suppression
    for (let i = sheet.rowCount; i >= 1; i--) {
      const row = sheet.getRow(i);
      const nom = (row.getCell(4).value || '').toString().toLowerCase();
      
      if (nom.includes('sécurité') || nom.includes('security')) {
        sheet.spliceRows(i, 1);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      await workbook.xlsx.writeFile(EXCEL_FILE);
      console.log(`✅ Excel nettoyé : ${deletedCount} lignes supprimées.`);
    } else {
      console.log('ℹ️ Aucune ligne "Sécurité" trouvée dans l\'Excel.');
    }
  }
}

cleanAll().catch(console.error);
