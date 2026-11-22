# OBSTcut

OBSTcut is a browser video editor with five tools: a timeline, word-by-word captions, noise removal, auto-ducking, and export.

The editor is built to be served at `/editor/` (for example `https://offbrandstreamertools.stream/editor/`). A root `/` build is also supported.

## Run

```bash
pnpm install
pnpm dev
```

## Production builds

```bash
# Site root
pnpm --filter @obstcut/editor build

# Subpath /editor/
OPENREEL_BASE_PATH=/editor/ pnpm --filter @obstcut/editor build

# Desktop relative assets
OPENREEL_DESKTOP=1 pnpm --filter @obstcut/editor build
```

`VITE_BASE_PATH` is accepted as an alias of `OPENREEL_BASE_PATH`. `OPENREEL_DESKTOP=1` forces the relative `./` base.

Word-by-word captions load the speech model from the same origin (`models/onnx-community/whisper-tiny/`) so the page can be served with `Cross-Origin-Embedder-Policy: require-corp`. Fetch it before building with `node apps/obstcut/scripts/fetch-whisper.mjs`.

## Linux AppImage

From a clean tree, with no auto-publish:

```bash
pnpm --filter @obstcut/desktop dist:linux
```

That runs `electron-builder --linux AppImage --x64 --publish never` and writes `apps/desktop/release/OBSTcut-<version>-x64.AppImage`. The package does not embed an update feed.

## License

MIT. The copyright and permission notice are in [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES). Both files are included in the web build and the AppImage.
