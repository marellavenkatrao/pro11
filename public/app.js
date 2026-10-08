// ==============================================================================
// MongoDB Lab Experiment Suite - Interactive Client Script
// Handles state management, API requests, visual charts, and terminal emulation
// ==============================================================================

const state = {
  activeTab: 'tab-guided',
  activeView: 'table', // 'table' or 'json'
  currentData: null,
  books: [],
  indexes: [],
  allDatabases: [],
  terminalHistory: [],
  historyIndex: -1
};

// ------------------------------------------------------------------------------
// INITIALIZATION
// ------------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCopyButtons();
  initEventListeners();
  fetchStatusAndRefresh();
});

// ------------------------------------------------------------------------------
// TAB SWITCHING
// ------------------------------------------------------------------------------
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');
      state.activeTab = targetId;

      if (targetId === 'tab-aggregation') {
        runStudioPipeline();
      } else if (targetId === 'tab-explorer') {
        renderExplorer();
      }
    });
  });
}

// ------------------------------------------------------------------------------
// COPY TO CLIPBOARD HELPER
// ------------------------------------------------------------------------------
function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const textToCopy = btn.getAttribute('data-copy');
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast('Copied query to clipboard!');
        });
      }
    });
  });
}

// ------------------------------------------------------------------------------
// EVENT LISTENERS SETUP
// ------------------------------------------------------------------------------
function initEventListeners() {
  // Reset DB Button
  document.getElementById('btnQuickReset')?.addEventListener('click', handleQuickReset);

  // Run Full Lab
  document.getElementById('btnRunFullLab')?.addEventListener('click', handleRunFullLab);

  // Run Part A All
  document.getElementById('btnRunPartA')?.addEventListener('click', handleRunPartA);

  // Run Part B All
  document.getElementById('btnRunPartB')?.addEventListener('click', handleRunPartB);

  // Part A Step Buttons
  document.querySelectorAll('.btn-run-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const stepId = btn.getAttribute('data-step');
      runPartAStep(stepId, btn);
    });
  });

  // Part B Query Buttons
  document.querySelectorAll('.btn-run-query').forEach(btn => {
    btn.addEventListener('click', () => {
      const queryId = btn.getAttribute('data-query');
      runPartBQuery(queryId, btn);
    });
  });

  // Genre select filter trigger
  document.getElementById('genreSelectFilter')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const disp = document.getElementById('genreQueryDisplay');
    if (disp) disp.textContent = `db.books.find({ genre: "${val}" })`;
  });

  // Table vs JSON view toggle
  document.getElementById('btnViewTable')?.addEventListener('click', () => setViewFormat('table'));
  document.getElementById('btnViewJson')?.addEventListener('click', () => setViewFormat('json'));
  document.getElementById('btnClearConsole')?.addEventListener('click', clearConsole);

  // Snapshot refresh
  document.getElementById('btnRefreshSnap')?.addEventListener('click', fetchStatusAndRefresh);

  // Aggregation Studio Trigger
  document.getElementById('btnRunStudioPipeline')?.addEventListener('click', runStudioPipeline);
  document.getElementById('matchYearInput')?.addEventListener('change', runStudioPipeline);
  document.getElementById('btnCopyPipelineJson')?.addEventListener('click', () => {
    const jsonText = document.getElementById('studioOutputJson')?.innerText;
    if (jsonText) {
      navigator.clipboard.writeText(jsonText).then(() => showToast('Copied Pipeline JSON!'));
    }
  });

  // Explorer Add Book Modal
  document.getElementById('btnOpenAddModal')?.addEventListener('click', () => {
    document.getElementById('addBookModal')?.classList.remove('hidden');
  });
  document.getElementById('btnCloseModal')?.addEventListener('click', () => {
    document.getElementById('addBookModal')?.classList.add('hidden');
  });
  document.getElementById('btnCancelModal')?.addEventListener('click', () => {
    document.getElementById('addBookModal')?.classList.add('hidden');
  });
  document.getElementById('addBookForm')?.addEventListener('submit', handleAddBookForm);

  // Explorer Create Index Action
  document.getElementById('btnCreateIndexAction')?.addEventListener('click', async () => {
    await runPartBQuery('create-index');
    fetchStatusAndRefresh();
  });

  // Terminal actions
  document.getElementById('btnClearTerminal')?.addEventListener('click', clearTerminal);
  document.getElementById('btnExecutePrompt')?.addEventListener('click', handleTerminalSubmit);
  document.getElementById('terminalInput')?.addEventListener('keydown', handleTerminalKeydown);

  // Snippet chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cmd = chip.getAttribute('data-cmd');
      const input = document.getElementById('terminalInput');
      if (input && cmd) {
        input.value = cmd;
        handleTerminalSubmit();
      }
    });
  });
}

// ------------------------------------------------------------------------------
// API CALLS & REFRESH LOGIC
// ------------------------------------------------------------------------------
async function fetchStatusAndRefresh() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.connected) {
      const statusText = document.getElementById('mongoStatusText');
      if (statusText) statusText.textContent = `MongoDB ${data.serverVersion} Online`;

      document.getElementById('currentDbName').textContent = data.database;
      document.getElementById('docCountVal').textContent = data.documentCount;
      document.getElementById('indexCountVal').textContent = data.indexes ? data.indexes.length : 0;
      document.getElementById('snapDocCount').textContent = data.documentCount;

      state.indexes = data.indexes || [];
      state.allDatabases = data.allDatabases || [];

      // Fetch books
      const booksRes = await fetch('/api/books');
      const booksData = await booksRes.json();
      state.books = booksData.data || [];

      renderSnapshot(state.books);
      renderExplorer();
    }
  } catch (err) {
    console.error('Error fetching status:', err);
    const statusText = document.getElementById('mongoStatusText');
    if (statusText) statusText.textContent = 'Disconnected';
  }
}

// Quick Reset
async function handleQuickReset() {
  try {
    showToast('Resetting database and seeding canonical books...');
    const startTime = performance.now();
    const res = await fetch('/api/reset', { method: 'POST' });
    const data = await res.json();
    const elapsed = Math.round(performance.now() - startTime);

    setInspectorOutput('db.books.insertMany([ 5 sample books ])', data.books, elapsed, 'Reset Successful');
    showToast('Database reset with 5 canonical sample books!');
    fetchStatusAndRefresh();
  } catch (err) {
    showToast('Reset failed: ' + err.message, true);
  }
}

// Run Full Lab (Part A + Part B)
async function handleRunFullLab() {
  showToast('Executing Complete Lab Experiment Sequence...');
  await handleRunPartA();
  await handleRunPartB();
  showToast('Full Lab Experiment Sequence Completed Successfully!');
}

// Run Part A All
async function handleRunPartA() {
  try {
    showToast('Running Part (a): Databases & Collections...');
    const startTime = performance.now();
    const res = await fetch('/api/part-a/run-all', { method: 'POST' });
    const data = await res.json();
    const elapsed = Math.round(performance.now() - startTime);

    setInspectorOutput('Part (a) Sequential Workflow (Steps 1 to 7)', data.steps, elapsed, 'Part (a) Completed');
    fetchStatusAndRefresh();
  } catch (err) {
    showToast('Part (a) execution error: ' + err.message, true);
  }
}

// Run Part B All
async function handleRunPartB() {
  try {
    showToast('Running Part (b): Records Operations & Aggregations...');
    const startTime = performance.now();
    const res = await fetch('/api/part-b/run-all', { method: 'POST' });
    const data = await res.json();
    const elapsed = Math.round(performance.now() - startTime);

    setInspectorOutput('Part (b) All Queries & Aggregations', data.data, elapsed, 'Part (b) Completed');
    fetchStatusAndRefresh();
    if (state.activeTab === 'tab-aggregation') runStudioPipeline();
  } catch (err) {
    showToast('Part (b) execution error: ' + err.message, true);
  }
}

// Run Individual Part A Step
async function runPartAStep(stepId, btnElement) {
  try {
    btnElement.classList.add('loading');
    const startTime = performance.now();
    const res = await fetch(`/api/part-a/step/${stepId}`, { method: 'POST' });
    const data = await res.json();
    const elapsed = Math.round(performance.now() - startTime);
    btnElement.classList.remove('loading');

    setInspectorOutput(data.command || `Step ${stepId}`, data.result, elapsed, `Step ${stepId} Done`);
    fetchStatusAndRefresh();
  } catch (err) {
    if (btnElement) btnElement.classList.remove('loading');
    showToast(`Step failed: ${err.message}`, true);
  }
}

// Run Individual Part B Query
async function runPartBQuery(queryId, btnElement) {
  try {
    if (btnElement) btnElement.classList.add('loading');
    const genre = document.getElementById('genreSelectFilter')?.value || 'Dystopian';
    const startTime = performance.now();
    const res = await fetch(`/api/part-b/query/${queryId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genre, yearFilter: 1900 })
    });
    const data = await res.json();
    const elapsed = Math.round(performance.now() - startTime);
    if (btnElement) btnElement.classList.remove('loading');

    setInspectorOutput(data.command || queryId, data.result, elapsed, 'Query Executed');
    fetchStatusAndRefresh();
    if (state.activeTab === 'tab-aggregation') runStudioPipeline();
  } catch (err) {
    if (btnElement) btnElement.classList.remove('loading');
    showToast(`Query failed: ${err.message}`, true);
  }
}

// ------------------------------------------------------------------------------
// INSPECTOR CONSOLE RENDERING
// ------------------------------------------------------------------------------
function setInspectorOutput(command, data, elapsedMs, statusMsg = 'Ready') {
  state.currentData = data;

  // Update command banner
  const cmdCode = document.getElementById('activeCmdCode');
  if (cmdCode) cmdCode.textContent = command;

  // Update badges
  const timerBadge = document.getElementById('execTimerBadge');
  if (timerBadge) timerBadge.textContent = `${elapsedMs} ms`;

  const statusBadge = document.getElementById('execStatusBadge');
  if (statusBadge) statusBadge.textContent = statusMsg;

  // JSON view
  const jsonCode = document.querySelector('#resultsJsonContainer code');
  if (jsonCode) {
    jsonCode.textContent = JSON.stringify(data, null, 2);
  }

  // Table view
  renderTableView(data);
}

function renderTableView(data) {
  const container = document.getElementById('resultsTableContainer');
  if (!container) return;

  if (!data || (Array.isArray(data) && data.length === 0)) {
    container.innerHTML = '<p class="empty-state">No records or empty array returned.</p>';
    return;
  }

  // If array of objects
  if (Array.isArray(data) && typeof data[0] === 'object' && data[0] !== null) {
    const keys = Object.keys(data[0]);
    let html = '<table><thead><tr>';
    keys.forEach(k => html += `<th>${escapeHtml(k)}</th>`);
    html += '</tr></thead><tbody>';

    data.forEach(item => {
      html += '<tr>';
      keys.forEach(k => {
        let val = item[k];
        if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        } else if (k === 'price') {
          val = `$${parseFloat(val).toFixed(2)}`;
        }
        html += `<td>${escapeHtml(String(val))}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } else if (typeof data === 'object') {
    // Single object or dictionary
    let html = '<table><thead><tr><th>Property</th><th>Value</th></tr></thead><tbody>';
    for (const [k, v] of Object.entries(data)) {
      const formattedVal = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v);
      html += `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(formattedVal)}</td></tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  } else {
    container.innerHTML = `<div style="padding:1rem;color:#A7F3D0;font-family:var(--font-mono);">${escapeHtml(String(data))}</div>`;
  }
}

function setViewFormat(format) {
  state.activeView = format;
  const tableBtn = document.getElementById('btnViewTable');
  const jsonBtn = document.getElementById('btnViewJson');
  const tableCont = document.getElementById('resultsTableContainer');
  const jsonCont = document.getElementById('resultsJsonContainer');

  if (format === 'table') {
    tableBtn?.classList.add('active');
    jsonBtn?.classList.remove('active');
    tableCont?.classList.remove('hidden');
    jsonCont?.classList.add('hidden');
  } else {
    jsonBtn?.classList.add('active');
    tableBtn?.classList.remove('active');
    jsonCont?.classList.remove('hidden');
    tableCont?.classList.add('hidden');
  }
}

function clearConsole() {
  const container = document.getElementById('resultsTableContainer');
  if (container) container.innerHTML = '<p class="empty-state">Console cleared. Run a step to inspect results.</p>';
  const jsonCode = document.querySelector('#resultsJsonContainer code');
  if (jsonCode) jsonCode.textContent = '// Console cleared';
  document.getElementById('execTimerBadge').textContent = '0 ms';
  document.getElementById('execStatusBadge').textContent = 'Cleared';
}

// ------------------------------------------------------------------------------
// MINI-SNAPSHOT & EXPLORER RENDERING
// ------------------------------------------------------------------------------
function renderSnapshot(books) {
  const list = document.getElementById('snapBooksList');
  if (!list) return;

  if (!books || books.length === 0) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:0.75rem;padding:0.5rem;">Collection is currently empty or dropped.</div>';
    return;
  }

  let html = '';
  books.forEach(b => {
    html += `
      <div class="snap-book-item">
        <span class="snap-title">${escapeHtml(b.title)}</span>
        <span class="snap-meta">${escapeHtml(b.genre)} • ${b.year}</span>
      </div>
    `;
  });
  list.innerHTML = html;
}

function renderExplorer() {
  // 1. Books Grid
  const grid = document.getElementById('booksCardGrid');
  if (grid) {
    if (!state.books || state.books.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 2rem; text-align: center; color: var(--text-muted);">No books in collection. Click "Reset DB" or "+ Add New Book".</div>';
    } else {
      let html = '';
      state.books.forEach(b => {
        const genreClass = 'badge genre-' + (b.genre ? b.genre.toLowerCase().replace(/\s+/g, '-') : 'default');
        html += `
          <div class="book-card">
            <div class="book-card-top">
              <div class="book-title">${escapeHtml(b.title)}</div>
              <span class="${genreClass}">${escapeHtml(b.genre || 'General')}</span>
            </div>
            <div class="book-author">by ${escapeHtml(b.author)}</div>
            <div class="book-meta-row">
              <span>Year: <strong>${b.year}</strong></span>
              <span class="book-price">$${parseFloat(b.price || 0).toFixed(2)}</span>
            </div>
            <div class="book-card-actions">
              <button class="delete-btn-ghost" onclick="handleDeleteBook('${b._id || b.title}')">Delete</button>
            </div>
          </div>
        `;
      });
      grid.innerHTML = html;
    }
  }

  // 2. Indexes List
  const indexesList = document.getElementById('indexesListContainer');
  if (indexesList) {
    if (!state.indexes || state.indexes.length === 0) {
      indexesList.innerHTML = '<div style="color:var(--text-dim);font-size:0.75rem;">No indexes found.</div>';
    } else {
      let html = '';
      state.indexes.forEach(idx => {
        html += `
          <div class="index-item">
            <div>
              <div class="index-name">${escapeHtml(idx.name)}</div>
              <div class="index-key">${escapeHtml(JSON.stringify(idx.key))}</div>
            </div>
            <span class="badge" style="background:rgba(255,255,255,0.06);color:#94A3B8;">v:${idx.v || 2}</span>
          </div>
        `;
      });
      indexesList.innerHTML = html;
    }
  }

  // 3. Databases Table
  const dbWrap = document.getElementById('databasesTableWrap');
  if (dbWrap && state.allDatabases.length > 0) {
    let html = '<table><thead><tr><th>Database</th><th>Size (KB)</th></tr></thead><tbody>';
    state.allDatabases.forEach(d => {
      const sizeKb = Math.round((d.sizeOnDisk || 0) / 1024);
      html += `<tr><td><strong>${escapeHtml(d.name)}</strong></td><td>${sizeKb} KB</td></tr>`;
    });
    html += '</tbody></table>';
    dbWrap.innerHTML = html;
  }
}

// Delete book handler
window.handleDeleteBook = async function(id) {
  try {
    const res = await fetch(`/api/books/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Document deleted.');
      fetchStatusAndRefresh();
    }
  } catch (err) {
    showToast('Delete failed: ' + err.message, true);
  }
};

// Add book form
async function handleAddBookForm(e) {
  e.preventDefault();
  const title = document.getElementById('bookTitle').value.trim();
  const author = document.getElementById('bookAuthor').value.trim();
  const year = document.getElementById('bookYear').value;
  const price = document.getElementById('bookPrice').value;
  const genre = document.getElementById('bookGenre').value;

  if (!title || !author) return;

  try {
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, author, year, price, genre })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Inserted document: "${title}"`);
      document.getElementById('addBookModal')?.classList.add('hidden');
      document.getElementById('addBookForm')?.reset();
      fetchStatusAndRefresh();
    }
  } catch (err) {
    showToast('Failed to insert: ' + err.message, true);
  }
}

// ------------------------------------------------------------------------------
// TAB 2: AGGREGATION PIPELINE STUDIO
// ------------------------------------------------------------------------------
async function runStudioPipeline() {
  const yearInput = document.getElementById('matchYearInput');
  const minYear = parseInt(yearInput ? yearInput.value : 1900) || 1900;

  const pipeline = [
    { $match: { year: { $gt: minYear } } },
    { $group: { _id: "$genre", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
    { $sort: { count: -1 } },
    { $project: { genre: "$_id", count: 1, avgPrice: 1, _id: 0 } }
  ];

  try {
    const res = await fetch('/api/aggregate-custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline })
    });
    const data = await res.json();

    if (data.success) {
      const results = data.result || [];
      renderPipelineResults(results, minYear);
    }
  } catch (err) {
    console.error('Studio pipeline error:', err);
  }
}

function renderPipelineResults(results, minYear) {
  // Update stage counters
  const filteredCount = state.books.filter(b => b.year > minYear).length;
  document.getElementById('matchCount').textContent = `${filteredCount} docs`;
  document.getElementById('groupCount').textContent = `${results.length} groups`;

  // JSON viewer
  const jsonElem = document.getElementById('studioOutputJson');
  if (jsonElem) jsonElem.textContent = JSON.stringify(results, null, 2);

  // Table viewer
  const tableWrap = document.getElementById('studioOutputTable');
  if (tableWrap) {
    let html = '<table><thead><tr><th>Genre</th><th>Document Count</th><th>Average Price</th></tr></thead><tbody>';
    results.forEach(r => {
      html += `<tr><td><strong>${escapeHtml(r.genre)}</strong></td><td>${r.count}</td><td>$${r.avgPrice.toFixed(2)}</td></tr>`;
    });
    html += '</tbody></table>';
    tableWrap.innerHTML = html;
  }

  // Visual Chart Bars
  const chartElem = document.getElementById('aggBarsChart');
  if (chartElem) {
    if (results.length === 0) {
      chartElem.innerHTML = '<div style="color:var(--text-dim);padding:1rem;">No documents matched the year filter.</div>';
      return;
    }
    const maxCount = Math.max(...results.map(r => r.count), 1);
    let chartHtml = '';
    results.forEach(r => {
      const percent = Math.round((r.count / maxCount) * 100);
      chartHtml += `
        <div class="chart-bar-row">
          <div class="chart-bar-labels">
            <span><strong>${escapeHtml(r.genre)}</strong> (${r.count} books)</span>
            <span style="color:#34D399;">Avg: $${r.avgPrice.toFixed(2)}</span>
          </div>
          <div class="chart-bar-bg">
            <div class="chart-bar-fill" style="width: ${percent}%;">
              ${r.count}
            </div>
          </div>
        </div>
      `;
    });
    chartElem.innerHTML = chartHtml;
  }
}

// ------------------------------------------------------------------------------
// TAB 4: MONGOSH TERMINAL EMULATION
// ------------------------------------------------------------------------------
async function handleTerminalSubmit() {
  const input = document.getElementById('terminalInput');
  if (!input) return;

  const rawCmd = input.value.trim();
  if (!rawCmd) return;

  // Add to command history
  state.terminalHistory.push(rawCmd);
  state.historyIndex = state.terminalHistory.length;
  input.value = '';

  appendTerminalLine(`library> ${rawCmd}`, 'cmd-prompt');

  try {
    // Intercept client-side terminal helpers
    if (rawCmd === 'clear' || rawCmd === 'cls') {
      clearTerminal();
      return;
    }

    const res = await fetch('/api/run-mongosh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: rawCmd })
    });
    const data = await res.json();

    if (data.stdout) {
      appendTerminalLine(data.stdout, 'output-text');
    }
    if (data.stderr) {
      appendTerminalLine(data.stderr, 'error-text');
    }
    if (data.error) {
      appendTerminalLine('Error: ' + data.error, 'error-text');
    }
  } catch (err) {
    appendTerminalLine('Connection Error: ' + err.message, 'error-text');
  }

  fetchStatusAndRefresh();
}

function handleTerminalKeydown(e) {
  if (e.key === 'Enter') {
    handleTerminalSubmit();
  } else if (e.key === 'ArrowUp') {
    if (state.terminalHistory.length > 0 && state.historyIndex > 0) {
      state.historyIndex--;
      e.target.value = state.terminalHistory[state.historyIndex];
    }
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    if (state.historyIndex < state.terminalHistory.length - 1) {
      state.historyIndex++;
      e.target.value = state.terminalHistory[state.historyIndex];
    } else {
      state.historyIndex = state.terminalHistory.length;
      e.target.value = '';
    }
    e.preventDefault();
  }
}

function appendTerminalLine(text, className = 'output-text') {
  const screen = document.getElementById('terminalScreen');
  if (!screen) return;

  const line = document.createElement('div');
  line.className = `term-line ${className}`;
  line.textContent = text;
  screen.appendChild(line);
  screen.scrollTop = screen.scrollHeight;
}

function clearTerminal() {
  const screen = document.getElementById('terminalScreen');
  if (screen) {
    screen.innerHTML = `
      <div class="term-line banner">Terminal screen cleared. Connected to: mongodb://127.0.0.1:27017/library</div>
      <div class="term-line spacer"></div>
    `;
  }
}

// ------------------------------------------------------------------------------
// TOAST NOTIFICATIONS
// ------------------------------------------------------------------------------
function showToast(message, isError = false) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;

  toast.textContent = message;
  toast.style.borderColor = isError ? '#EF4444' : '#10B981';
  toast.classList.remove('hidden');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
