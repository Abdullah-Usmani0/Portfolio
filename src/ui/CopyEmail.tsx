import { useState } from 'react';
import { cn } from './cn.ts';

/**
 * The address as selectable text with a copy button: a mailto link is not reliable inside
 * every frame this page is shown in, and copying works everywhere.
 */
export function CopyEmail({ email, className }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (button: HTMLButtonElement) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // No clipboard access here: select the address so it can be copied by hand.
      const text = button.parentElement?.querySelector('[data-email]');
      if (text) window.getSelection()?.selectAllChildren(text);
    }
  };
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-5 gap-y-2', className)}>
      <a data-email href={`mailto:${email}`} className="link select-all">
        {email}
      </a>
      <button type="button" onClick={(e) => void copy(e.currentTarget)} className="pill" aria-live="polite">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}
