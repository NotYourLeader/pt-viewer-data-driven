# PT Schedule — 3-file structure

The page design is fully separated from the schedule content.

| File | What it is | How often you edit it |
|------|------------|----------------------|
| `index.html` | Page shell + all CSS (styling, layout) | Never (only to restyle) |
| `schedule.js` | Renderer — turns data into the timeline, tables and views | Never (only to change behaviour) |
| `data.json` | **All schedule content** | Every time the schedule changes |

To update the schedule, edit **`data.json` only** and reload the page. The timeline,
cover table, full schedule, leadership table, and the teacher/class views all
rebuild automatically from it.

## Hosting

Because the page loads `data.json` with `fetch()`, it must be served over HTTP,
not opened from disk. Two easy options:

- **GitHub Pages** — push all three files to a repo, enable Pages, done.
- **Local preview** — run `python3 -m http.server` in this folder, then open
  `http://localhost:8000`.

(If you open `index.html` directly with a `file://` path, the browser blocks the
data file and the page shows a load error explaining this.)

## Editing `data.json`

### Change a session's timing, room, or teacher
Find the session in the `sessions` array and edit the field:

```json
{
  "code": "8C.PTMBOTH",
  "date": "Mon 08 Jun",
  "startPeriod": 2,        // change timing here…
  "endPeriod": 4,          // …and here
  "room": "F2-10",         // change room here
  "teacher": "David Barton", // change the supervising teacher here
  "type": "triple"
}
```

- `startPeriod` / `endPeriod` are period numbers (1–10). P6 is lunch and is
  skipped automatically; a session may span across it.
- `teacher` controls which **row** the block appears in on the timeline. Change
  it (e.g. to a cover teacher) and the block moves to that person's row — a new
  row is created if they don't already have one.
- `room` and the period range show inside the block.
- Optional `cancelled: true` strikes the code through.
- Optional `flag` adds a badge + note:
  `"flag": { "type": "cover", "text": "COVER", "note": "P4 cover needed…" }`

### Cover / substitutions
Edit the `cover` array. Each entry is one row of the Cover table
(`date`, `period`, `trigger`, `type`, `affected`, `normalLesson`,
`normalTeacher`, `destination`, `instruction`).

### Period leaders (column headers)
Edit `periodLeaders`, keyed by date. Each entry: `{ "period": "P1", "text": "Name: codes" }`.

### Header, metrics, notes
Edit `meta.title`, `meta.subtitle`, and the `summary` block.

The `staticSections` and `fullSchedule` blocks hold richer HTML that changes
rarely; they can be edited too but aren't required for routine timing/room/cover
updates.

## Timeline: automatic focus on the next testing day

When the page loads, the Timeline now:

- **Collapses past days** — any day card dated before today is folded shut
  (you can click its header to expand it again).
- **Opens today and all future days.**
- **Scrolls to the next testing day** — the soonest day (today or later) that
  has at least one session — and highlights it with a green outline.

This uses the device's current date. Each day card is a collapsible header
showing the date and a session count; click any header to fold or unfold it.
If every day is in the past (e.g. viewing an archived schedule), the view
falls back to the last day that has sessions so you still land somewhere useful.

No data editing is needed for this — it is purely display behaviour in
`schedule.js`.
