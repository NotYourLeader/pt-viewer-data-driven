# MYP PT Schedule Viewer — Data-driven version

This version separates the display from the schedule data.

## What to edit

Edit the CSV files in `data/`:

- `sessions.csv` — the main testing-session source of truth.
- `cover.csv` — cover, room moves, supervision handovers and related operational notes.
- `leadership.csv` — period-by-period mobile leadership assignments.
- `adjustments.csv` — audit trail of moved/cancelled/replaced sessions.
- `concurrent.csv` — concurrent-session summary table.

`index.html`, `css/styles.css` and `js/app.js` should normally stay unchanged.

## How to publish on GitHub Pages

1. Put this folder in a GitHub repo.
2. Commit and push.
3. Enable GitHub Pages for the branch/folder that contains `index.html`.
4. To update the schedule, edit the relevant CSV and push again.

## Local preview

Do not double-click `index.html`; browser security can block CSV loading. Use a local server:

```bash
cd pt-viewer-data-driven
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Optional SQLite

`data/schedule.sqlite` is included as a mirror of the CSV data. The web app currently hydrates from CSV because this works directly on GitHub Pages without additional libraries.

## Notes

The original uploaded HTML is copied to `legacy-original.html` for comparison/back-up.
