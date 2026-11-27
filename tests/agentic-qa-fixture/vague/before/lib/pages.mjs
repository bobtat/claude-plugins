import {tasks, listTasks, findTask} from './store.mjs';

export const escape = text => String(text).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

export const layout = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escape(title)}</title></head>
<body>
<header><p>Signed in as qa-test-1</p>
<nav><a href="/tasks">Tasks</a> <a href="/reports">Weekly report</a> <a href="/export.csv">Export CSV</a></nav></header>
<main><h1>${escape(title)}</h1>
${body}
</main></body></html>`;

export function listPage(query = '') {
  const rows = listTasks({query});
  return layout('Tasks', `
<form method="get" action="/tasks"><label>Search <input name="q" value="${escape(query)}"></label> <button>Search</button></form>
<p id="count">${tasks.length} tasks</p>
<table><thead><tr><th>Id</th><th>Title</th><th>Status</th><th>Owner</th></tr></thead><tbody>
${rows.map(task => `<tr><td><a href="/tasks/${task.id}">${task.id}</a></td><td>${escape(task.title)}</td><td>${task.status}</td><td>${task.owner}</td></tr>`).join('\n')}
</tbody></table>`);
}

export function taskPage(id) {
  const task = findTask(id);
  if (!task) return null;
  return layout(`${task.id} ${task.title}`, `
<dl><dt>Status</dt><dd>${task.status}</dd><dt>Owner</dt><dd>${task.owner}</dd><dt>Updated</dt><dd>${task.updatedAt}</dd></dl>
<p><a href="/tasks">Back to tasks</a></p>`);
}
