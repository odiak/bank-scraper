'use strict';

const puppeteer = require('puppeteer');

const scrape = async (page, {username, password}) => {
  await page.goto('https://ib.surugabank.co.jp/im/IBGate', {waitUntil: 'networkidle'});

  await page.focus('[name=USR_NAME]');
  await page.type(username);
  await page.focus('[name=MASK_LOGIN_PWD]');
  await page.type(password);
  await page.click('[name=ACT_doLogin]');

  await page.waitForNavigation();
  await page.waitForSelector('#foot');

  const hasNextButton = await page.evaluate(() => {
    return document.querySelector('[name=ACT_doNext]') != null;
  });
  if (hasNextButton) {
    await page.click('[name=ACT_doNext]');

    await page.waitForNavigation();
    await page.waitForSelector('#foot');
  }

  const detailUrl = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table>tbody>tr:nth-child(2)'));
    const row = rows.find(r => r.childElementCount === 6);
    return row.querySelector('a').href;
  });

  await page.goto(detailUrl);
  await page.waitForSelector('#foot');

  await page.evaluate(() => {
    const e = document.querySelector('table .txt-notes');
    let [year, month, day] = e.textContent.match(/\d+/g);
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    document.querySelector('[name=SEARCH_FROM_YEAR]').value = year;
    document.querySelector('[name=SEARCH_FROM_MONTH]').value = month;
    document.querySelector('[name=SEARCH_FROM_DAY]').value = day;
  });
  await page.click('.btnMain2S > a');
  await page.waitForNavigation();
  await page.waitForSelector('#foot');

  const {accountInfo, transactions} = await page.evaluate(() => {
    const tbodies = document.querySelectorAll('table>tbody');

    const accountInfo = (() => {
      const row = tbodies[1].children[1];
      const branch = row.children[0].textContent.trim();
      const accountType = row.children[1].textContent.trim();
      const accountCode = row.children[2].textContent.trim();
      const balance = parseInt(row.children[3].textContent.trim().replace(/,/g, ''));
      return {branch, accountType, accountCode, balance};
    })();

    const transactions = (() => {
      const tbody = tbodies[2];
      if (tbody == null) {
        return [];
      }
      const transactions = [];
      const rows = Array.from(tbody.children);
      for (let i = 2; i + 1 < rows.length; i += 2) {
        const date = rows[i].children[0].textContent.trim().replace(/\//g, '-');
        const drawingStr = rows[i].children[1].textContent.trim().replace(',', '');
        const drawing = drawingStr && parseInt(drawingStr, 10) || null;
        const depositStr = rows[i].children[2].textContent.trim().replace(',', '');
        const deposit = depositStr && parseInt(depositStr, 10) || null;
        const title = rows[i].children[3].textContent.trim();
        const transactionType = rows[i + 1].children[0].textContent.trim();
        transactions.push({
          date,
          drawing,
          deposit,
          title,
          transactionType,
        });
      };
      return transactions;
    })();

    return {accountInfo, transactions};
  });

  return {accountInfo, transactions};
};

module.exports = async ({username, password}) => {
  if (!username || !password) {
    throw new Error('both username and password must not be empty');
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    return await scrape(page, {username, password});
  } finally {
    await browser.close();
  }
};
