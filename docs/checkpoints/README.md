# Demo checkpoints

The demo is four checkpoints, in order. Each has one owner, one file here, one
definition of done, and one recording that goes into the video. Teammates work on
checkpoints in parallel; the seams between them are the contracts written in each
file. If you change what a checkpoint hands to the next one, update both files in the
same PR.

| #   | Checkpoint           | User-visible outcome                                                                                        | Video ids (`apps/video`) | File                                                     |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------- |
| 1   | Onboarding           | The user is onboarded and their preferences are stored                                                      | `brief`                  | [01-onboarding.md](01-onboarding.md)                     |
| 2   | Matching             | Preferences are matched against the property DB; the agent asks which ones the user likes and which to book | `shortlist`, `forensic`  | [02-matching.md](02-matching.md)                         |
| 3   | Book a visit         | The voice agent phones the property owner or agency and agrees a slot                                       | `call`                   | [03-book-a-visit.md](03-book-a-visit.md)                 |
| 4   | Calendar appointment | The appointment lands in the calendar and in the app. The wow moment                                        | `booked`                 | [04-calendar-appointment.md](04-calendar-appointment.md) |

## Rules

- One happy path per checkpoint. Variations are out of scope until the four happy
  paths chain end to end on one machine.
- A checkpoint is done when its exit state is reachable from its entry state using
  only the code on `main`, with mock modes where the file says mock is allowed, and
  its recording is committed.
- The seed data is the 300-listing snapshot (`chezy-mock-data/`, `mise run db:seed`).
  Measured 2026-09-20: the rent set is 150 rows, 50 without a district, median rent
  3,250 EUR. Briefs under about 2,300 EUR with must-haves return nothing. Pick demo
  briefs from the data, not from the PRD prose; see 02-matching.md.
- Do not build a chat page. The vercel-derived `/chat` UI was dropped 2026-09-20; the
  chat API routes (`apps/web/app/(chat)/api/*`), the AI tools (`apps/web/lib/ai/tools/*`)
  and the components under `apps/web/components/chat/*` remain and may be reused.

## Recording

Every checkpoint ships one clip. The contract is `apps/video/CAPTURE.md` (generated
from `apps/video/src/config/demo.config.ts`); the short version:

- Portrait phone framing, 393x852 CSS px at deviceScaleFactor 3 (1179x2556). Any
  393:852 recording works; higher is better.
- Drop the file at `apps/video/public/clips/<video id>.webm` (or `.mp4`) and set that
  checkpoint's `source` to `{ kind: "clip", file }` in `demo.config.ts`.
- Length: the file's "Target seconds". Short clips hold the last frame; long clips are
  trimmed to the voice-over.
- Show what the file's "Must show" list says. No cursor hunting, no dev tools, no
  console. Dark mode unless the checkpoint says otherwise.
- Record with `agent-browser` or `playwright-cli` (both mise-pinned) so the take is
  reproducible; put the script next to the clip as `<video id>.capture.md` or `.ts`.
- One checkpoint per clip. The video stitches them; do not record the whole flow in one
  take.

## Status

Update this table in the PR that moves a checkpoint.

| Checkpoint             | Owner | Code on main                                                                               | Recording   |
| ---------------------- | ----- | ------------------------------------------------------------------------------------------ | ----------- |
| 1 Onboarding           |       | conversational path on main; form-in-chat not built                                        | placeholder |
| 2 Matching             |       | scorer + feed on main; scored cards + accept/reject in PR #47                              | placeholder |
| 3 Book a visit         |       | `/api/viewing` mock/slng/vonage on main; `arrangeViewing` tool + `Viewing` table in PR #47 | placeholder |
| 4 Calendar appointment |       | `/api/calendar` mock/google on main; ViewingCard + persisted row in PR #47                 | placeholder |
