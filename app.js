const STORAGE_KEY = 'ai-mindmap-tracker-v1';

let data = null;
let currentFilter = 'all';

async function loadData() {
  const res = await fetch('data/activities.json');
  data = await res.json();
  applyStoredState();
  render();
}

/* ---------- persistence ---------- */

function getStorageState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

function applyStoredState() {
  const stored = getStorageState();
  data.categories.forEach(cat => {
    cat.tasks.forEach(task => {
      if (stored[task.id]) {
        task.status = stored[task.id].status || task.status;
        task.note   = stored[task.id].note   || '';
      }
    });
  });
}

function saveState() {
  const state = {};
  data.categories.forEach(cat => {
    cat.tasks.forEach(task => {
      state[task.id] = { status: task.status, note: task.note || '' };
    });
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.getElementById('last-saved').textContent =
    'Last saved: ' + new Date().toLocaleTimeString();
}

/* ---------- stats helpers ---------- */

function countByStatus(tasks, status) {
  return tasks.filter(t => t.status === status).length;
}

function allTasks() {
  return data.categories.flatMap(c => c.tasks);
}

function pct(done, total) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/* ---------- render ---------- */

function render() {
  renderSummary();
  renderCategories();
}

function renderSummary() {
  const tasks = allTasks();
  const total      = tasks.length;
  const done       = countByStatus(tasks, 'done');
  const inProgress = countByStatus(tasks, 'in-progress');
  const blocked    = countByStatus(tasks, 'blocked');
  const p          = pct(done, total);

  document.getElementById('stat-total').textContent     = total;
  document.getElementById('stat-done').textContent      = done;
  document.getElementById('stat-progress').textContent  = inProgress;
  document.getElementById('stat-blocked').textContent   = blocked;
  document.getElementById('overall-pct').textContent    = p + '%';
  document.getElementById('overall-fill').style.width   = p + '%';
}

function renderCategories() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  data.categories.forEach(cat => grid.appendChild(buildCard(cat)));
  applyFilter(currentFilter);
}

function buildCard(cat) {
  const total = cat.tasks.length;
  const done  = countByStatus(cat.tasks, 'done');
  const p     = pct(done, total);

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.category = cat.id;

  // header
  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <span class="cat-dot" style="background:${cat.color}"></span>
    <h2>${cat.name}</h2>
    <span class="cat-progress-text">${done}/${total}</span>
  `;
  card.appendChild(header);

  // category progress bar
  const progTrack = document.createElement('div');
  progTrack.className = 'cat-prog-track';
  const progFill = document.createElement('div');
  progFill.className = 'cat-prog-fill';
  progFill.style.cssText = `width:${p}%; background:${cat.color};`;
  progTrack.appendChild(progFill);
  card.appendChild(progTrack);

  // tasks
  const list = document.createElement('div');
  list.className = 'task-list';

  cat.tasks.forEach(task => {
    // task row
    const row = document.createElement('div');
    row.className = 'task-row';
    row.dataset.taskId = task.id;
    row.dataset.status = task.status;

    const info = document.createElement('div');
    info.className = 'task-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'task-name';
    nameEl.title = task.name;
    nameEl.textContent = task.name;

    const assigneeEl = document.createElement('div');
    if (task.assignee) {
      assigneeEl.className = 'task-assignee';
      assigneeEl.textContent = task.assignee;
    } else {
      assigneeEl.className = 'task-assignee unassigned';
      assigneeEl.textContent = 'Unassigned';
    }
    info.appendChild(nameEl);
    info.appendChild(assigneeEl);

    const sel = document.createElement('select');
    sel.className = 'status-select';
    sel.dataset.status = task.status;
    [
      ['not-started', '○ Not started'],
      ['in-progress', '◐ In progress'],
      ['done',        '● Done'],
      ['blocked',     '✕ Blocked'],
    ].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if (val === task.status) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.addEventListener('change', () => {
      task.status = sel.value;
      sel.dataset.status = sel.value;
      row.dataset.status = sel.value;
      updateCatProgress(cat, card);
      renderSummary();
      saveState();
      applyFilter(currentFilter);
    });

    row.appendChild(info);
    row.appendChild(sel);
    list.appendChild(row);

    // note row
    const noteRow = document.createElement('div');
    noteRow.className = 'note-row';
    noteRow.dataset.taskId = task.id;
    const noteTA = document.createElement('textarea');
    noteTA.className = 'task-note';
    noteTA.rows = 1;
    noteTA.placeholder = 'Add a note…';
    noteTA.value = task.note || '';
    noteTA.addEventListener('input', () => {
      task.note = noteTA.value;
      saveState();
    });
    noteRow.appendChild(noteTA);
    list.appendChild(noteRow);
  });

  card.appendChild(list);
  return card;
}

function updateCatProgress(cat, card) {
  const total = cat.tasks.length;
  const done  = countByStatus(cat.tasks, 'done');
  const p     = pct(done, total);
  card.querySelector('.cat-prog-fill').style.width = p + '%';
  card.querySelector('.cat-progress-text').textContent = `${done}/${total}`;
}

/* ---------- filtering ---------- */

function applyFilter(status) {
  currentFilter = status;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === status);
  });

  document.querySelectorAll('.task-row').forEach(row => {
    const noteRow = document.querySelector(`.note-row[data-task-id="${row.dataset.taskId}"]`);
    const visible = status === 'all' || row.dataset.status === status;
    row.classList.toggle('hidden', !visible);
    if (noteRow) noteRow.classList.toggle('hidden', !visible);
  });

  // hide cards where all tasks are filtered out
  document.querySelectorAll('.card').forEach(card => {
    const visibleTasks = card.querySelectorAll('.task-row:not(.hidden)');
    card.style.display = visibleTasks.length === 0 ? 'none' : '';
  });
}

/* ---------- export ---------- */

function exportCSV() {
  const rows = [['Category', 'Task', 'Assignee', 'Status', 'Note']];
  data.categories.forEach(cat => {
    cat.tasks.forEach(t => {
      rows.push([
        cat.name,
        t.name,
        t.assignee || '',
        t.status,
        (t.note || '').replace(/\n/g, ' '),
      ]);
    });
  });
  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ai-mindmap-progress.csv';
  a.click();
}

/* ---------- boot ---------- */

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
  });
  document.getElementById('export-btn').addEventListener('click', exportCSV);
  loadData();
});
