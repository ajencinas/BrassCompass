# The Brass Compass: the script

The screenplay is **generated from the live `.adv` scripts**, never maintained by hand.

- **Read it:** [`docs/FULL_SCRIPT.md`](FULL_SCRIPT.md), with every line in context and its source
  as `file:line`. A Word version is exported beside it as
  [`docs/FULL_SCRIPT.docx`](FULL_SCRIPT.docx).
- **Edit it:** change the scripts under [`src/content/scripts/`](../src/content/scripts/) and run
  `npm run script:export` to regenerate both files.
- **Canon and voices:** [`docs/STORY.md`](STORY.md).
- **How the language works:** [`docs/SCRIPTING.md`](SCRIPTING.md).

The old screenplay and the old story are archived outside the build; nothing under
`src/content/old-scripts/` is loaded. If you are looking for the current acts, rooms, dialogue,
items, tips or endings, they are all in `src/content/scripts/` and in the generated
`FULL_SCRIPT.md`.
