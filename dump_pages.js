const { chromium } = require('playwright');
const fs = require('fs');

async function dump() {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const contexts = browser.contexts();
    const pages = contexts[0].pages();
    
    for (const page of pages) {
        const url = page.url();
        console.log(`Dumping ${url}...`);
        const content = await page.content();
        const filename = url.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.html';
        fs.writeFileSync(filename, content);
        console.log(`Saved to ${filename}`);
    }
    await browser.disconnect();
}

dump().catch(console.error);
