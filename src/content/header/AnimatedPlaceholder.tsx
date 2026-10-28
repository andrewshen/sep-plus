import { useEffect, useRef, useState } from 'react';

type Layer = { id: number; text: string; entering: boolean; exiting: boolean };

/** Exit transition length in `.sep-search-placeholder-text.is-exiting`. */
const EXIT_MS = 150;

/**
 * Search placeholder drawn over the input so a change can animate: the old
 * text rises out while the new text rises in from below. Text present on
 * mount appears without animating.
 */
export function AnimatedPlaceholder({
  text,
  hidden,
}: {
  text: string;
  /** Hide instantly (like a native placeholder) while the input has a value. */
  hidden: boolean;
}) {
  const nextId = useRef(1);
  const [layers, setLayers] = useState<Layer[]>(() => [
    { id: 0, text, entering: false, exiting: false },
  ]);

  useEffect(() => {
    setLayers((current) => {
      if (current.some((layer) => !layer.exiting && layer.text === text)) {
        return current;
      }
      return [
        ...current.map((layer) => ({ ...layer, exiting: true })),
        { id: nextId.current++, text, entering: true, exiting: false },
      ];
    });
  }, [text]);

  useEffect(() => {
    if (!layers.some((layer) => layer.exiting)) {
      return;
    }
    const timer = window.setTimeout(() => {
      setLayers((current) => current.filter((layer) => !layer.exiting));
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [layers]);

  return (
    <span
      className={['sep-search-placeholder', hidden ? 'is-hidden' : '']
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {layers.map((layer) => (
        <span
          key={layer.id}
          className={[
            'sep-search-placeholder-text',
            layer.entering ? 'is-entering' : '',
            layer.exiting ? 'is-exiting' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {layer.text}
        </span>
      ))}
    </span>
  );
}
