const puppeteer = require('puppeteer');
const path = require('path');

async function generateOGImage() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport to OG image dimensions
  await page.setViewport({
    width: 1200,
    height: 630,
    deviceScaleFactor: 2 // For higher quality
  });
  
  // Load the HTML template
  await page.goto(`file://${path.join(__dirname, '../public/og-image-template.html')}`);
  
  // Take screenshot
  await page.screenshot({
    path: path.join(__dirname, '../public/og-image.png'),
    type: 'png'
  });
  
  await browser.close();
  console.log('OG image generated successfully at public/og-image.png');
}

generateOGImage().catch(console.error);