// Keyboard shortcuts that only act when you are not typing (editor, inputs).

/** Is the key event aimed at something you type in? */
export const isTyping = (e: KeyboardEvent): boolean =>
  !!(e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"], .cm-editor');

/** The next detail factor for a key: + / = more, - less, 0 back to normal; null for other keys. */
export function nextDetail(key: string, detail: number): number | null {
  if (key === '+' || key === '=') return detail * 1.5;
  if (key === '-' || key === '_') return detail / 1.5;
  if (key === '0') return 1;
  return null;
}

/** Keys + - 0 change how much semantic zoom shows at the same distance. */
export function setupDetailKeys(view: { setDetail(d: number): number; detail(): number }): void {
  document.addEventListener('keydown', (e) => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const next = nextDetail(e.key, view.detail());
    if (next !== null) view.setDetail(next);
  });
}
