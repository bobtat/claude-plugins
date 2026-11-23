import http from 'node:http';
import fs from 'node:fs';
import * as store from './lib/store.mjs';
import {listPage, taskPage} from './lib/pages.mjs';
import {reportPage} from './lib/reports.mjs';
import {exportCsv} from './lib/export.mjs';

const PORT = Number(process.env.PORT ?? 8780);
const BUILD = {commit: process.env.COMMIT ?? 'unknown', pr: Number(process.env.PR ?? 0)};

const send = (res, status, type, body, headers = {}) => { res.writeHead(status, {'content-type': type, ...headers}); res.end(body); };
const html = (res, body, status = 200) => send(res, status, 'text/html; charset=utf-8', body);
const json = (res, value, status = 200) => send(res, status, 'application/json', JSON.stringify(value));

function route(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const id = /^\/(?:api\/)?tasks\/(T-\d+)/.exec(path)?.[1];

  // What the leads and finance read.
  if (req.method === 'GET' && path === '/reports') return html(res, reportPage());
  if (req.method === 'GET' && path === '/export.csv') return send(res, 200, 'text/csv; charset=utf-8', exportCsv());
  if (req.method === 'GET' && path === '/api/version') return json(res, BUILD);
  if (req.method === 'GET' && path === '/api/tasks') return json(res, store.tasks);

  // The task list and a task's page.
  if (req.method === 'GET' && path === '/') return send(res, 302, 'text/plain', '', {location: '/tasks'});
  if (req.method === 'GET' && path === '/tasks') return html(res, listPage(url.searchParams.get('q') ?? ''));
  if (req.method === 'GET' && path === `/tasks/${id}`) {
    const page = taskPage(id, url.searchParams.has('archived') ? `${id} archived` : '');
    return page ? html(res, page) : html(res, 'No such task', 404);
  }
  if (req.method === 'POST' && path === `/tasks/${id}/archive`) {
    if (!store.archiveTask(id)) return html(res, 'No such task', 404);
    return send(res, 303, 'text/plain', '', {location: `/tasks/${id}?archived`});
  }

  // One task, for scripts.
  if (req.method === 'GET' && path === `/api/tasks/${id}`) {
    const task = store.findTask(id);
    return task ? json(res, task) : json(res, {error: 'No such task'}, 404);
  }
  if (req.method === 'POST' && path === `/api/tasks/${id}/archive`) {
    const task = store.archiveTask(id);
    return task ? json(res, task) : json(res, {error: 'No such task'}, 404);
  }
  return html(res, 'Not found', 404);
}

http.createServer((req, res) => {
  if (process.env.REQ_LOG) fs.appendFileSync(process.env.REQ_LOG, `${new Date().toISOString()} ${req.method} ${req.url}\n`);
  try {
    route(req, res);
  } catch (error) {
    console.error(error);
    send(res, 500, 'text/plain', 'Internal Server Error');
  }
}).listen(PORT, () => console.log(`tasks on http://localhost:${PORT}`));
