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

$(function () {
  const nav = $('#article-nav').find('ul');
  $('#article-nav').find('li')[0].remove();
  $("a:contains('Bibliography')")[0].remove();
  $("a:contains('Academic Tools')")[0].remove();
  $('#toc').find('li').prependTo(nav);

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

  $('input[type=search]').attr('placeholder', 'Type / to search SEP');

  if (
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    swapLogo(true);
  }

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', function (e) {
      if (e.matches) {
        swapLogo(true);
      } else {
        swapLogo(false);
      }
    });
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
