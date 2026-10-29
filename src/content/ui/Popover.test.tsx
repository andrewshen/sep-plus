/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { focusJumpTarget } from '../../host/scroll';
import { Popover } from './Popover';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

let setOpenFromTest: (open: boolean) => void = () => undefined;

function Harness() {
  const [open, setOpen] = useState(true);
  setOpenFromTest = setOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button">
        Trigger
      </button>
      <button type="button">Elsewhere</button>
      <Popover open={open} align="end" ariaLabel="Menu" returnFocusRef={triggerRef}>
        <select aria-label="Choice">
          <option>One</option>
        </select>
      </Popover>
    </>
  );
}

describe('Popover focus return', () => {
  it('returns focus to the trigger when it closes with focus inside', () => {
    const { getByLabelText, getByText } = render(<Harness />);
    getByLabelText('Choice').focus();
    act(() => setOpenFromTest(false));
    expect(document.activeElement).toBe(getByText('Trigger'));
  });

  it('leaves focus alone when it was already elsewhere', () => {
    const { getByText } = render(<Harness />);
    getByText('Elsewhere').focus();
    act(() => setOpenFromTest(false));
    expect(document.activeElement).toBe(getByText('Elsewhere'));
  });
});

describe('focusJumpTarget', () => {
  it('focuses a heading temporarily and cleans up on blur', () => {
    document.body.innerHTML = '<h2 id="s">Section</h2><button>Next</button>';
    const heading = document.getElementById('s')!;
    focusJumpTarget(heading);
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
    document.querySelector('button')!.focus();
    expect(heading.hasAttribute('tabindex')).toBe(false);
  });
});
