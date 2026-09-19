# Mobile-first flow and auth layouts

## Scope

Refactor the `(flow)` and `(auth)` user-facing layouts in `apps/web` for small screens
first, preserving the vendor copy and `(chat)` route group.

## Implementation

- Apply the requested responsive container, typography, spacing, and touch-target classes.
- Ensure flow onboarding controls and radios meet the 44px minimum target.
- Update auth form controls and submit action for mobile sizing.

## Verification

- Run `mise run validate:quick`.
- Start the local database/app as needed and capture `/`, `/onboarding`, `/explore`, and
  `/login` at 375x812 and 1280x800 with Playwright.
