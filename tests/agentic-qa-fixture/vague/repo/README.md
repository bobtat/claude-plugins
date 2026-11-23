# tasks

A small task tracker. `node server.mjs` serves it on `PORT` (default 8780).

- `lib/store.mjs` holds the tasks. Every list a person sees comes from `listTasks()`.
- `lib/pages.mjs` renders the task list and a task's page.
- `lib/reports.mjs` renders the weekly report.
- `lib/export.mjs` writes the CSV export.
