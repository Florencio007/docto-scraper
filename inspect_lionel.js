const { chromium } = require('playwright');
const CDP_URL = 'http://127.0.0.1:9222';

async function inspect() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  const page = contexts[0].pages()[0];

  const url = "https://www.pagesjaunes.fr/pros/05331520"; // Lionel Faure
  console.log(`Inspecting ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const data = await page.evaluate(() => {
    return {
      h1: document.querySelector('h1')?.innerText,
      h1_class: document.querySelector('h1')?.className,
      denomination: document.querySelector('.denomination-links')?.innerText,
      company: document.querySelector('.company-name')?.innerText,
      legal: document.querySelector('[itemprop="legalName"]')?.innerText,
      all_h1_h2: Array.from(document.querySelectorAll('h1, h2, h3')).map(el => `${el.tagName}: ${el.innerText.trim()}`)
    };
  });

  console.log(JSON.stringify(data, null, 2));
  await browser.disconnect();
}

inspect();
