# Changelog

All notable changes to `@zerosnow/pi-zero` are documented in this file.

## [0.2.0] - 2026-02

### Fixed
- **Crash on pi 0.84+ startup.** The tool-mouse interaction feature patched
  `TuiMainScreen.doRender`, which recursed infinitely under pi's proxy-based
  TUI reference (`createInteractiveTuiReference`), throwing
  `RangeError: Maximum call stack size exceeded` and preventing pi from opening.

### Removed
- **Tool-mouse interaction** (fixed-editor-only hover/click/scroll affordances).
  pi-zero does not include the fixed editor, so this feature was non-functional.
  Its removal also eliminates the startup crash above.

### Changed
- Syntax highlighting for write diffs now uses `@shikijs/cli`, shipped as an
  **optional dependency**. Highlighting falls back to plain rendering if the
  package cannot be installed.
- Cleaned up pre-existing type errors and dead code across `powerline`,
  `context`, and `ccstyle` (unused imports, stale return types, dead fields).

## [0.1.0] - 2026-01

- Initial release.
