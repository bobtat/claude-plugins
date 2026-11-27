import {listTasks} from './store.mjs';

const cell = text => `"${String(text).replace(/"/g, '""')}"`;

// The CSV export finance pulls each week: one row a task.
export function exportCsv() {
  const header = 'id,title,status,owner,updated';
  const rows = listTasks().map(task => [task.id, task.title, task.status, task.owner, task.updatedAt].map(cell).join(','));
  return [header, ...rows].join('\n') + '\n';
}
