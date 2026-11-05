/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnnotationListItem } from '../annotations/useAnnotations';
import { AnnotationsPopover } from './AnnotationsPopover';

function annotation(id: string, resolved: boolean, note: string): AnnotationListItem {
  return {
    id,
    selector: {
      quote: { type: 'TextQuoteSelector', exact: `Quote ${id}`, prefix: '', suffix: '' },
      position: { type: 'TextPositionSelector', start: 0, end: 7 },
    },
    note,
    createdAt: 1,
    updatedAt: 1,
    resolved,
  };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('AnnotationsPopover', () => {
  it('keeps annotations that can’t be located readable and focusable', () => {
    const onScrollTo = vi.fn(() => true);
    const onClose = vi.fn();
    const { getByText } = render(
      <AnnotationsPopover
        id="annotations"
        open
        annotations={[annotation('lost', false, 'My note'), annotation('found', true, '')]}
        loading={false}
        error={null}
        onScrollTo={onScrollTo}
        onClose={onClose}
      />,
    );
    const lost = getByText('Quote lost').closest('button')!;
    expect(lost.disabled).toBe(false);
    expect(lost.getAttribute('aria-disabled')).toBe('true');
    expect(lost.textContent).toContain('Not found in this revision. My note');
    lost.focus();
    expect(document.activeElement).toBe(lost);

    fireEvent.click(lost);
    expect(onScrollTo).not.toHaveBeenCalled();

    const found = getByText('Quote found').closest('button')!;
    expect(found.hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(found, { detail: 1 });
    expect(onScrollTo).toHaveBeenCalledWith('found', { focus: false });
    expect(onClose).toHaveBeenCalled();
  });
});
