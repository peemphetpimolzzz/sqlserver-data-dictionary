import { DatabaseModel, TableModel } from '../model/types';

export function renderHtml(model: DatabaseModel): string {
  const totalColumns = model.tables.reduce((sum, t) => sum + t.columns.length, 0);
  const totalPks = model.tables.reduce((sum, t) => sum + t.columns.filter((c) => c.isPrimaryKey).length, 0);
  const totalFks = model.tables.reduce((sum, t) => sum + t.columns.filter((c) => c.foreignKey).length, 0);
  const documentedCols = model.tables.reduce(
    (sum, t) => sum + t.columns.filter((c) => (c.description?.trim().length ?? 0) > 0).length,
    0,
  );
  const docPct = totalColumns > 0 ? Math.round((documentedCols / totalColumns) * 100) : 100;

  const schemas = Array.from(new Set(model.tables.map((t) => t.schema)));
  const schemaPills = [
    `<button class="schema-pill active" onclick="filterSchema('all', this)">All (${model.tables.length})</button>`,
    ...schemas.map((s) => {
      const count = model.tables.filter((t) => t.schema === s).length;
      return `<button class="schema-pill" onclick="filterSchema('${escapeHtml(s)}', this)">${escapeHtml(s)} (${count})</button>`;
    }),
  ].join('\n          ');

  const navItems = model.tables
    .map(
      (t, idx) => `
        <a href="#table-${escapeHtml(t.schema)}-${escapeHtml(t.name)}" class="table-nav-item${idx === 0 ? ' active' : ''}" data-schema="${escapeHtml(t.schema)}" data-name="${escapeHtml(t.name)}">
          <div class="table-nav-name">
            <span class="schema-tag">${escapeHtml(t.schema)}.</span>
            <span class="t-name">${escapeHtml(t.name)}</span>
          </div>
          <span class="table-meta-count">${t.columns.length} cols</span>
        </a>`,
    )
    .join('');

  const tableCards = model.tables.map((t) => renderTableCard(t)).join('\n');

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SchemaLens — ${escapeHtml(model.name)} Data Dictionary</title>
  <style>
    :root {
      --bg-app: #f8fafc;
      --bg-surface: #ffffff;
      --bg-subtle: #f1f5f9;
      --bg-hover: #f8fafc;
      --bg-active: #eff6ff;
      --text-primary: #09090b;
      --text-secondary: #475569;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --accent: #2563eb;
      --accent-border: #bfdbfe;
      --pk-bg: #fef3c7;
      --pk-text: #b45309;
      --pk-border: #fde68a;
      --fk-bg: #eff6ff;
      --fk-text: #1d4ed8;
      --fk-border: #bfdbfe;
      --uq-bg: #f3e8ff;
      --uq-text: #6d28d9;
      --uq-border: #ddd6fe;
      --nn-bg: #f1f5f9;
      --nn-text: #334155;
      --ok-bg: #ecfdf5;
      --ok-text: #047857;
      --ok-border: #a7f3d0;
    }
    [data-theme="dark"] {
      --bg-app: #09090b;
      --bg-surface: #121215;
      --bg-subtle: #18181b;
      --bg-hover: #1f1f23;
      --bg-active: #172554;
      --text-primary: #fafafa;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --border: #27272a;
      --accent: #3b82f6;
      --accent-border: rgba(59, 130, 246, 0.35);
      --pk-bg: rgba(245, 158, 11, 0.14);
      --pk-text: #fbbf24;
      --pk-border: rgba(245, 158, 11, 0.35);
      --fk-bg: rgba(59, 130, 246, 0.14);
      --fk-text: #60a5fa;
      --fk-border: rgba(59, 130, 246, 0.35);
      --uq-bg: rgba(139, 92, 246, 0.15);
      --uq-text: #c4b5fd;
      --uq-border: rgba(139, 92, 246, 0.35);
      --nn-bg: #27272a;
      --nn-text: #d4d4d8;
      --ok-bg: rgba(16, 185, 129, 0.14);
      --ok-text: #34d399;
      --ok-border: rgba(16, 185, 129, 0.35);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg-app);
      color: var(--text-primary);
      font-size: 13px;
      line-height: 1.45;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .topbar {
      height: 54px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .brand-group { display: flex; align-items: center; gap: 10px; }
    .brand-logo {
      width: 28px; height: 28px; border-radius: 6px;
      background: #09090b; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 12px;
    }
    .conn-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px; border-radius: 999px;
      background: var(--bg-subtle); border: 1px solid var(--border);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11.5px; color: var(--text-secondary);
    }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #10b981; }
    .btn {
      height: 30px; padding: 0 10px; border-radius: 6px;
      font-size: 12px; font-weight: 500;
      border: 1px solid var(--border); background: var(--bg-surface);
      color: var(--text-primary); cursor: pointer;
    }
    .workspace { display: grid; grid-template-columns: 270px 1fr; flex: 1; }
    .sidebar {
      background: var(--bg-surface);
      border-right: 1px solid var(--border);
      padding: 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .search-box input {
      width: 100%; height: 32px; padding: 0 10px;
      border-radius: 6px; border: 1px solid var(--border);
      background: var(--bg-subtle); color: var(--text-primary);
    }
    .schema-pills { display: flex; gap: 5px; flex-wrap: wrap; }
    .schema-pill {
      padding: 3px 8px; border-radius: 999px; font-size: 11px;
      border: 1px solid var(--border); background: var(--bg-surface);
      color: var(--text-secondary); cursor: pointer;
    }
    .schema-pill.active { background: #09090b; color: #fff; border-color: #09090b; }
    .table-nav-list { display: flex; flex-direction: column; gap: 2px; }
    .table-nav-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 8px; border-radius: 6px; text-decoration: none;
      color: var(--text-primary);
    }
    .table-nav-item:hover { background: var(--bg-subtle); }
    .schema-tag { font-family: monospace; font-size: 11px; color: var(--text-muted); }
    .table-meta-count {
      font-family: monospace; font-size: 10.5px; color: var(--text-muted);
      background: var(--bg-subtle); padding: 1px 6px; border-radius: 4px;
      border: 1px solid var(--border);
    }
    .main-area { padding: 18px 24px; display: flex; flex-direction: column; gap: 16px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .kpi-card {
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 12px 14px;
    }
    .kpi-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
    .kpi-value { font-size: 20px; font-weight: 700; margin-top: 2px; }
    .card {
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: 8px; overflow: hidden;
    }
    .card-header {
      padding: 12px 16px; border-bottom: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
    }
    .table-full-name { font-family: monospace; font-size: 15px; font-weight: 600; }
    .table-desc { font-size: 12px; color: var(--text-secondary); margin-top: 3px; }
    table.schema-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
    table.schema-table th {
      padding: 8px 12px; font-size: 10.5px; text-transform: uppercase;
      color: var(--text-muted); background: var(--bg-subtle);
      border-bottom: 1px solid var(--border);
    }
    table.schema-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
    .col-name { font-family: monospace; font-weight: 600; }
    .type-pill {
      font-family: monospace; font-size: 11px; padding: 2px 6px;
      border-radius: 4px; background: var(--bg-subtle); border: 1px solid var(--border);
    }
    .badge-group { display: flex; gap: 4px; flex-wrap: wrap; }
    .key-badge {
      font-family: monospace; font-size: 10.5px; font-weight: 600;
      padding: 1.5px 6px; border-radius: 4px;
    }
    .key-pk { background: var(--pk-bg); color: var(--pk-text); border: 1px solid var(--pk-border); }
    .key-fk { background: var(--fk-bg); color: var(--fk-text); border: 1px solid var(--fk-border); }
    .key-uq { background: var(--uq-bg); color: var(--uq-text); border: 1px solid var(--uq-border); }
    .key-nn { background: var(--nn-bg); color: var(--nn-text); }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand-group">
      <div class="brand-logo">SL</div>
      <strong>SchemaLens</strong>
      <span class="conn-pill"><span class="status-dot"></span>${escapeHtml(model.name)} · SQL Server</span>
    </div>
    <div>
      <button type="button" class="btn" onclick="document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'">Light / Dark</button>
    </div>
  </header>
  <div class="workspace">
    <aside class="sidebar">
      <div class="search-box">
        <input type="text" id="table-search" placeholder="Filter tables..." oninput="filterTables()" />
      </div>
      <div class="schema-pills">
        ${schemaPills}
      </div>
      <div class="table-nav-list" id="table-nav">
        ${navItems}
      </div>
    </aside>
    <main class="main-area">
      <section class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Tables</div><div class="kpi-value">${model.tables.length} Tables</div></div>
        <div class="kpi-card"><div class="kpi-label">Columns</div><div class="kpi-value">${totalColumns} Columns</div></div>
        <div class="kpi-card"><div class="kpi-label">Keys</div><div class="kpi-value">${totalPks} PK · ${totalFks} FK</div></div>
        <div class="kpi-card"><div class="kpi-label">MS_Description</div><div class="kpi-value">${docPct}% Documented</div></div>
      </section>
      ${tableCards}
    </main>
  </div>
  <script>
    let currentSchema = 'all';
    function filterSchema(schema, btn) {
      currentSchema = schema;
      document.querySelectorAll('.schema-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterTables();
    }
    function filterTables() {
      const q = document.getElementById('table-search').value.toLowerCase();
      document.querySelectorAll('.table-card, #table-nav .table-nav-item').forEach(el => {
        const s = el.dataset.schema;
        const n = el.dataset.name.toLowerCase();
        const show = (currentSchema === 'all' || s === currentSchema) && (!q || n.includes(q) || s.toLowerCase().includes(q));
        el.style.display = show ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;
}

function renderTableCard(table: TableModel): string {
  const rows = table.columns
    .map((col) => {
      const badges: string[] = [];
      if (col.isPrimaryKey) badges.push('<span class="key-badge key-pk">PK</span>');
      if (col.isIdentity) badges.push('<span class="key-badge key-uq">IDENTITY</span>');
      if (col.isComputed) badges.push('<span class="key-badge key-uq">COMPUTED</span>');
      if (col.foreignKey) {
        badges.push(
          `<span class="key-badge key-fk">FK → ${escapeHtml(col.foreignKey.referencedSchema)}.${escapeHtml(col.foreignKey.referencedTable)}.${escapeHtml(col.foreignKey.referencedColumn)}</span>`,
        );
      }
      badges.push(
        col.nullable
          ? '<span class="key-badge">NULL</span>'
          : '<span class="key-badge key-nn">NOT NULL</span>',
      );

      return `            <tr>
              <td>${col.ordinal}</td>
              <td class="col-name">${escapeHtml(col.name)}</td>
              <td><span class="type-pill">${escapeHtml(col.dataType)}</span></td>
              <td><div class="badge-group">${badges.join('')}</div></td>
              <td><code>${escapeHtml(col.defaultValue ?? '—')}</code></td>
              <td>${escapeHtml(col.description ?? '')}</td>
            </tr>`;
    })
    .join('\n');

  return `      <section class="card table-card" id="table-${escapeHtml(table.schema)}-${escapeHtml(table.name)}" data-schema="${escapeHtml(table.schema)}" data-name="${escapeHtml(table.name)}">
        <div class="card-header">
          <div>
            <div class="table-full-name">${escapeHtml(table.schema)}.${escapeHtml(table.name)}</div>
            ${table.description ? `<p class="table-desc">${escapeHtml(table.description)}</p>` : ''}
          </div>
          <span class="type-pill">${table.columns.length} Columns</span>
        </div>
        <table class="schema-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Column</th>
              <th>Data Type</th>
              <th>Keys &amp; Constraints</th>
              <th>Default</th>
              <th>MS_Description</th>
            </tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </section>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
