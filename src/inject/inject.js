function appendCSS(url) {
  const head = document.head;
  const link = document.createElement('link');
  link.type = 'text/css';
  link.rel = 'stylesheet';
  link.href = url;
  head.appendChild(link);
}

function injectLocalInterFonts() {
  const style = document.createElement('style');
  style.setAttribute('data-sep-plus-fonts', 'inter');
  style.textContent =
    '@font-face{font-family:"Inter";font-style:normal;font-weight:400;font-display:swap;src:url("' +
    chrome.runtime.getURL('src/fonts/Inter-Regular.woff2') +
    '") format("woff2");}' +
    '@font-face{font-family:"Inter";font-style:normal;font-weight:500;font-display:swap;src:url("' +
    chrome.runtime.getURL('src/fonts/Inter-Medium.woff2') +
    '") format("woff2");}' +
    '@font-face{font-family:"Inter";font-style:normal;font-weight:700;font-display:swap;src:url("' +
    chrome.runtime.getURL('src/fonts/Inter-Bold.woff2') +
    '") format("woff2");}';
  document.documentElement.appendChild(style);
}

injectLocalInterFonts();

function getMaxIndex(arr, num) {
  let maxIndex = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < num) {
      maxIndex = i;
    }
  }
  return maxIndex;
}

function identifyPrintBlock() {
  $('div')
    .filter(function () {
      return (
        $(this).css('display') === 'block' &&
        $(this).css('width') === '242px' &&
        $(this).css('float') === 'left'
      );
    })
    .attr('id', 'print-block');
}

function parsePubDates(text) {
  const published = text.match(
    /First published\s+\w+\s+(\w+\s+\d{1,2},\s+\d{4})/i
  );
  const revised = text.match(
    /substantive revision\s+\w+\s+(\w+\s+\d{1,2},\s+\d{4})/i
  );
  return {
    published: published ? published[1] : null,
    revised: revised ? revised[1] : null,
  };
}

function collectEntryAuthors() {
  const paragraph = document.querySelector('#article-copyright p');
  if (!paragraph) {
    return [];
  }

  const authors = [];
  let afterBy = false;
  let textBuffer = '';

  function flushTextAuthor() {
    const name = textBuffer.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
    textBuffer = '';
    if (!name || name.toLowerCase() === 'by' || name.includes('@')) {
      return;
    }
    authors.push({ name: name, href: null });
  }

  Array.from(paragraph.childNodes).forEach(function (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent || '';
      if (!afterBy) {
        if (!/\bby\b/i.test(text)) {
          return;
        }
        afterBy = true;
        text = text.replace(/^[\s\S]*?\bby\b/i, '');
      }
      textBuffer += text;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (node.tagName === 'BR') {
      if (afterBy) {
        flushTextAuthor();
      }
      return;
    }

    if (node.tagName !== 'A') {
      return;
    }

    const href = node.getAttribute('href') || '';
    if (href.indexOf('info.html') !== -1) {
      return;
    }
    if (href.indexOf('mailto:') === 0) {
      return;
    }

    afterBy = true;
    flushTextAuthor();
    const name = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (name) {
      authors.push({ name: name, href: node.href });
    }
  });

  if (afterBy) {
    flushTextAuthor();
  }

  return authors;
}

function reformatPubinfo() {
  const pubinfo = document.querySelector('#pubinfo');
  if (!pubinfo || pubinfo.dataset.sepPlusPubinfo === '1') {
    return;
  }

  const dates = parsePubDates(pubinfo.textContent || '');
  const authors = collectEntryAuthors();
  if (!authors.length && !dates.published && !dates.revised) {
    return;
  }

  const fragment = document.createDocumentFragment();
  const em = document.createElement('em');
  let needsSeparator = false;

  function appendSeparator() {
    if (!needsSeparator) {
      needsSeparator = true;
      return;
    }
    em.appendChild(document.createTextNode(' · '));
  }

  authors.forEach(function (author) {
    appendSeparator();
    if (author.href) {
      const link = document.createElement('a');
      link.className = 'sep-pubinfo-author';
      link.href = author.href;
      link.target = 'other';
      link.rel = 'noopener noreferrer';
      link.textContent = author.name;
      em.appendChild(link);
    } else {
      em.appendChild(document.createTextNode(author.name));
    }
  });

  const displayDate = dates.revised || dates.published;
  if (displayDate) {
    appendSeparator();
    const dateEl = document.createElement('span');
    dateEl.className = 'sep-pubinfo-date';
    dateEl.textContent = displayDate;
    if (dates.revised && dates.published) {
      dateEl.title = 'First published ' + dates.published;
    }
    em.appendChild(dateEl);
  }

  fragment.appendChild(em);
  pubinfo.textContent = '';
  pubinfo.appendChild(fragment);
  pubinfo.dataset.sepPlusPubinfo = '1';
}

function swapLogo(dark) {
  if (dark) {
    $('#site-logo').find('img').attr('src', 'https://i.imgur.com/eRpN6wC.png');
  } else {
    $('#site-logo').find('img').attr('src', '../../symbols/sep-man-red.png');
  }
}

function setDarkMode(dark) {
  if (dark) {
    $(document.body).addClass('dark');
    swapLogo(true);
    // change site to dark
  } else {
    $(document.body).removeClass('dark');
    swapLogo(false);
    // change site to light
  }
}

function matchSystemTheme(e) {
  if (localStorage.getItem('theme') === 'auto') {
    setDarkMode(e.matches);
  }
}

function updateTheme() {
  const theme = localStorage.getItem('theme');
  switch (theme) {
    case null:
      localStorage.setItem('theme', 'light');
      break;
    case 'auto':
      if (
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      ) {
        setDarkMode(true);
      } else {
        setDarkMode(false);
      }
      break;
    case 'dark':
      setDarkMode(true);
      break;
    case 'light':
      setDarkMode(false);
      break;
  }
}

function updateThemeIcon() {
  const theme = localStorage.getItem('theme');
  switch (theme) {
    case 'auto':
      $('#theme-icon').attr('src', 'https://i.imgur.com/e1Zorrs.png');
      break;
    case 'dark':
      $('#theme-icon').attr('src', 'https://i.imgur.com/TyBZlqK.png');
      break;
    case 'light':
      $('#theme-icon').attr('src', 'https://i.imgur.com/UUO3OBn.png');
      break;
  }
}

function updateThemeSelector() {
  const theme = localStorage.getItem('theme');
  $('#theme-selector').val(theme);
}

function addFootnotes() {
  if ($('#article-content sup a')[0]) {
    const footnotesURL = $('#article-content sup a')
      .first()
      .prop('href')
      .split('#')[0];
    fetch(footnotesURL)
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const footnotes = doc.getElementById('aueditable');
        footnotes.setAttribute('id', 'footnotes');
        $('#bibliography').before(footnotes);

        $('#footnotes h2').html('Footnotes');
        $('#footnotes p a').each(function () {
          const oldURL = $(this).attr('href');
          $(this).attr('href', `#${oldURL.split('#')[1]}`);
        });

        addFootnoteHoverState();
      })
      .catch(function (err) {
        console.log('No footnotes found');
      });
  }
}

function addFootnoteHoverState() {
  if ($('#footnotes')[0]) {
    $('sup a').hover(
      function () {
        const footnote = $('#footnotes p').eq($('sup a').index(this)).clone();
        const footnoteContainer = $('<div>', { class: 'footnote-annotation' });
        footnoteContainer.append(footnote);
        $(this).parent().append(footnoteContainer);
      },
      function () {
        $(this)
          .parent()
          .find('.footnote-annotation')
          .last()
          .fadeOut(100, function () {
            $(this).remove();
          });
      }
    );
  }
}

function getTocLevel(text) {
  const match = text.trim().match(/^(\d+(?:\.\d+)*)/);
  if (!match) {
    return 1;
  }
  const parts = match[1].split('.');
  if (parts.length >= 3) {
    return 3;
  }
  if (parts.length === 2) {
    return 2;
  }
  return 1;
}

function collectTocItems() {
  const items = [];
  const seen = {};

  $('#article-nav a, #toc a').each(function () {
    const href = $(this).attr('href');
    const text = $(this).text().replace(/\s+/g, ' ').trim();

    if (!href || href.includes('://') || href === '#pagetopright') {
      return;
    }
    if (
      text === 'Bibliography' ||
      text === 'Academic Tools' ||
      text === 'Other Internet Resources' ||
      text === 'Related Entries'
    ) {
      return;
    }
    if (seen[href]) {
      return;
    }

    seen[href] = true;
    items.push({
      href: href,
      text: text,
      level: getTocLevel(text),
    });
  });

  return items;
}

function getHeadingOffset(href) {
  const id = href.substring(1);
  const target = document.querySelector(`[name="${id}"], [id="${id}"]`);
  if (!target) {
    return null;
  }
  return $(target).offset().top;
}

function smoothScrollToHref(href) {
  const id = href.substring(1);
  const target = document.querySelector(`[name="${id}"], [id="${id}"]`);
  if (!target) {
    return;
  }

  const top = $(target).offset().top;
  window.scrollTo({
    top: Math.max(top - 24, 0),
    behavior: 'smooth',
  });
}

function buildSepToc(items) {
  const toc = document.createElement('div');
  toc.className = 'sep-toc';
  toc.id = 'sep-toc';

  const rail = document.createElement('div');
  rail.className = 'sep-toc-rail';
  rail.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('div');
  panel.className = 'sep-toc-panel';
  panel.setAttribute('role', 'navigation');
  panel.setAttribute('aria-label', 'Table of contents');

  const fadeTop = document.createElement('div');
  fadeTop.className = 'sep-toc-fade sep-toc-fade--top';
  fadeTop.setAttribute('aria-hidden', 'true');

  const fadeBottom = document.createElement('div');
  fadeBottom.className = 'sep-toc-fade sep-toc-fade--bottom';
  fadeBottom.setAttribute('aria-hidden', 'true');

  items.forEach(function (item, index) {
    const bar = document.createElement('a');
    bar.className = 'sep-toc-bar sep-toc-bar--level-' + item.level;
    bar.href = item.href;
    bar.dataset.index = String(index);
    bar.title = item.text;
    rail.appendChild(bar);

    const link = document.createElement('a');
    link.className = 'sep-toc-link sep-toc-link--level-' + item.level;
    link.href = item.href;
    link.dataset.index = String(index);
    link.textContent = item.text;
    panel.appendChild(link);
  });

  toc.appendChild(rail);
  toc.appendChild(panel);
  toc.appendChild(fadeTop);
  toc.appendChild(fadeBottom);
  document.body.appendChild(toc);

  return toc;
}

function updateTocOverflowFades() {
  const toc = document.querySelector('#sep-toc');
  const panel = document.querySelector('.sep-toc-panel');
  if (!toc || !panel) {
    return;
  }

  const maxScroll = panel.scrollHeight - panel.clientHeight;
  const canScroll = maxScroll > 1;
  const atTop = panel.scrollTop <= 1;
  const atBottom = panel.scrollTop >= maxScroll - 1;

  toc.classList.toggle('sep-toc--fade-top', canScroll && !atTop);
  toc.classList.toggle('sep-toc--fade-bottom', canScroll && !atBottom);
}

function scrollTocToIndex(index) {
  const rail = document.querySelector('.sep-toc-rail');
  const panel = document.querySelector('.sep-toc-panel');
  const bar = document.querySelector(
    '.sep-toc-bar[data-index="' + index + '"]'
  );

  if (!rail || !bar) {
    return;
  }

  const rowTop = bar.offsetTop;
  const rowHeight = bar.offsetHeight;
  const viewHeight = rail.clientHeight;
  let nextScroll = rail.scrollTop;

  if (rowTop < rail.scrollTop) {
    nextScroll = rowTop;
  } else if (rowTop + rowHeight > rail.scrollTop + viewHeight) {
    nextScroll = rowTop + rowHeight - viewHeight;
  }

  rail.scrollTop = nextScroll;
  if (panel) {
    panel.scrollTop = nextScroll;
  }
  updateTocOverflowFades();
}

function setActiveTocIndex(index) {
  $('#sep-toc .sep-toc-bar, #sep-toc .sep-toc-link').removeClass('is-active');
  if (index < 0) {
    return;
  }
  $(
    '#sep-toc .sep-toc-bar[data-index="' +
      index +
      '"], #sep-toc .sep-toc-link[data-index="' +
      index +
      '"]'
  ).addClass('is-active');
  scrollTocToIndex(index);
}

function initSepToc(items) {
  if (!items.length) {
    return;
  }

  document.body.classList.add('sep-toc-enabled');
  $('#article-sidebar').hide();
  buildSepToc(items);

  const toc = document.querySelector('#sep-toc');
  const rail = document.querySelector('.sep-toc-rail');
  const panel = document.querySelector('.sep-toc-panel');

  if (panel && rail) {
    panel.addEventListener('scroll', function () {
      rail.scrollTop = panel.scrollTop;
      updateTocOverflowFades();
    });
  }

  if (toc) {
    toc.addEventListener('click', function (event) {
      const anchor = event.target.closest('a[href^="#"]');
      if (!anchor || !toc.contains(anchor)) {
        return;
      }
      event.preventDefault();
      smoothScrollToHref(anchor.getAttribute('href'));
      // Drop focus so :focus-within doesn't keep the panel open after click.
      if (typeof anchor.blur === 'function') {
        anchor.blur();
      }
    });
  }

  let tops = items.map(function (item) {
    return getHeadingOffset(item.href);
  });

  function refreshTops() {
    tops = items.map(function (item) {
      return getHeadingOffset(item.href);
    });
  }

  function updateActive() {
    identifyPrintBlock();
    const scroll = $(window).scrollTop() + 80;
    let index = -1;
    for (let i = 0; i < tops.length; i++) {
      if (typeof tops[i] === 'number' && tops[i] <= scroll) {
        index = i;
      }
    }
    if (index < 0 && tops.length) {
      index = 0;
    }
    setActiveTocIndex(index);
    updateTocOverflowFades();
  }

  $(window).on('scroll', updateActive);
  $(window).on('resize', function () {
    refreshTops();
    updateActive();
    updateTocOverflowFades();
  });
  updateActive();
  updateTocOverflowFades();
}

$(function () {
  const isArticle = $('#article-nav').find('li')[0];
  let tocItems = [];

  if (isArticle) {
    $('#article-nav').find('li')[0].remove();
    const bibliography = $("a:contains('Bibliography')")[0];
    if (bibliography) {
      bibliography.remove();
    }
    const academicTools = $("a:contains('Academic Tools')")[0];
    if (academicTools) {
      academicTools.remove();
    }
    $('#toc').find('li').prependTo($('#article-nav').find('ul'));
    tocItems = collectTocItems();
    $('#toc').remove();
    addFootnotes();
  }

  const selectContainer = document.createElement('div');
  selectContainer.className = 'select-container';

  const themeSelector = document.createElement('select');
  themeSelector.setAttribute('id', 'theme-selector');

  const auto = document.createElement('option');
  auto.setAttribute('value', 'auto');
  auto.innerHTML = 'System';

  const dark = document.createElement('option');
  dark.setAttribute('value', 'dark');
  dark.innerHTML = 'Dark';

  const light = document.createElement('option');
  light.setAttribute('value', 'light');
  light.innerHTML = 'Light';

  const themeIcon = document.createElement('img');
  themeIcon.setAttribute('id', 'theme-icon');
  themeIcon.setAttribute('src', 'https://i.imgur.com/UUO3OBn.png');
  themeIcon.setAttribute('alt', 'Theme Icon');
  themeIcon.setAttribute('width', 12);
  themeIcon.setAttribute('height', 12);

  const chevronIcon = document.createElement('img');
  chevronIcon.setAttribute('id', 'chevron-icon');
  chevronIcon.setAttribute('src', 'https://i.imgur.com/H0Ih6cL.png');
  chevronIcon.setAttribute('alt', 'Chevron');
  chevronIcon.setAttribute('width', 12);
  chevronIcon.setAttribute('height', 12);

  selectContainer.append(themeSelector);
  selectContainer.append(themeIcon);
  selectContainer.append(chevronIcon);

  if ((!isArticle && $('.searchpage #search')[0]) || $('#content #search')[0]) {
    const searchContainer = document.createElement('div');
    searchContainer.setAttribute('id', 'search');
    searchContainer.append(selectContainer);
    $('#header').append(searchContainer);
    $('.select-container').css('margin-top', '-15px');
  } else {
    $('#search').append(selectContainer);
  }

  $('#theme-selector').append(light);
  $('#theme-selector').append(dark);
  $('#theme-selector').append(auto);
  $('#theme-selector').change(function () {
    $('select option:selected').each(function () {
      switch ($(this).attr('value')) {
        case 'auto':
          localStorage.setItem('theme', 'auto');
          break;
        case 'dark':
          localStorage.setItem('theme', 'dark');
          break;
        case 'light':
          localStorage.setItem('theme', 'light');
          break;
      }
    });
    updateTheme();
    updateThemeIcon();
  });

  updateTheme();
  updateThemeSelector();
  updateThemeIcon();

  $('input[type=search]').attr('placeholder', 'Type / to search SEP');

  if (isArticle && !location.href.match(/notes.html/)) {
    reformatPubinfo();
    initSepToc(tocItems);
  }
});

window.addEventListener('storage', function (e) {
  if (e.key === 'theme') {
    updateTheme();
    updateThemeSelector();
    updateThemeIcon();
  }
});

window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', matchSystemTheme);

$(document).keyup(function (e) {
  switch (e.which) {
    case 191:
      $('input[type=search]')[0].focus();
      break;
    case 27:
      $('input[type=search]')[0].blur();
      break;
  }
});

appendCSS(
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,700;1,400;1,700&display=swap'
);
