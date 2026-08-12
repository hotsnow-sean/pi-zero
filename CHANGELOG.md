# Changelog

All notable changes to `@zerosnow/pi-zero` are documented in this file.

## [0.2.2] - 2026-08

### Fixed
- **Mermaid / custom code blocks rendered as raw source when thinking is hidden.**
  The compact assistant renderer (compact-style) and the compact-thinking fork
  re-created Pi's `Markdown` component without the `transform` option that applies
  Pi's markdown transformers (e.g. the built-in mermaid renderer). With
  `hideThinkingBlock` enabled, ` ```mermaid ` blocks showed as raw source instead
  of terminal box-drawing art. Both renderers now apply the transformer chain
  (mirroring Pi's internal `createMarkdownTransform`), restoring mermaid and any
  custom transformer rendering.

## [0.2.1] - 2026-08

### Fixed
- **Misleading "press ctrl-o to expand" hint on large diffs.** The diff
  collapse hint was emitted unconditionally whenever a diff had hidden content,
  even in the expanded state. Since pi's `app.tools.expand` binding (`ctrl+o`)
  is a binary toggle, pressing it again in the expanded view collapsed the diff
  instead of revealing more, trapping the user on the `expandedPreviewMaxLines`
  cap for huge single edits/writes.

  The expanded-state hint no longer advertises `ctrl+o`; it now reads
  `raise "Expanded max lines" in /ccstyle`, guiding the user to the real knob.
  Collapsed-state behavior is unchanged.

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
