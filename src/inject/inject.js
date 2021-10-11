function appendCSS(url) {
  const head = document.head;
  const link = document.createElement('link');
  link.type = 'text/css';
  link.rel = 'stylesheet';
  link.href = url;
  head.appendChild(link);
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
      }
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', setTheme);
      break;
    case 'dark':
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .removeEventListener('change', setTheme);
      setDarkMode(true);
      break;
    case 'light':
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .removeEventListener('change', setTheme);
      setDarkMode(false);
      break;
  }
}

function updateThemeSelector() {
  const theme = localStorage.getItem('theme');
  switch (theme) {
    case 'auto':
      $('#theme-selector option[value="auto"]').attr('selected', 'selected');
      break;
    case 'dark':
      $('#theme-selector option[value="dark"]').attr('selected', 'selected');
      break;
    case 'light':
      $('#theme-selector option[value="light"]').attr('selected', 'selected');
      break;
  }
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

  selectContainer.append(themeSelector);
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
  });

  updateTheme();
  updateThemeSelector();

  $('input[type=search]').attr('placeholder', 'Type / to search SEP');
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
