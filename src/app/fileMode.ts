// The app's file mode (npm run dev -- model.arch3d): Save, an unsaved-changes marker, and staying in
// step with the file on disk without ever silently throwing away anyone's edits.
import type { Editor } from './editor';
import { onDiskChange, saveModelFile, type ModelFile } from './fileSync';
import { importText } from './importFile';

export interface FileModeUi {
  name: HTMLElement;
  save: HTMLButtonElement;
  note: HTMLElement;
  banner: HTMLElement;
}

export interface FileMode {
  save(force?: boolean): Promise<void>;
  /** Call after every editor change. */
  changed(): void;
  state(): { name: string; saveAs: string; dirty: boolean; banner: string | null };
}

const base = (p: string) => p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1);

export function startFileMode(file: ModelFile, editor: Editor, ui: FileModeUi): FileMode {
  const imported = file.saveAs !== file.path;
  let baseHash: string | null = file.exists ? file.hash : null;  // the disk version the clean text came from
  let clean = editor.text();
  let saving = false;
  const dirty = () => editor.text() !== clean;

  const refresh = () => {
    ui.name.textContent = `${dirty() ? '● ' : ''}${file.name}`;
    ui.name.title = imported ? `${file.path}\nSave writes ${file.saveAs}` : file.path;
    ui.save.disabled = saving || (!dirty() && file.exists && !imported);
    document.title = `${dirty() ? '● ' : ''}${file.name} - Archi3D`;
  };
  const note = (text: string) => { ui.note.textContent = text; };
  const hideBanner = () => { ui.banner.hidden = true; ui.banner.replaceChildren(); };
  const showBanner = (message: string, actions: [string, () => void][]) => {
    ui.banner.replaceChildren(message, ...actions.map(([label, run]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => { hideBanner(); run(); });
      return b;
    }));
    ui.banner.hidden = false;
  };

  /** Put a version from disk into the editor as the new clean state. */
  const loadDisk = async (text: string, hash: string) => {
    const source = imported ? (await importText(file.name, text)).source : text;
    baseHash = hash;
    clean = source;
    editor.setText(source);
    refresh();
  };

  const save = async (force = false) => {
    if (saving) return;
    saving = true;
    refresh();
    const text = editor.text();
    const r = await saveModelFile(text, force ? null : baseHash);
    saving = false;
    if (r.status === 'saved') {
      if (!imported) baseHash = r.hash;
      clean = text;
      file.exists = true;
      hideBanner();
      note(`Saved ${base(file.saveAs)}`);
    } else if (r.status === 'conflict') {
      showBanner('The file was changed on disk by another program since you opened it.', [
        ['Use the disk version', () => void loadDisk(r.text, r.hash).then(() => note('Loaded the disk version'))],
        ['Overwrite with mine', () => void save(true)],
      ]);
    } else {
      note(`Could not save: ${r.message}`);
    }
    refresh();
  };

  onDiskChange((text, hash) => {
    if (hash === baseHash) return;
    if (!dirty()) {
      void loadDisk(text, hash).then(() => note('Reloaded, the file changed on disk'));
      return;
    }
    showBanner('The file changed on disk and you have unsaved edits.', [
      ['Use the disk version', () => void loadDisk(text, hash).then(() => note('Loaded the disk version'))],
      ['Keep mine', () => { baseHash = hash; note('Kept your version, Save overwrites the file'); refresh(); }],
    ]);
  });

  ui.save.hidden = false;
  ui.save.addEventListener('click', () => void save());
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); }
  });
  window.addEventListener('beforeunload', (e) => { if (dirty()) e.preventDefault(); });
  if (!file.exists) note('New file, Save creates it');
  else if (imported) note(`Imported, Save writes ${base(file.saveAs)}`);
  refresh();

  return {
    save,
    changed: refresh,
    state: () => ({ name: file.name, saveAs: file.saveAs, dirty: dirty(), banner: ui.banner.hidden ? null : ui.banner.textContent }),
  };
}
