# MCSA-offical-website
蒙纳士中国学生会官网

## Department pages

The six `department-*.html` routes render department records from the existing published snapshot. The department list and navigation open internal pages; the homepage heading is not a link. Recruitment buttons accept HTTPS WeChat article URLs only.

The Organisation page has a single-column article with original user-supplied photos, leadership messages, core teams, recruitment requirements and past application instructions. Photos are displayed at bounded widths without cropping, recompression or click-to-open links. Recruitment closed on 15 March 2026 and is labelled as a past round. Animations respect system and site motion preferences.

## Deployment requirements — not ready for live release

The frontend still requires the existing backend content service. `assets/config.js` has no production API address configured. `content/departments/organisation.json` is a content handoff record, **not automatically loaded by the website**. Before release:

1. Confirm the deployment source for www.monashcsa.org and configure the production API through the team's existing deployment process.
2. Add backend editing, validation, preview and publishing support for the new department fields below. Merge the Organisation record by ID into the published snapshot.
3. Complete Traditional Chinese translations and review draft English text. Other departments still need approved content and recruitment URLs; no historical names or dates have been invented.
4. Verify published content, preview/publish/unpublish behavior, mobile layouts and accessibility end to end.

## Content contract

Existing fields: `id`, `name`, `intro`, `keywords`, `image`, `recruitment`. Text uses `{zh, en, hant}`. Additional optional fields:

- `responsibilities` (falls back to intro), `dailyWork`, `history`.
- `recruitmentUrl`: HTTPS URL on `mp.weixin.qq.com`; legacy `url` is accepted if no recruitmentUrl is set and it validates.
- `heads[]`: `{name, term, termStart}`, sorted descending by ISO `YYYY-MM-DD` termStart.
- `published`: explicit false hides the department; absence retains backwards compatibility. The public API must omit unpublished records server-side.
- `articleLayout`, `poster`, `gallery[]`: the Organisation article layout and ordered images.
- `groups[]`: `{name, text, requirements[]}`.
- `leadership[]`: `{name, role, quote, image, crop?}`. This is separate from historical department heads. No leadership term is inferred.
- `recruitmentStatus`, `interview`, `benefits`, `applicationNote`, `applicationImage`.

New department IDs need matching static HTML routes. Current public imagery is supplied for this website by the user; original bytes are retained. Jasmine, Vivian and Jocelyn use the latest supplied portraits.

## Validation

Run `node tests/departments.cjs` and `node --check assets/app.js` / `node --check assets/home.js`. Tests cover unavailable records, date ordering, escaping, recruitment URL checks, article order, source assets, non-clickable photos and Jocelyn's approved message. Local browser checks covered Chinese/English rendering and navigation. Full production and mobile/accessibility acceptance remains pending.
