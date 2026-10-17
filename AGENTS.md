# Rules for everyone working on Archi3D (people and AI agents)

First read [CLAUDE.md](CLAUDE.md) for the project rules (architecture, tests, when a step is done).
The git rules below are for every agent and every person who commits to this repo.

## Git

- Remote: `git@github.com:Heydarchi/Archi3D.git`
- No co-authors and no tool credits. Don't add `Co-Authored-By:` lines, "Generated with ..." lines
  or any other AI or tool attribution to commits, pull requests, tags or release notes.
- Commit messages are short and simple. One line that says what changed, max about 60 characters,
  for example `Add parser for links`, `Fix label overlap on lids`, `Document the render command`.
  Only add a body if the reason is not clear. No prefixes, no emoji.
- Small commits. One change per commit, and commit after every step. Code and its tests go in the
  same commit. Several small commits are better than one big one.
- Use branches, never commit to `main` directly. Make the branch from `main`:
  `step/<n>-<topic>` for plan steps, `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`.
- `main` is protected and I merge. Push only your branch (never `main`) and open a pull request
  when it is ready: `npm test` and `npm run lint` pass (and `npm run test:visual` if the view
  changed). I review it and merge it.
- Every pull request runs CI (`.github/workflows/ci.yml`): `check` (lint and unit tests on Linux)
  and `visual` (screenshot tests on macOS). `main` takes changes only through a pull request with
  both green. Nobody can push to it directly, force push it or delete it, me included.
  If `visual` fails, the diffs are in the `visual-diffs` artifact of the run.
- Don't commit generated or local files: `node_modules/`, `dist/`, `offline/`, `artifacts/`,
  `test-results/`, `vscode/dist/`, `*.vsix`, `.DS_Store` (they are in `.gitignore`).
- Never rewrite or force push `main`. Don't force push a branch that someone else may have pulled.
