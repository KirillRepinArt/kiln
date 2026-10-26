# Third-party software and fonts in Kiln

What ships with Kiln that Kiln didn't write, and under which licence. Kiln itself is MIT (`LICENSE`).

## Code

**CodeMirror 6**, the prompt editor: `app/vendor/codemirror.js`, one file built with esbuild (minified) from:

| Package | Version | Licence |
|---|---|---|
| @codemirror/state | 6.4.1 | MIT |
| @codemirror/view | 6.26.3 | MIT |
| @codemirror/commands | 6.5.0 | MIT |
| @codemirror/language | 6.13.1 | MIT |
| @codemirror/streamparser | 6.0.0 | MIT |
| @lezer/common | 1.5.3 | MIT |
| @lezer/highlight | 1.2.5 | MIT |
| @lezer/lr | 1.4.11 | MIT |
| style-mod | 4.1.4 | MIT |
| w3c-keyname | 2.2.8 | MIT |

Copyright Marijn Haverbeke and others; the full licence texts are in `app/vendor/codemirror.LICENSES.txt`.

## Fonts

In `app/fonts/` (Latin, Latin Extended and Cyrillic subsets, as served by Google Fonts), all under the
**SIL Open Font License 1.1**. Each font's licence is in `app/fonts/licenses/`.

| Font | Used for |
|---|---|
| Geist | the default text font |
| Inter, Manrope, IBM Plex Sans | text fonts to choose from (Settings → Font) |
| IBM Plex Mono | the Matrix skin's text |
| Courier Prime | the Matrix skin's titles |

**Satoshi** (Indian Type Foundry, ITF Free Font License) is **not included**: its licence doesn't allow it in a public
repository. Each install can add its own copy (`app/fonts/README.md`); without it, Settings shows it as not
installed.

## Not shipped

Development tools (formatters, linters, type checkers, test tools) are installed only to work on Kiln, never to use
it. Their exact versions are pinned in `package.json` and `requirements-dev.txt`.
