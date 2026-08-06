# pi-zero

A curated pi extension suite that combines the best of `pi-powerline-footer` and `pi-cc-extensions` into a single, lean package — without bash mode, queue, stash, shortcuts, welcome page, or other extras.

## Features

| Module | Feature | Entry |
|--------|---------|-------|
| **powerline** | Powerline-style status bar (git branch, token usage, model, context %) | automatic |
| **vibe** | Random themed working-message (file or generate mode), merged with token / elapsed-time stats | automatic |
| **context** | Context-window usage inspector with System Prompt / Tools / Skills preview | `/context` |
| **ccstyle** | Claude Code style tool rendering (collapse / compact / animation / rich diff) + compact thinking | `/ccstyle` |
| **shared** | Generic helpers (`getAgentPath`, `showTextPreview`) shared across modules | — |

## Install

`pi-zero` lives in Pi's auto-discovery directory, so no install command is needed:

```bash
# Global (default when PI_CODING_AGENT_DIR is unset)
~/.pi/agent/extensions/pi-zero
```

Then run `/reload` in the pi TUI.

> Requires Node.js >= 22.19.

## Commands

| Command | Description |
|---------|-------------|
| `/context` | Show context-window distribution; press Enter/click to preview parts |
| `/ccstyle [on\|off\|compact\|status\|panel]` | Switch or configure Claude Code style tool rendering |
| `/vibe [theme\|off\|mode\|model\|generate]` | Configure the working-message vibe |
| `/powerline [on\|off\|preset\|placement]` | Toggle the status bar on/off, or set its preset / placement |

## Configuration

Global config lives in `~/.pi/agent/settings.json`. `pi-zero` reads these keys:

- `workingVibe`, `workingVibeMode`, `workingVibeModel` — vibe theme, mode (`file`/`generate`), model
- `powerline` — status bar `preset`, `placement`, `disabledSegments`, `customItems`, etc.
- `workingVibeShimmer` — shimmer sweep animation (handled by a separate local extension)

## Runtime dependencies

`compact-thinking` needs two packages that live in pi's npm module dir. pi-zero resolves them via local symlinks in `node_modules/` (git-ignored). If they are missing, re-run:

```bash
cd ~/.pi/agent/extensions/pi-zero
mkdir -p node_modules
ln -sfn ~/.pi/agent/npm/node_modules/jiti node_modules/jiti
ln -sfn ~/.pi/agent/npm/node_modules/pi-compact-thinking node_modules/pi-compact-thinking
```

## Structure

```
pi-zero/
├── index.ts            entry (loaded by pi auto-discovery)
├── shared/             generic helpers shared across modules
├── powerline/          status bar
├── vibe/               random working-message
├── context/            /context inspector
└── ccstyle/            Claude Code style tool rendering (+ tool-diff/)
```

## Compatibility & Notes

- `ccstyle` patches pi's tool rendering (similar to fixed-editor); if you ever see layout issues, run `/ccstyle off` to fall back to native rendering.
- Fixed editor is intentionally not included.
- Multiple pi processes are isolated: state is process-local (global symbols), and session boundaries are cleaned on `session_start`.

## Acknowledgements

- Status bar, vibe: adapted from [`pi-powerline-footer`](https://github.com/nicobailon/pi-powerline-footer) (MIT)
- ccstyle, `/context`, token/time stats: adapted from [`pi-cc-extensions`](https://github.com/minuque/pi-cc-extensions) (Proprietary)
- Rich diff: adapted from [`pi-tool-display`](https://github.com/MasuRii/pi-tool-display) (MIT) — see `ccstyle/tool-diff/ATTRIBUTION.md`

## License

MIT (for the pi-zero-specific composition; see individual attributions above).
