# Rules for every agent working on Archi3D

Project rules (architecture, tests, definition of done): read [CLAUDE.md](CLAUDE.md) first.
These git rules apply to every agent and every person committing to this repository.

## Git

- **Remote:** `git@github.com:Heydarchi/Archi3D.git`
- **No co-authors or tool credits.** Never add `Co-Authored-By:` lines, "Generated with …" lines or any
  other AI/tool attribution to commits, pull requests, tags or release notes.
- **Short, simple commit messages.** One plain line that says what changed, in the imperative,
  at most ~60 characters: `Add parser for links`, `Fix label overlap on lids`, `Document the render command`.
  Add a body only when the *why* is not obvious. No prefixes or emoji needed.
- **Small commits.** One logical change per commit, and commit at every step: the code and its tests
  go together. Prefer several small commits over one large one.
- **Branches.** Never commit straight to `main`. Branch from `main`:
  `step/<n>-<topic>` for plan steps, `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`.
- **`main` is protected; the owner merges.** Push your branch only (never `main`), and open a pull
  request when the work is ready: `npm test` and `npm run lint` pass (and `npm run test:visual` when
  the view changed). The repository owner reviews and merges it.
- **Don't commit generated or local files:** `node_modules/`, `dist/`, `offline/`, `artifacts/`,
  `test-results/`, `vscode/dist/`, `*.vsix`, `.DS_Store` (all in `.gitignore`).
- Never rewrite or force-push `main`, and don't force-push a branch someone else may have pulled.
