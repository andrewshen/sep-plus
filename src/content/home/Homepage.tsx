import { useEffect, useMemo, useRef, useState } from 'react';
import { formatEntryTitle } from '../../lib/formatEntryTitle';
import {
  formatRecentDate,
  loadRecentEntries,
  type RecentEntry,
} from '../../lib/recentEntries';
import { Search } from '../header/SearchPopover';
import { SiteFooter } from '../footer/SiteFooter';
import { IconArrowRight, SepLogo } from '../icons';

type HomepageProps = {
  searchOpen: boolean;
  onSearchOpen: () => void;
  onSearchClose: () => void;
};

const MISSION_SUBJECT = 'The Stanford Encyclopedia of Philosophy';
const MISSION_REST =
  'organizes scholars from around the world in philosophy and related disciplines to create and maintain an up-to-date reference work.';

/** Placeholder cards keep the row's height while the first fetch runs. */
const PLACEHOLDER_COUNT = 5;

function RecentCard({ entry }: { entry: RecentEntry }) {
  const [firstAuthor, ...otherAuthors] = entry.authors;
  return (
    <a className="sep-home-card" href={entry.href}>
      <span className="sep-home-card-title">
        {formatEntryTitle(entry.title, entry.href)}
      </span>
      <span className="sep-home-card-meta">
        {firstAuthor ? (
          <span className="sep-home-card-authors">
            <span className="sep-home-card-author">{firstAuthor}</span>
            {otherAuthors.length ? (
              <span className="sep-home-card-more">+{otherAuthors.length}</span>
            ) : null}
          </span>
        ) : null}
        <span className="sep-home-card-date">{formatRecentDate(entry.date)}</span>
      </span>
    </a>
  );
}

/** Recently updated entries (cached, refreshed in the background). `null`
 *  until the first list arrives; `[]` if it couldn't be loaded. */
function useRecentEntries(): RecentEntry[] | null {
  const [entries, setEntries] = useState<RecentEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadRecentEntries((next) => {
      if (!cancelled) {
        setEntries(next);
      }
    }).catch(() => {
      if (!cancelled) {
        setEntries((current) => current ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return entries;
}

function RecentlyUpdated({ entries }: { entries: RecentEntry[] | null }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ start: false, end: false });

  function updateFades(): void {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const max = track.scrollWidth - track.clientWidth;
    setFade({
      start: max > 1 && track.scrollLeft > 1,
      end: max > 1 && track.scrollLeft < max - 1,
    });
  }

  useEffect(() => {
    updateFades();
    window.addEventListener('resize', updateFades);
    return () => window.removeEventListener('resize', updateFades);
  }, [entries]);

  if (entries && entries.length === 0) {
    return null;
  }

  return (
    <section className="sep-site-section sep-home-recent" aria-label="Recently updated">
      <div className="sep-home-recent-header">
        <h2 className="sep-home-label">Recently updated</h2>
        <a className="sep-home-label sep-fade-link sep-home-see-all" href="/new.html">
          See all
          <IconArrowRight />
        </a>
      </div>
      <div
        ref={trackRef}
        className={[
          'sep-home-carousel',
          fade.start ? 'has-fade-start' : '',
          fade.end ? 'has-fade-end' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onScroll={updateFades}
      >
        {entries
          ? entries.map((entry) => <RecentCard key={entry.href} entry={entry} />)
          : Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
              <span key={index} className="sep-home-card is-placeholder" aria-hidden="true" />
            ))}
      </div>
    </section>
  );
}

export function Homepage({
  searchOpen,
  onSearchOpen,
  onSearchClose,
}: HomepageProps) {
  const recentEntries = useRecentEntries();
  // Empty-search suggestions: the same list as the carousel.
  const suggestions = useMemo(
    () => recentEntries?.map(({ title, href }) => ({ title, href })),
    [recentEntries],
  );

  return (
    <main className="sep-home">
      <section className="sep-home-hero">
        <span className="sep-home-logo">
          <SepLogo label="Stanford Encyclopedia of Philosophy" />
        </span>
        <p className="sep-home-mission">
          <span className="sep-home-mission-subject">{MISSION_SUBJECT}</span>{' '}
          {MISSION_REST}
        </p>
        <Search
          variant="hero"
          suggestions={suggestions}
          suggestionsLabel="Recently updated"
          open={searchOpen}
          onOpen={onSearchOpen}
          onClose={onSearchClose}
        />
      </section>

      <div className="sep-home-sections">
        <RecentlyUpdated entries={recentEntries} />

        <SiteFooter />
      </div>
    </main>
  );
}
