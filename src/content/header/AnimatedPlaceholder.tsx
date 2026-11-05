import { useEffect, useRef, useState } from 'react';

type Layer = { id: number; text: string; entering: boolean; exiting: boolean };

/** Exit transition length in `.sep-search-placeholder-text.is-exiting`. */
const EXIT_MS = 250;

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

  // One timer per exiting layer: a shared timer would restart on every text
  // change, so fast changes would pile up layers that never leave.
  const exitTimers = useRef(new Map<number, number>());
  useEffect(() => {
    for (const layer of layers) {
      if (layer.exiting && !exitTimers.current.has(layer.id)) {
        exitTimers.current.set(
          layer.id,
          window.setTimeout(() => {
            exitTimers.current.delete(layer.id);
            setLayers((current) => current.filter(({ id }) => id !== layer.id));
          }, EXIT_MS),
        );
      }
    }
  }, [layers]);

  useEffect(() => {
    const timers = exitTimers.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
    };
  }, []);

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
