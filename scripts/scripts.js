import {
  ANALYTICS_LINK_TYPE_NAV_PAGINATE,
  ANALYTICS_TEMPLATE_ZONE_BODY,
  ANALYTICS_MODULE_SEARCH_PAGINATION,
  ANALYTICS_MODULE_CONTENT,
  ANALYTICS_LINK_TYPE_CONTENT_MODULE,
} from './constants.js';
import {
  sampleRUM,
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForLCP,
  loadBlocks,
  loadCSS,
  getMetadata,
  loadScript,
} from './lib-franklin.js';

const LCP_BLOCKS = []; // add your LCP blocks to the list

// regex to find abstract paragraph
export const ABSTRACT_REGEX = /(.*?);.*?(\d{4})|(.*?)(\d{4})\s+–\s+\b|(.*?)(\d{4})\s+-\s+\b/;

export function getLocale(path) {
  const locale = path.split('/')[1];
  if (/^[a-z]{2}$/.test(locale)) {
    return locale;
  }
  return 'us';
}

export function getCountryLanguage(locale) {
  const langs = {
    us: 'us-en',
  };
  let language = langs[locale];
  if (!language) language = 'us-en';

  return language;
}

/**
 * Annotates given link element with click tracking attributes
 *
 * @param {*} el
 * @param {*} elName
 * @param {*} moduleName
 * @param {*} templateZone
 * @param {*} linkType
 * @returns
 */

export function annotateElWithAnalyticsTracking(el, elName, moduleName, templateZone, linkType) {
  if (!el) return;
  el.setAttribute('data-analytics-link-name', elName);
  el.setAttribute('data-analytics-module-name', moduleName);
  el.setAttribute('data-analytics-template-zone', templateZone);
  el.setAttribute('data-analytics-link-type', linkType);
}

/**
 * Creates link element with click tracking attributes
 * @param {*} href
 * @param {*} text
 * @param {*} moduleName
 * @param {*} templateZone
 * @param {*} linkType
 * @returns annotate anchor tag
 */

export function createAnnotatedLinkEl(href, text, moduleName, templateZone, linkType) {
  const link = document.createElement('a');
  link.href = href;
  link.innerText = text;
  link.title = text;
  annotateElWithAnalyticsTracking(link, text, moduleName, templateZone, linkType);
  return link;
}

/**
 * Traverse the whole json structure in data and replace '0' with empty string
 * @param {*} data
 * @returns updated data
 */
function replaceEmptyValues(data) {
  Object.keys(data).forEach((key) => {
    if (typeof data[key] === 'object') {
      replaceEmptyValues(data[key]);
    } else if (data[key] === '0') {
      data[key] = '';
    }
  });
  return data;
}

function skipInternalPaths(jsonData) {
  const internalPaths = ['/search', '/'];
  const regexp = [/drafts\/.*/, /\/industries\/.*/, /\/subjects\/.*/];
  const templates = ['category'];
  return jsonData.filter((row) => {
    if (internalPaths.includes(row.path)) {
      return false;
    }
    if (regexp.some((r) => r.test(row.path))) {
      return false;
    }
    if (templates.includes(row.template)) {
      return false;
    }
    return true;
  });
}

export async function fetchIndex(indexURL = '/query-index.json', limit = 1000) {
  if (window.queryIndex && window.queryIndex[indexURL]) {
    return window.queryIndex[indexURL];
  }
  try {
    const resp = await fetch(`${indexURL}?limit=${limit}`);
    const json = await resp.json();
    replaceEmptyValues(json.data);
    const queryIndex = skipInternalPaths(json.data);
    window.queryIndex = window.queryIndex || {};
    window.queryIndex[indexURL] = queryIndex;
    return queryIndex;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`error while fetching ${indexURL}`, e);
    return [];
  }
}

// DOM helper
export function createEl(name, attributes = {}, content = '', parentEl = null) {
  const el = document.createElement(name);

  Object.keys(attributes).forEach((key) => {
    el.setAttribute(key, attributes[key]);
  });
  if (content) {
    if (typeof content === 'string') {
      el.innerHTML = content;
    } else if (content instanceof NodeList) {
      content.forEach((itemEl) => {
        el.append(itemEl);
      });
    } else if (content instanceof HTMLCollection) {
      Array.from(content).forEach((itemEl) => {
        el.append(itemEl);
      });
    } else {
      el.append(content);
    }
  }
  if (parentEl) {
    parentEl.append(el);
  }
  return el;
}

function findArticleIndex(queryIndex, path) {
  let articleIndex = -1;
  for (let i = 0; i < queryIndex.length; i += 1) {
    if (queryIndex[i].path === path) {
      articleIndex = i;
      break;
    }
  }
  return articleIndex;
}

async function addPrevNextLinksToArticles() {
  const template = getMetadata('template');
  const heroBlock = document.querySelector('.hero.block');
  if (template !== 'Article' || !heroBlock) {
    return;
  }
  const indexURL = '/query-index.json';
  const limit = 10000;
  const queryIndex = await fetchIndex(indexURL, limit);
  // iterate queryIndex to find current article and add prev/next links
  const currentArticlePath = window.location.pathname;
  const currentArticleIndex = findArticleIndex(queryIndex, currentArticlePath);
  if (currentArticleIndex === -1) {
    return;
  }
  const prevArticle = queryIndex[currentArticleIndex + 1];
  const nextArticle = queryIndex[currentArticleIndex - 1];
  const heroLinkContainer = heroBlock.querySelector('.hero-link-container');
  let prevLink = '';
  let nextLink = '';
  if (prevArticle) {
    prevLink = createEl('a', { href: prevArticle.path, class: 'prev', title: 'Prev' }, 'Previous');
  } else {
    prevLink = createEl('a', { href: '#', class: 'prev disabled', title: 'Prev' }, 'Previous');
  }
  if (nextArticle) {
    nextLink = createEl('a', { href: nextArticle.path, class: 'next', title: 'Next' }, 'Next');
  } else {
    nextLink = createEl('a', { href: '#', class: 'next disabled', title: 'Next' }, 'Next');
  }
  annotateElWithAnalyticsTracking(
    prevLink,
    'Prev',
    ANALYTICS_MODULE_SEARCH_PAGINATION,
    ANALYTICS_TEMPLATE_ZONE_BODY,
    ANALYTICS_LINK_TYPE_NAV_PAGINATE,
  );
  annotateElWithAnalyticsTracking(
    nextLink,
    'Next',
    ANALYTICS_MODULE_SEARCH_PAGINATION,
    ANALYTICS_TEMPLATE_ZONE_BODY,
    ANALYTICS_LINK_TYPE_NAV_PAGINATE,
  );
  heroLinkContainer.append(prevLink);
  heroLinkContainer.append(nextLink);
}

function annotateArticleSections() {
  const template = getMetadata('template');
  if (template !== 'Article') {
    return;
  }
  const articleSections = document.querySelectorAll('main > .section');

  // eslint-disable-next-line no-restricted-syntax
  for (const section of articleSections) {
    const sectionText = section.innerText;
    const isAbstract = ABSTRACT_REGEX.test(sectionText);
    if (isAbstract) {
      section.classList.add('abstract');
      const h1 = section.querySelector('h1');
      if (h1) {
        const date = h1.previousSibling;
        if (date) {
          date.classList.add('date');
        }
      }
      break;
    }
  }
  // annotate links
  const excludeSections = ['hero-container', 'aside-container'];
  articleSections.forEach((section) => {
    const sectionClassList = Array.from(section.classList);
    if (sectionClassList.some((c) => excludeSections.includes(c))) {
      return;
    }
    section.querySelectorAll('a').forEach((link) => {
      annotateElWithAnalyticsTracking(
        link,
        link.innerText,
        ANALYTICS_MODULE_CONTENT,
        ANALYTICS_TEMPLATE_ZONE_BODY,
        ANALYTICS_LINK_TYPE_CONTENT_MODULE,
      );
    });
  });
}

/**
 * Builds aside block and attaches it to main in a new section.
 * @param {Element} main The container element
 */
function buildAsideBlock(main) {
  const template = getMetadata('template');
  if (template === 'Article') {
    const section = document.createElement('div');
    section.append(buildBlock('aside', { elems: [] }));
    main.append(section);
  }
}

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const template = getMetadata('template');
  if (template === 'home' || window.location.pathname === '/') {
    return;
  }
  const section = document.createElement('div');
  section.append(buildBlock('hero', { elems: [] }));
  main.prepend(section);
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildAsideBlock(main);
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    // article processing
    annotateArticleSections();
    document.body.classList.add('appear');
    await waitForLCP(LCP_BLOCKS);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

async function loadJQueryDateRangePicker() {
  const filterInput = document.querySelector('#newslist-filter-input');
  if (!filterInput) {
    return;
  }
  // await import('./moment.min.js');
  await loadScript('/scripts/moment.min.js');
  await loadScript('/scripts/jquery-3.5.1.min.js');
  await loadScript('/scripts/jquery.daterangepicker-20190409.js');
  await loadCSS('/styles/daterangepicker.css');

  const filterSubmit = filterInput.closest('form').querySelector('input[type="submit"]');
  const url = new URL(window.location);
  const usp = new URLSearchParams(url.search);
  if (filterInput) {
    filterInput.removeAttribute('disabled');
    filterSubmit.removeAttribute('disabled');
    // eslint-disable-next-line no-undef
    const $filter = $('#newslist-filter-input');
    $filter.dateRangePicker(
      {
        singleMonth: true,
        showShortcuts: false,
        showTopbar: false,
        format: 'MM/DD/YY',
        separator: ' - ',
        monthSelect: true,
        yearSelect: true,
        extraClass: 'landing-picker',
      // eslint-disable-next-line prefer-arrow-callback
      },
    )
      .bind('datepicker-change', (evt, obj) => {
        const fullDtFrm = `${(obj.date1.getMonth() + 1)}/${obj.date1.getDate()}/${obj.date1.getFullYear()}`;
        const fullDtTo = `${(obj.date2.getMonth() + 1)}/${obj.date2.getDate()}/${obj.date2.getFullYear()}`;
        usp.set('from_date', fullDtFrm);
        usp.set('to_date', fullDtTo);
        window.location.search = decodeURIComponent(usp);
      })
      .bind('datepicker-open', () => {
        // eslint-disable-next-line no-undef
        if (!$('#clear-date-range').length) {
          // eslint-disable-next-line no-undef
          $('.date-picker-wrapper .month-wrapper').append(
            '<button id="clear-date-range" class="clearDateRange" name="clearDateRange" data-analytics-content-type="search intent" data-analytics-link-type="search intent" data-analytics-template-zone="body" data-analytics-module-name="nws-search-date-filter" data-analytics-link-name="clear" >Clear</button>',
          );
          // eslint-disable-next-line no-undef
          $('.clearDateRange').on('click', () => {
            // eslint-disable-next-line no-undef
            $('#newslist-filter-input').data('dateRangePicker').clear();
            const urlNoParamStr = window.location.toString().replace(window.location.search, '');
            window.location = urlNoParamStr;
          });
        }
        // eslint-disable-next-line no-undef
        const testL = $('#newslist-filter-input').offset().left;
        // eslint-disable-next-line no-undef
        $('.date-picker-wrapper').css('left', testL);
      });
  }
  const datePicker = document.querySelector('.date-picker-wrapper');
  datePicker.classList.add('date-picker-wrapper-custom');
  const paramDateFrom = usp.get('from_date');
  const paramDateTo = usp.get('to_date');
  if (paramDateFrom && paramDateTo) {
    // eslint-disable-next-line no-undef
    $('#newslist-filter-input').data('dateRangePicker')
      // eslint-disable-next-line no-undef
      .setStart(moment(paramDateFrom.toString()).format('MM/DD/YY'))
      // eslint-disable-next-line no-undef
      .setEnd(moment(paramDateTo.toString()).format('MM/DD/YY'));
  }

  function displayDatePicker(e) {
    e.stopPropagation();
    e.preventDefault();
    const stateOC = document.querySelector('.date-picker-wrapper').style.display === 'none';
    if (stateOC) {
      // eslint-disable-next-line no-undef
      $('#newslist-filter-input').data('dateRangePicker').open();
    } else {
      // eslint-disable-next-line no-undef
      $('#newslist-filter-input').data('dateRangePicker').close();
    }
  }

  const filterButton = document.querySelector('#filter-form > input[type=submit]');
  if (filterButton) {
    filterButton.addEventListener('click', displayDatePicker);
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadBlocks(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  loadJQueryDateRangePicker();

  sampleRUM('lazy');
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  sampleRUM.observe(main.querySelectorAll('picture > img'));
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // article processing
  window.setTimeout(() => addPrevNextLinksToArticles(), 2000);
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
