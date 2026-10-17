// Messages between the VS Code extension (host) and the 3D preview webview.

export type HostMessage =
  | { type: 'update'; name: string; source: string }       // .arch3d text (other formats converted by the host)
  | { type: 'select'; id: string | null }
  | { type: 'capture'; requestId: number };

export type PreviewMessage =
  | { type: 'ready' }
  | { type: 'pick'; id: string | null }
  | { type: 'captured'; requestId: number; dataUrl: string }
  | { type: 'rendered'; revision: number; errors: number };
