// Tiny DOM helpers for the debug views.
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const k of kids) if (k != null) el.append(k);
  return el;
}

export const debugStyles = `
  .dbg { font: 12.5px/1.35 ui-monospace, Menlo, Consolas, monospace; color: #1f2933; background: #fff;
         position: absolute; inset: 0; overflow: hidden; display: flex; }
  .dbg h2 { font: 600 13px system-ui, sans-serif; margin: 0 0 8px; color: #52606d; text-transform: uppercase; letter-spacing: .04em; }
  .dbg .pane { padding: 16px 20px; overflow: hidden; }
  .dbg .src { border-right: 1px solid #e4e7eb; flex: 0 0 52%; }
  .dbg .row { display: flex; white-space: pre; min-height: 17px; }
  .dbg .ln { width: 3ch; text-align: right; color: #9aa5b1; margin-right: 12px; flex: none; }
  .dbg .err { text-decoration: underline wavy #d64545; text-decoration-skip-ink: none; text-underline-offset: 3px; }
  .dbg .warn { text-decoration: underline wavy #c99a2e; text-decoration-skip-ink: none; text-underline-offset: 3px; }
  .dbg .msg { color: #d64545; margin-left: 16px; font-family: system-ui, sans-serif; font-size: 12px; }
  .dbg .msg.w { color: #a27b1c; }
  .dbg .tree ul { list-style: none; margin: 0; padding-left: 18px; border-left: 1px dotted #cbd2d9; }
  .dbg .tree > ul { padding-left: 0; border: 0; }
  .dbg .k { color: #7b5cb8; } .dbg .n { color: #1f2933; font-weight: 600; } .dbg .p { color: #0f8b8d; }
  .dbg .o { color: #c4473a; } .dbg .lab { color: #7b8794; } .dbg .ar { color: #52606d; }
  .dbg table { border-collapse: collapse; width: 100%; font-size: 12px; }
  .dbg th, .dbg td { text-align: left; padding: 3px 8px; border-bottom: 1px solid #edf0f3; white-space: nowrap; }
  .dbg th { color: #52606d; font-weight: 600; font-family: system-ui, sans-serif; }
  .dbg .counts { display: flex; gap: 24px; margin-bottom: 12px; font-family: system-ui, sans-serif; }
  .dbg .counts b { font-size: 20px; display: block; }
`;

export function withStyles(root: HTMLElement): void {
  if (!document.getElementById('dbg-styles')) {
    document.head.append(h('style', { id: 'dbg-styles' }, debugStyles));
  }
  root.classList.add('dbg');
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
