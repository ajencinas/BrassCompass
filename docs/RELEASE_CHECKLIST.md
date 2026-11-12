# Release checklist (owner actions)

These steps change history, hosting or what is tracked, so they are the owner's call. None of
them has been done. Everything the repo can do on its own (build, audits, CI, packaging) already
runs from `npm run test:fast`, `npm run build` and `npm run package:itch`.

## 0. Before anything else: back up

```bash
# A mirror clone is the only safe rollback for a history rewrite.
git clone --mirror . ../brass-compass-backup.git
# Untracked art and originals exist only on this disk: .asset-originals (~160 MB) and the
# gitignored public/assets/{scenes,characters,props,video}.
tar -czf ../brass-compass-art-backup.tgz .asset-originals public/assets
```

## 1. Ship the real build (every release)

```bash
npm ci
python3 tools/optimize_assets.py --webp-only   # only if PNG sources changed; WebP is what ships
npm run assets                                  # rewrite src/content/active-assets.json
npm run test:fast && npm run test:assets && npm run test:scale && npm run test:exit && npm run test:connect
npm run build && npm run test:size
npm run package:itch                            # dist-itch/the-brass-compass-v<version>-itch.zip
```

`npm run build` fails on a stale `active-assets.json` and on any missing active file once
`public/assets/scenes` and `characters` exist. Without them it builds a code-only bundle (CI does
this on purpose) and says so loudly.

## 2. Purge third-party and deleted art from history

Why: the local all-refs `.git` is about 450 MiB, but the public `main` clone is about 65 MiB. Its
history still contains the removed `travel-map/` personal email/map (P0 privacy) and two reference
stills from a published game (`reference/mi1_*`, P1 copyright), plus earlier reference captures.
Those objects are still retrievable from old commits even though they are deleted at HEAD and
gitignored now.

```bash
pip install git-filter-repo
git clone --mirror <origin> brass-purge.git && cd brass-purge.git     # work on a fresh mirror
git filter-repo --invert-paths \
  --path travel-map \
  --path reference/mi1_deconstruction_montage.png --path reference/mi1_ui_verbs.png \
  --path reference/screens --path reference/tests \
  --path public/assets/scenes --path public/assets/characters \
  --path public/assets/props --path public/assets/video
git push --force --mirror <origin>
```

Those are the only two `mi1_` paths in history (`git log --all --name-only | grep -i mi1_`); re-run that check first. After the push every
collaborator must re-clone (old clones still hold the objects); rotate any release tags that point
at rewritten commits. Run `git count-objects -vH` afterwards to confirm the size drop.

## 3. Give the art a proper home

The shelf (about 125 MiB; 33 MiB ships) is not in git, so a clean clone cannot run the game.
Pick one:

- **Private release artifact:** zip `public/assets/{scenes,characters,props}` (the `.webp` files
  are enough to run; keep PNG sources in the backup) and attach it to a private GitHub Release.
  The manual `browser` CI job does **not** download it (`.github/workflows/ci.yml` has no download
  step): with the folders missing it stops and prints what it needs. To run the playthrough in
  CI, either commit/LFS the art (below) or add a step before "Is the art folder present?" that
  fetches and unzips the release into `public/assets/` using a repository secret token.
- **Git LFS:** `git lfs install && git lfs track "public/assets/**/*.webp" "public/assets/**/*.png"`,
  remove the matching lines from `.gitignore`, commit `.gitattributes`. Mind LFS bandwidth quotas.

Either way keep `.asset-originals/` (untouched pre-shrink art) in your own backup, not in git.

## 4. Untrack legacy folders (owner decides; files stay on disk)

Not removed by the build work. If you decide they are not source of record:

```bash
git rm -r --cached reference cinematic src/content/old-scripts docs/archive docs/FULL_SCRIPT.docx
printf '%s\n' reference/ cinematic/ src/content/old-scripts/ docs/archive/ >> .gitignore
```

`docs/FULL_SCRIPT.docx` is generated from `docs/FULL_SCRIPT.md` by `tools/script_docx.py`. The
legacy `cinematic/` project is AI-generated source for films the game no longer ships; `LICENSE`
section 5 and the AI disclosure already say so.

## 5. Before uploading to itch.io

- Serve `dist/` from a subdirectory and confirm there are no 404s (`docs/STORE.md` section 8).
- Content-Security-Policy: `index.html` has none. A CSP (`default-src 'self'`, `img-src 'self'
  data: blob:`, `media-src 'self' blob:`, `style-src 'self' 'unsafe-inline'`) is worth adding but
  must be tested inside itch.io's iframe first, because the embed and any analytics change what
  it has to allow. Test on a draft page before enabling.
- CI actions (`actions/checkout`, `actions/setup-node`, `browser-actions/setup-chrome`) are pinned
  to tags. Pin them to full commit SHAs (look each up on GitHub; they were not verifiable offline).
