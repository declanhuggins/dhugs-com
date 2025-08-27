import { Builder, By, until } from 'selenium-webdriver';
// Use the TypeScript-friendly chrome import path (no extension)
import chrome from 'selenium-webdriver/chrome';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

type Mode = 'Desktop' | 'Mobile';

async function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Using 'any' for driver due to shimmed module lacking full TypeScript types
async function runFlow(driver: any, mode: Mode): Promise<void> {
  console.log(`${mode} - Opening home page`);
  await driver.get(BASE_URL);
  await pause(1000);

  if (mode === 'Mobile') {
    // Wait for and open the mobile navigation menu
    await driver.wait(until.elementLocated(By.css('button[aria-label="Open menu"]')), 5000);
    await driver.findElement(By.css('button[aria-label="Open menu"]')).click();
    await pause(500);
  }

  console.log(`${mode} - Navigating to About`);
  await driver.wait(until.elementLocated(By.css('a[href="/about/"]')), 5000);
  await driver.findElement(By.css('a[href="/about/"]')).click();
  await driver.wait(until.urlContains('/about'), 5000);
  await pause(1000);
  console.log(`${mode} - Scrolling About page`);
  await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
  await pause(1000);
  await driver.executeScript('window.scrollTo(0, 0)');
  await pause(500);

  console.log(`${mode} - Back to home`);
  await driver.findElement(By.css('a[href="/"]')).click();
  await pause(1000);

  console.log(`${mode} - Navigating to Portfolio`);
  await driver.wait(until.elementLocated(By.css('a[href="/portfolio/"]')), 5000);
  await driver.findElement(By.css('a[href="/portfolio/"]')).click();
  await driver.wait(until.urlContains('/portfolio'), 5000);
  await pause(1000);
  console.log(`${mode} - Scrolling Portfolio page`);
  await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
  await pause(1000);
  await driver.executeScript('window.scrollTo(0, 0)');
  await pause(500);
  await driver.findElement(By.css('a[href="/"]')).click();
  await pause(1000);

  console.log(`${mode} - Opening first post from home page`);
  const postLink = await driver.findElement(By.css('article h2 a'));
  await postLink.click();
  await driver.wait(until.elementLocated(By.css('article')), 5000);
  await pause(1000);
  console.log(`${mode} - Scrolling through post`);
  await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
  await pause(1000);
  await driver.executeScript('window.scrollTo(0, 0)');
  await pause(500);

  console.log(`${mode} - Back to home`);
  await driver.navigate().back();
  await pause(1000);

  console.log(`${mode} - Navigating to Archive`);
  await driver.wait(until.elementLocated(By.css('a[href="/archive/"]')), 5000);
  await driver.findElement(By.css('a[href="/archive/"]')).click();
  await driver.wait(until.urlContains('/archive'), 5000);
  await pause(1000);
  console.log(`${mode} - Scrolling Archive page`);
  await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
  await pause(1000);
  await driver.executeScript('window.scrollTo(0, 0)');
  await pause(500);

  console.log(`${mode} - Opening first year`);
  const yearLink = await driver.findElement(By.css('a[href^="/20"]'));
  await yearLink.click();
  await pause(1000);
  console.log(`${mode} - Scrolling Year page`);
  await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
  await pause(1000);
  await driver.executeScript('window.scrollTo(0, 0)');
  await pause(500);

  // console.log(`${mode} - Opening first month`);
  // const monthLink = await driver.findElement(By.css('ul li a'));
  // await monthLink.click();
  // await pause(1000);
  // console.log(`${mode} - Scrolling Month page`);
  // await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
  // await pause(1000);
  // await driver.executeScript('window.scrollTo(0, 0)');
  // await pause(500);

  // console.log(`${mode} - Opening first post in month`);
  // const monthPost = await driver.findElement(By.css('article h2 a'));
  // await monthPost.click();
  // await driver.wait(until.elementLocated(By.css('article')), 5000);
  // await pause(1000);
  // console.log(`${mode} - Scrolling through month post`);
  // await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
  // await pause(1000);
  // await driver.executeScript('window.scrollTo(0, 0)');
  // await pause(500);
}

async function main(): Promise<void> {
  // Desktop mode
  const desktopOptions = new chrome.Options();
  desktopOptions.addArguments('--no-sandbox', '--start-maximized');
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(desktopOptions)
    .build();

  try {
    await runFlow(driver, 'Desktop');
  } catch (err) {
    console.error(err);
  } finally {
    await driver.quit();
  }

  // Mobile mode (iPhone 12)
  const mobileOptions = new chrome.Options();
  mobileOptions.setMobileEmulation({ deviceName: 'iPhone X' });
  const driverMobile = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(mobileOptions)
    .build();

  try {
    await runFlow(driverMobile, 'Mobile');
  } catch (err) {
    console.error(err);
  } finally {
    await driverMobile.quit();
  }
}

// Execute only when run directly (not when imported)
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error in selenium browse script:', err);
    process.exitCode = 1;
  });
}
