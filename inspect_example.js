const Excel = require('exceljs');

async function readExample() {
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile('exemple.xlsx');
  const sheet = workbook.getWorksheet(1);
  
  console.log('--- HEADERS ---');
  const headers = sheet.getRow(1).values;
  console.log(JSON.stringify(headers));
  
  console.log('\n--- FIRST 2 ROWS ---');
  for (let i = 2; i <= 3; i++) {
    console.log(JSON.stringify(sheet.getRow(i).values));
  }
}

readExample();
