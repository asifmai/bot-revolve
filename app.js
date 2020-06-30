const pupHelper = require('./puppeteerhelper');
const moment = require('moment');
const fs = require('fs');
const {siteLink, email, password, countryCode} = require('./keys');
let browser;
let page;
const products = [];
let productLinks = [];
productLinks = JSON.parse(fs.readFileSync('productLinks.json', 'utf8'));
const filePath = `results ${moment().format('MM-DD-YYYY HH-mm')}.json`;

const run = async () => {
  try {
    console.log('Started Scraping...');
    browser = await pupHelper.launchBrowser(true);
    page = await pupHelper.launchPage(browser);
    await page.goto(siteLink, {timeout: 0, waitUntil: 'load'});
  
    console.log('Changing Country...');
    await changeCountry();

    console.log('Loggig in...');
    await loginUser();

    console.log('Fetching Products Links from Favorites...');
    await fetchProductsLinks();

    console.log('Fetching Products Details...');
    for (let i = 0; i < productLinks.length; i++) {
      await fetchProduct(i);
    }

    console.log('Saving Products in JSON...');
    fs.writeFileSync(filePath, JSON.stringify(products));
    
    console.log('Finished Scraping...');
    await browser.close();
    return;
  } catch (error) {
    if (browser) await browser.close();
    console.log(`Run Error: ${error}`);
    return error;
  }
}

const changeCountry = () => new Promise(async (resolve, reject) => {
  try {
    await page.waitForSelector('.site-header__container > .site-header__block:first-child a.js-modal');
    await page.click('.site-header__container > .site-header__block:first-child a.js-modal');
    await page.waitFor(1000);
    await page.click('.site-header__container > .site-header__block:first-child a.js-modal');
    await page.waitForSelector('#country_pref select#preferences-shipTo');
    await page.select('#country_pref select#preferences-shipTo', countryCode);
    await page.waitFor(2000);
    await page.click('#country_pref button.btn--lg');
    await page.waitFor(8000);
    
    resolve(true);
  } catch (error) {
    console.log(`changeCountry Error: ${error}`);
    reject(error);
  }
})

const loginUser = () => new Promise(async (resolve, reject) => {
  try {
    await page.waitForSelector('a#js-header-signin-link');
    await page.click('a#js-header-signin-link');
    await page.waitForSelector('form[onsubmit="startSignIn();return false;"] input#emailCustomer');
    await page.type('form[onsubmit="startSignIn();return false;"] input#emailCustomer', email, {delay: 50});
    await page.type('form[onsubmit="startSignIn();return false;"] input#passwordCustomer', password, {delay: 50});
    await page.click('form[onsubmit="startSignIn();return false;"] input#signInButton');
    await page.waitFor(8000);
    
    resolve(true);
  } catch (error) {
    console.log(`loginUser Error: ${error}`);
    reject(error);
  }
});

const fetchProductsLinks = () => new Promise(async (resolve, reject) => {
  try {
    await page.waitForSelector('.site-header__container > .site-header__block:last-child li#optbc_header_myfav > a');
    await page.click('.site-header__container > .site-header__block:last-child li#optbc_header_myfav > a');
    await page.waitForSelector('ul#plp-prod-list > li.item > .plp_image_wrap > a');
    productLinks = await pupHelper.getAttrMultiple('ul#plp-prod-list > li.item > .plp_image_wrap > a', 'href', page);
    productLinks = productLinks.map(pl => siteLink + pl);
    
    resolve(true);
  } catch (error) {
    console.log(`fetchProductsLinks Error: ${error}`);
    reject(error);
  }
});

const fetchProduct = (prodIdx) => new Promise(async (resolve, reject) => {
  let productPage;
  try {
    console.log(`${prodIdx+1}/${productLinks.length} - Fetching Product Details [${productLinks[prodIdx]}]`);
    const product = {};
    productPage = await pupHelper.launchPage(browser);
    await productPage.goto(productLinks[prodIdx], {timeout: 0, waitUntil: 'load'});
    await productPage.waitForSelector('.pdp__description-wrap');

    product.url = productLinks[prodIdx];
    
    product.name = await pupHelper.getTxt('.pdp__description-wrap h1.product-name--lg', productPage);
    product.name = product.name.replace(/\n.*$/gi, '').trim();

    product.badge = await pupHelper.getTxt('.pdp__description-wrap .badge', productPage);

    product.brand = await pupHelper.getTxt('.pdp__description-wrap a.product-brand--lg', productPage);
    product.brand = product.brand.replace(/^.*\n/gi, '').trim();

    product.price = await pupHelper.getTxt('.pdp__description-wrap .price__retail', productPage);
    product.price = product.price.replace(/,/gi, '').trim().replace(/clp/gi, '').trim()

    product.priceSale = await pupHelper.getTxt('.pdp__description-wrap .price__sale', productPage);
    product.priceSale = product.priceSale.replace(/,/gi, '').trim().replace(/clp/gi, '').trim()
    
    product.currency = 'CLP';

    product.sizeTitle = await pupHelper.getTxt('.pdp__description-wrap .product-sizes .product-sections__hed', productPage);

    product.sizeOptions = await pupHelper.getTxtMultiple('.pdp__description-wrap .product-sizes ul#size-ul > li.size-options__item .push-button__copy', productPage);

    product.images = await pupHelper.getAttrMultiple('.pdp__image-wrap .slideshow__pager > a', 'data-image', productPage);

    product.color = await pupHelper.getTxt('.pdp__description-wrap .selectedColor', productPage);

    product.delivery = await pupHelper.getTxt('.pdp__description-wrap .shippingText > p#regularDelivery', productPage);

    product.description = await pupHelper.getTxt('.pdp__description-wrap .product-details > .product-details__description', productPage);

    const descLis = product.description.split('\n');
    const ref = descLis[descLis.length - 2];
    const refRegEx = new RegExp('(?<=revolve).*$', 'gi');
    product.reference = refRegEx.test(ref) ? ref.match(refRegEx)[0].trim() : '';
    
    const bRef = descLis[descLis.length - 1];
    const bRefRegEx = new RegExp('(?<=fabricante).*$', 'gi');
    product.brandReference = bRefRegEx.test(bRef) ? bRef.match(bRefRegEx)[0].trim() : '';

    product.aboutBrand = await pupHelper.getTxt('.pdp__description-wrap .product-details > .product-details__about-brand', productPage);

    products.push(product);
    
    await productPage.close();
    resolve(true);
  } catch (error) {
    if (productPage) await productPage.close();
    console.log(`fetchProduct [${productLinks[prodIdx]}] Error: ${error}`);
    reject(error);
  }
});

run();