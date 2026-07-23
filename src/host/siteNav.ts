import type { SiteNavSection } from '../lib/types';

const FALLBACK_SITE_NAV: SiteNavSection[] = [
  {
    title: 'Browse',
    links: [
      { href: '/contents.html', text: 'Table of Contents' },
      { href: '/new.html', text: "What's New" },
      {
        href: 'https://plato.stanford.edu/cgi-bin/encyclopedia/random',
        text: 'Random Entry',
      },
      { href: '/published.html', text: 'Chronological' },
      { href: '/archives/', text: 'Archives' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/info.html', text: 'Editorial Information' },
      { href: '/about.html', text: 'About the SEP' },
      { href: '/board.html', text: 'Editorial Board' },
      { href: '/cite.html', text: 'How to Cite the SEP' },
      { href: '/special-characters.html', text: 'Special Characters' },
      { href: '/tools/', text: 'Advanced Tools' },
      { href: '/accessibility.html', text: 'Accessibility' },
      { href: '/contact.html', text: 'Contact' },
    ],
  },
  {
    title: 'Support SEP',
    links: [
      { href: '/support/', text: 'Support the SEP' },
      { href: '/support/friends.html', text: 'PDFs for SEP Friends' },
      { href: '/support/donate.html', text: 'Make a Donation' },
      { href: '/support/sepia.html', text: 'SEPIA for Libraries' },
    ],
  },
];

function normalizeLabel(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Pull Browse / About / Support SEP from the page footer when present. */
export function collectSiteNavSections(): SiteNavSection[] {
  const blocks = document.querySelectorAll('#footer-menu .menu-block');
  if (!blocks.length) {
    return FALLBACK_SITE_NAV;
  }

  const sections: SiteNavSection[] = [];
  for (const block of blocks) {
    const title = normalizeLabel(block.querySelector('h4')?.textContent || '');
    const links = Array.from(
      block.querySelectorAll<HTMLAnchorElement>('ul a[href]')
    )
      .map((anchor) => ({
        href: anchor.href,
        text: normalizeLabel(anchor.textContent || ''),
      }))
      .filter((link) => link.href && link.text);

    if (title && links.length) {
      sections.push({ title, links });
    }
  }

  return sections.length ? sections : FALLBACK_SITE_NAV;
}
