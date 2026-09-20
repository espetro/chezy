# Nebius promo form automation

## Goal

Script the HackBarna promo-code claim form at
`https://nebius.com/promo-code?utm_promo_activation_code=HackBarna_1909_TF&...`
so it can be submitted without driving a browser.

## Findings (from live inspection, 2026-09-20)

- The form is a HubSpot embed in a cross-origin iframe
  (`js-eu1.hsforms.net`), portalId `26806167`, formId
  `88354744-4a98-4bb6-84d1-44870ed72bce`, region `eu1`.
- `hs_context` shows `captchaStatus: NOT_APPLICABLE` — no captcha on submit.
- UTM params map to hidden fields (`utm_promo_*`, `form_type=Promo`);
  `utm_promo_activation_code` renders as the visible "Activation code" input.
- HubSpot's public submissions endpoint accepts the whole thing in one POST:
  `https://api-eu1.hsforms.com/submissions/v3/integration/submit/<portal>/<form>`.
- Email validation rejects placeholder domains (`example.com` fails
  client-side). Job title is a fixed list of 18 options.
- Browser path works too (chrome-devtools MCP) but needs a remote-debugging
  Chrome and fights the custom combobox — HTTP is the reliable automation.

## Approach

`scripts/nebius-promo.ts` — dependency-free tsx CLI:

- `parseArgs` flags for every field; `--dry-run` prints the payload.
- Validates required fields + job title against the known option list.
- POSTs the v3 submissions body (fields + context + legalConsentOptions).
- Defaults carry the HackBarna UTM/activation values, overridable per flag.

## Verification

- `--dry-run` output eyeball check; `mise run validate:quick` in the worktree.
- No live submit test — a real POST creates a HubSpot contact; keep it manual.
