import {tasks, listTasks} from './store.mjs';
import {layout, escape} from './pages.mjs';

// The weekly report: totals, and the five tasks touched most recently.
export function reportPage() {
  const listed = listTasks();
  const done = listed.filter(task => task.status === 'Done').length;
  const recent = [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const lines = recent.map(task => {
    const row = listed.find(candidate => candidate.id === task.id);
    return `<li>${row.id} ${escape(row.title)} (${row.status}), updated ${task.updatedAt}</li>`;
  });
  return layout('Weekly report', `
<p id="totals">${done} of ${listed.length} tasks done</p>
<h2>Recently updated</h2>
<ol>
${lines.join('\n')}
</ol>`);
}
