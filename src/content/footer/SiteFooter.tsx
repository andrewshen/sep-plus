import { useLayoutEffect, useRef } from 'react';
import { IconArrowRight } from '../icons';

const LINK_COLUMNS: ReadonlyArray<{
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}> = [
  {
    title: 'Browse',
    links: [
      { label: 'Table of contents', href: '/contents.html' },
      { label: "What's new", href: '/new.html' },
      { label: 'Random entry', href: '/cgi-bin/encyclopedia/random' },
      { label: 'Chronological', href: '/published.html' },
      { label: 'Archives', href: '/archives/' },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'Editorial information', href: '/info.html' },
      { label: 'About the SEP', href: '/about.html' },
      { label: 'How to cite the SEP', href: '/cite.html' },
      { label: 'Special Characters', href: '/special-characters.html' },
      { label: 'Advanced Tools', href: '/tools/' },
      { label: 'Accessibility', href: '/accessibility.html' },
      { label: 'Contact', href: '/contact.html' },
    ],
  },
  {
    title: 'Support SEP',
    links: [
      { label: 'Support the SEP', href: '/support/' },
      { label: 'PDFs for SEP Friends', href: '/support/friends.html' },
      { label: 'Make a Donation', href: '/support/donate.html' },
      { label: 'SEPIA for Libraries', href: '/support/sepia.html' },
    ],
  },
  {
    title: 'Mirror sites',
    links: [
      { label: 'USA', href: 'https://plato.stanford.edu/' },
      { label: 'Australia', href: 'https://plato.sydney.edu.au/' },
      { label: 'Netherlands', href: 'https://seop.illc.uva.nl/' },
    ],
  },
];

/** SEP's own markup for the entry's author copyright, moved in as-is. */
function EntryCopyright({ line }: { line: HTMLElement }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) {
      return;
    }
    container.replaceChildren(...Array.from(line.cloneNode(true).childNodes));
    return () => container.replaceChildren();
  }, [line]);
  return (
    <div className="sep-site-section sep-site-footer-legal sep-site-footer-entry">
      <span ref={ref} />
      <a
        className="sep-home-label sep-link sep-home-see-all"
        href="https://plato.stanford.edu/fundraising/"
      >
        Support the SEP
        <IconArrowRight />
      </a>
    </div>
  );
}

/** Site links + copyright, shared by every page. Entries add their author copyright above. */
export function SiteFooter({ entryCopyright }: { entryCopyright?: HTMLElement | null }) {
  return (
    <footer className="sep-site-footer">
      {entryCopyright ? <EntryCopyright line={entryCopyright} /> : null}
      <nav className="sep-site-section sep-site-footer-columns" aria-label="Site">
        {LINK_COLUMNS.map((column) => (
          <div key={column.title} className="sep-site-footer-column">
            <h2 className="sep-site-footer-column-title">{column.title}</h2>
            {column.links.map((link) => (
              <a key={link.href} className="sep-link" href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="sep-site-section sep-site-footer-legal">
        <span>Copyright © {new Date().getFullYear()} The Metaphysics Research Lab</span>
        <span>ISSN 1095-5054</span>
      </div>
    </footer>
  );
}
