// Show or hide the editor so the 3D view gets the whole window.
// Button "Editor", key E (when not typing), or ?editor=0 in the URL to start hidden.

/** Is the editor hidden at start? (`?editor=0` or `?editor=off`) */
export const startsHidden = (search: string): boolean => ['0', 'off', 'false'].includes(new URLSearchParams(search).get('editor') ?? '');

export function setupEditorToggle(app: HTMLElement, button: HTMLButtonElement, search = location.search): (hidden?: boolean) => void {
  const set = (hidden = !app.classList.contains('editor-hidden')) => {
    app.classList.toggle('editor-hidden', hidden);
    button.setAttribute('aria-pressed', String(!hidden));
    button.textContent = hidden ? 'Show editor' : 'Hide editor';
    button.title = `${hidden ? 'Show' : 'Hide'} the editor (E)`;
  };
  set(startsHidden(search));
  button.addEventListener('click', () => set());
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    const typing = !!t?.closest('input, textarea, [contenteditable="true"], .cm-editor');
    if (e.key.toLowerCase() === 'e' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) set();
  });
  return set;
}
