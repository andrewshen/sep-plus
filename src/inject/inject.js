function appendCSS(url) {
  var head = document.head;
  var link = document.createElement('link');
  link.type = 'text/css';
  link.rel = 'stylesheet';
  link.href = url;
  head.appendChild(link);
}

appendCSS(
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,700;1,400;1,700&display=swap'
);

appendCSS(
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;500&display=swap'
);
