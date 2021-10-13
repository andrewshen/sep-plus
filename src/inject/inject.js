function appendCSS(url) {
  const head = document.head;
  const link = document.createElement('link');
  link.type = 'text/css';
  link.rel = 'stylesheet';
  link.href = url;
  head.appendChild(link);
}

function identifyPrintBlock() {
  $('div')
    .filter(function () {
      return (
        $(this).css('display') === 'block' &&
        $(this).css('width') === '242px' &&
        $(this).css('height') === '463px' &&
        $(this).css('float') === 'left'
      );
    })
    .attr('id', 'print-block');
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

function setTheme(e) {
  if (e.matches) {
    setDarkMode(true);
  } else {
    setDarkMode(false);
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

$(function () {
  const nav = $('#article-nav').find('ul');
  if ($('#article-nav').find('li')[0]) {
    $('#article-nav').find('li')[0].remove();
    $("a:contains('Bibliography')")[0].remove();
    $("a:contains('Academic Tools')")[0].remove();
    $('#toc').find('li').prependTo(nav);
    $('#toc').remove();
  }

  nav
    .find('li')
    .filter(function () {
      return $(this)
        .text()
        .match(/^\d+\.\d+/);
    })
    .css('margin-left', '20px');

  nav
    .find('li')
    .filter(function () {
      return $(this)
        .text()
        .match(/^\d+\.\d+\.\d+/);
    })
    .css('margin-left', '40px');

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

  $('#search').append(selectContainer);
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
});

window.addEventListener('storage', function (e) {
  if (e.key === 'theme') {
    updateTheme();
    updateThemeSelector();
    updateThemeIcon();
  }
});

$(window).scroll(function () {
  identifyPrintBlock();
});

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

appendCSS(
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;500&display=swap'
);
