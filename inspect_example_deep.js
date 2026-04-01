const Excel = require('exceljs');

async function readExample() {
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile('exemple.xlsx');
  const sheet = workbook.getWorksheet(1);
  
  console.log('--- HEADERS (Row 2 & 3) ---');
  console.log('Row 2: ' + JSON.stringify(sheet.getRow(2).values));
  console.log('Row 3: ' + JSON.stringify(sheet.getRow(3).values));
  
  console.log('\n--- DATA (Row 4 & 5) ---');
  for (let i = 4; i <= 5; i++) {
    const row = sheet.getRow(i);
    console.log(`Row ${i}: ` + JSON.stringify(row.values));
  }
}

readExample();
