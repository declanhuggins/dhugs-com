import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const options = new chrome.Options();
  options.addArguments('--headless', '--disable-gpu', '--no-sandbox');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    console.log('Opening home page');
    await driver.get(BASE_URL);
    await pause(1000);

    console.log('Navigating to About');
    await driver.wait(until.elementLocated(By.css('a[href="/about/"]')), 5000);
    await driver.findElement(By.css('a[href="/about/"]')).click();
    await driver.wait(until.urlContains('/about'), 5000);
    await pause(1000);

    console.log('Back to home');
    await driver.findElement(By.css('a[href="/"]')).click();
    await pause(1000);

    console.log('Navigating to Portfolio');
    await driver.wait(until.elementLocated(By.css('a[href="/portfolio/"]')), 5000);
    await driver.findElement(By.css('a[href="/portfolio/"]')).click();
    await driver.wait(until.urlContains('/portfolio'), 5000);
    await pause(1000);
    await driver.findElement(By.css('a[href="/"]')).click();
    await pause(1000);

    console.log('Opening first post from home page');
    const postLink = await driver.findElement(By.css('article h2 a'));
    await postLink.click();
    await driver.wait(until.elementLocated(By.css('article')), 5000);
    await pause(1000);
    console.log('Scrolling through post');
    await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
    await pause(1000);
    await driver.executeScript('window.scrollTo(0, 0)');

    console.log('Back to home');
    await driver.navigate().back();
    await pause(1000);

    console.log('Navigating to Archive');
    await driver.wait(until.elementLocated(By.css('a[href="/archive/"]')), 5000);
    await driver.findElement(By.css('a[href="/archive/"]')).click();
    await driver.wait(until.urlContains('/archive'), 5000);
    await pause(1000);

    console.log('Opening first year');
    const yearLink = await driver.findElement(By.css('a[href^="/20"]'));
    await yearLink.click();
    await pause(1000);

    console.log('Opening first month');
    const monthLink = await driver.findElement(By.css('ul li a'));
    await monthLink.click();
    await pause(1000);

    console.log('Opening first post in month');
    const monthPost = await driver.findElement(By.css('article h2 a'));
    await monthPost.click();
    await driver.wait(until.elementLocated(By.css('article')), 5000);
    await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
    await pause(1000);
  } catch (err) {
    console.error(err);
  } finally {
    await driver.quit();
  }
}

main();
