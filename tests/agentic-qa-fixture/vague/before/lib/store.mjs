// The task store. It is in memory: a restart is a fresh set.
export const tasks = [
  {id: 'T-101', title: 'Renew the TLS certificate', status: 'Done', owner: 'ana', updatedAt: '2026-11-16T09:12:00.000Z'},
  {id: 'T-102', title: 'Write the onboarding guide', status: 'Open', owner: 'ben', updatedAt: '2026-11-17T14:03:00.000Z'},
  {id: 'T-103', title: 'Move the nightly backup to 02:00', status: 'Done', owner: 'ana', updatedAt: '2026-11-18T08:40:00.000Z'},
  {id: 'T-104', title: 'Fix the invoice footer', status: 'Open', owner: 'chi', updatedAt: '2026-11-18T16:25:00.000Z'},
  {id: 'T-105', title: 'Review the access list', status: 'Open', owner: 'ben', updatedAt: '2026-11-19T10:00:00.000Z'},
  {id: 'T-106', title: 'Retire the old status page', status: 'Done', owner: 'chi', updatedAt: '2026-11-19T17:30:00.000Z'},
];

export const findTask = id => tasks.find(task => task.id === id);

// Every list a person sees goes through here.
export function listTasks({query = ''} = {}) {
  const q = query.trim().toLowerCase();
  return tasks
    .filter(task => !q || task.id.toLowerCase().includes(q) || task.title.toLowerCase().includes(q));
}
