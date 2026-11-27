// Fixture app for agentic-qa cost runs. Stateful, in memory, with two planted defects:
//  D1: the orders list spells a cancelled order's status "Canceled" (the ticket says "Cancelled").
//  D2: a cancelled order's page still shows the "Cancel order" button.
import http from 'node:http';
import fs from 'node:fs';
const N = Number(process.env.ROWS || 100);
const PORT = Number(process.env.PORT || 8765);
const LOG = process.env.REQ_LOG;
const orders = Array.from({length: N}, (_, i) => ({id: `ORD-${1000 + i}`, customer: `Customer ${i} Ltd`, total: `${(i * 37 % 900) + 50}.00`, status: ['Paid', 'Pending', 'Refunded'][i % 3]}));
const find = id => orders.find(o => o.id === id);
const nav = Array.from({length: 18}, (_, i) => `<li><a href="/section/${i}">Section ${i} of the application</a></li>`).join('');
const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:sans-serif}td,th{padding:2px 8px;text-align:left}</style></head><body><header><nav aria-label="Main"><ul style="columns:6">${nav}</ul></nav><button aria-label="Account menu">qa-test-1</button></header><main><h1>${title}</h1>${body}</main><footer><a href="/terms">Terms</a> <a href="/privacy">Privacy</a></footer></body></html>`;
const listStatus = s => s === 'Cancelled' ? 'Canceled' : s; // D1
const list = () => page('Orders', `<form onsubmit="return false"><label>Search <input name="q" id="q"></label> <button type="button" id="go">Search</button></form><p id="r" role="status" aria-label="Search results"></p><table aria-label="Orders"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>${orders.map(o => `<tr data-id="${o.id}"><td><a href="/orders/${o.id}">${o.id}</a></td><td>${o.customer}</td><td>${o.total} USD</td><td>${listStatus(o.status)}</td><td><a href="/orders/${o.id}" aria-label="Open ${o.id}">Open</a></td></tr>`).join('')}</tbody></table><script>document.getElementById('go').onclick=()=>{const q=document.getElementById('q').value.trim();let n=0;for(const tr of document.querySelectorAll('tbody tr')){const hit=tr.dataset.id.includes(q);tr.hidden=!hit;if(hit)n++;}document.getElementById('r').textContent='Showing '+n+' result'+(n===1?'':'s')+' for '+q;};</script>`);
const detail = o => page(`Order ${o.id}`, `<dl><dt>Customer</dt><dd>${o.customer}</dd><dt>Total</dt><dd>${o.total} USD</dd><dt>Status</dt><dd><span id="st" role="status" aria-label="Order status">${o.status}</span></dd></dl>${o.status === 'Paid' || o.status === 'Cancelled' /* D2 */ ? '<button id="c">Cancel order</button>' : ''}<p id="m" role="alert"></p><p><a href="/">Back to orders</a></p><script>const c=document.getElementById('c');if(c)c.onclick=async()=>{const r=await fetch('/api/orders/${o.id}/cancel',{method:'POST'});const j=await r.json();if(r.ok){document.getElementById('st').textContent=j.status;document.getElementById('m').textContent='Order ${o.id} cancelled';}else{document.getElementById('m').textContent=j.error;}};</script>`);
http.createServer((req, res) => {
  if (LOG) fs.appendFileSync(LOG, `${new Date().toISOString()} ${req.method} ${req.url}\n`);
  const json = (code, body) => { res.writeHead(code, {'content-type': 'application/json'}); res.end(JSON.stringify(body)); };
  // The build the unattended fixture's Intake checks against the pull request's merge commit.
  if (req.url === '/api/version') return json(200, {commit: '4f2a9c1e7b3d5a60c8e9f1a2b3c4d5e6f7a8b9c0', pr: 7});
  // Any id reaches the API, so an unknown one gets the JSON error the pull request's diff shows.
  const api = /^\/api\/orders\/([^/?#]+)(\/cancel)?$/.exec(req.url);
  if (api) {
    const o = find(api[1]);
    if (!o) return json(404, {error: 'No such order'});
    if (!api[2]) return json(200, o);
    if (req.method !== 'POST') return json(405, {error: 'Use POST'});
    if (o.status === 'Refunded') return json(409, {error: 'Refunded orders cannot be cancelled'});
    o.status = 'Cancelled';
    return json(200, o);
  }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  const d = /^\/orders\/(ORD-\d+)$/.exec(req.url);
  if (d && find(d[1])) return res.end(detail(find(d[1])));
  if (req.url === '/') return res.end(list());
  res.statusCode = 404; res.end(page('Not found', '<p>Nothing here.</p>'));
}).listen(PORT, '127.0.0.1');
