import { useLayoutEffect, useRef } from 'react';

type FootnotePreviewBodyProps = {
  noteKey: string;
  render: () => DocumentFragment;
};

export function FootnotePreviewBody({ noteKey, render }: FootnotePreviewBodyProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef(render);
  renderRef.current = render;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    root.replaceChildren(renderRef.current());
  }, [noteKey]);

  return <div ref={rootRef} />;
}
