# Third-party notices

ReelMimic's own code (`app/`, `.claude/skills/video-clone/`, `.claude/skills/blender-product-film/`, and the `pixel-art`, `paper-cutout`, `whiteboard`, `anime-cel` engines apart from their `render.mjs`) is MIT-licensed (see `LICENSE`).
The following bundled skills and assets keep their original licenses.

| Path | Upstream | License | Copyright |
|---|---|---|---|
| `.claude/skills/hyperframes*`, `embedded-captions`, `faceless-explainer`, `figma`, `general-video`, `media-use`, `motion-graphics`, `music-to-video`, `pr-to-video`, `product-launch-video`, `remotion-to-hyperframes`, `slideshow` | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) `skills/` | Apache-2.0 | © 2026 HeyGen, Inc. |
| `.claude/skills/captions-overlay`, `cut-the-curve`, `motion-doctrine`, `oversized-cursor`, `seam-craft` | heygen-com/hyperframes `.claude/skills/` | Apache-2.0 | © 2026 HeyGen, Inc. |
| `.claude/skills/talking-head-recut` | heygen-com/hyperframes, adapted from notedit/vtake-skills | Apache-2.0 + MIT (see its `NOTICE.md`) | © 2026 HeyGen, Inc.; © 2026 leeoxiang |
| `.claude/skills/frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) | Apache-2.0 (`LICENSE.txt` included) | © Anthropic |
| `.claude/skills/ffmpeg` | [digitalsamba/claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) | MIT | © 2024 Digital Samba |
| `.claude/skills/painted-animation` | [tuzhechen2005/painted-animation](https://github.com/tuzhechen2005/painted-animation); `template/` from [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) | MIT (both `LICENSE` files included) | © 2026 tuzhechen2005; © 2026 John Heibel |
| `.claude/skills/crayon-storybook` (runtime derived from painted-animation); `render.mjs` in `video-clone/assets/engine-kit/` and in the `pixel-art`, `paper-cutout`, `whiteboard`, `anime-cel` templates | painted-animation / ClaudeAnimationBase (above) | MIT (`LICENSE` / `LICENSE-render.mjs.txt` included next to them) | © 2026 tuzhechen2005; © 2026 John Heibel |
| Fonts in `embedded-captions`, `talking-head-recut`, `hyperframes-creative` | Google Fonts / Excalidraw (Virgil) | SIL Open Font License 1.1 | respective authors |

Apache-2.0 full text: [LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt) (also <https://www.apache.org/licenses/LICENSE-2.0>) · MIT: see each upstream repository.

## Not bundled (install yourself)

- **Remotion skills** (`remotion-*` except `remotion-to-hyperframes`): upstream [remotion-dev/skills](https://github.com/remotion-dev/skills) has no license file, and Remotion itself uses its own source-available license. They are not redistributed here; install them from upstream if you want the `remotion-react` style (their sources are pinned in `skills-lock.json`).
- **Pixabay sound effects** in `media-use/audio/assets/sfx/`: the Pixabay Content License does not allow redistributing the files as standalone files, so they are excluded. Download them yourself from the links in `media-use/audio/assets/sfx/CREDITS.md`, or let the director fetch license-safe sound effects with `fetch_assets.py`.
- `_vendor/` clones of upstream repositories are for local reference only and are not published.
