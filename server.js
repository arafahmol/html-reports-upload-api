const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const REPORTS_DIR = process.env.REPORTS_DIR || '/data/reports';
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.originalname.endsWith('.html')) {
      return cb(new Error('Only .html files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ── Helpers ──────────────────────────────────────────

function sanitizePath(p) {
  return p.replace(/[^a-zA-Z0-9\-_\/\.]/g, '_').replace(/\.\.+/g, '_');
}

function scanDir(dir) {
  const result = { files: [], folders: [] };
  if (!fs.existsSync(dir)) return result;
  fs.readdirSync(dir).forEach(item => {
    if (item === 'index.html') return;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      result.folders.push({ name: item, modified: stat.mtime });
    } else if (item.endsWith('.html')) {
      result.files.push({ name: item, size: stat.size, modified: stat.mtime });
    }
  });
  result.folders.sort((a, b) => a.name.localeCompare(b.name));
  result.files.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

function buildBreadcrumb(relPath) {
  const parts = relPath ? relPath.split('/').filter(Boolean) : [];
  let crumbs = [{ name: 'Reports Portal', url: '/reports/' }];
  let cumPath = '/reports/';
  parts.forEach(part => {
    cumPath += part + '/';
    crumbs.push({ name: part, url: cumPath });
  });
  return crumbs;
}

function generateFolderPage(relPath, dirPath) {
  const { files, folders } = scanDir(dirPath);
  const crumbs = buildBreadcrumb(relPath);
  const folderName = relPath ? relPath.split('/').filter(Boolean).pop() : 'Reports Portal';
  const apiRelPath = relPath || '';

  const breadcrumbHTML = crumbs.map((c, i) =>
    i < crumbs.length - 1
      ? `<a href="${c.url}">${c.name}</a>`
      : `<span>${c.name}</span>`
  ).join(' / ');

  const foldersHTML = folders.map(f => {
    const folderUrl = `/reports/${relPath ? relPath + '/' : ''}${f.name}/`;
    const modified = new Date(f.modified).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return `
      <a href="${folderUrl}" class="folder-card">
        <div class="card-icon folder-icon">&#128193;</div>
        <div class="card-info">
          <div class="card-name">${f.name}</div>
          <div class="card-meta">Folder · ${modified}</div>
        </div>
      </a>`;
  }).join('');

  const filesHTML = files.map(f => {
    const fileUrl = `/reports/${relPath ? relPath + '/' : ''}${f.name}`;
    const modified = new Date(f.modified).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return `
      <a href="${fileUrl}" class="file-card">
        <div class="card-icon file-icon">&#128196;</div>
        <div class="card-info">
          <div class="card-name">${f.name}</div>
          <div class="card-meta">${modified} · ${(f.size/1024).toFixed(1)} KB</div>
        </div>
      </a>`;
  }).join('');

  const emptyMsg = folders.length === 0 && files.length === 0
    ? '<p class="empty">This folder is empty. Create a subfolder or upload a report to get started.</p>'
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <title>${folderName} — Reports Portal</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; max-width: 960px; margin: 40px auto; padding: 0 20px; color: #333; }
    .breadcrumb { font-size: 13px; color: #999; margin-bottom: 16px; }
    .breadcrumb a { color: #0066cc; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .breadcrumb span { color: #333; }
    .header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0066cc; padding-bottom: 10px; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
    h1 { color: #0066cc; margin: 0; font-size: 26px; }
    .btn-group { display: flex; gap: 8px; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: #0066cc; color: white; }
    .btn-primary:hover { background: #0052a3; }
    .btn-success { background: #28a745; color: white; }
    .btn-success:hover { background: #1e7e34; }
    .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin: 20px 0 10px; font-weight: 600; }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .folder-card, .file-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid #e0e0e0; border-radius: 8px; text-decoration: none; color: inherit; transition: border-color 0.15s, box-shadow 0.15s; }
    .folder-card:hover { border-color: #0066cc; box-shadow: 0 2px 6px rgba(0,102,204,0.12); }
    .file-card:hover { border-color: #28a745; box-shadow: 0 2px 6px rgba(40,167,69,0.12); }
    .card-icon { font-size: 28px; flex-shrink: 0; }
    .card-name { font-weight: 600; font-size: 14px; color: #0066cc; word-break: break-word; }
    .file-card .card-name { color: #28a745; }
    .card-meta { font-size: 11px; color: #999; margin-top: 2px; }
    .empty { color: #999; font-style: italic; padding: 20px 0; }
    .panel { display: none; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .panel.open { display: block; }
    .panel h3 { margin: 0 0 14px; font-size: 15px; color: #333; }
    .form-row { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
    .form-row label { font-size: 13px; color: #555; min-width: 70px; }
    .form-row input { flex: 1; padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; min-width: 200px; }
    .drop-zone { border: 2px dashed #99c2ff; border-radius: 6px; padding: 24px; text-align: center; cursor: pointer; margin-bottom: 12px; transition: all 0.15s; }
    .drop-zone:hover, .drop-zone.dragover { border-color: #0066cc; background: #e8f0fe; }
    .drop-zone input { display: none; }
    .drop-icon { font-size: 28px; margin-bottom: 6px; }
    .drop-hint { font-size: 12px; color: #999; margin-top: 4px; }
    .action-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .btn-cancel { background: none; border: 1px solid #ccc; padding: 7px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; color: #555; }
    .status { font-size: 13px; }
    .status.success { color: #28a745; }
    .status.error { color: #dc3545; }
  </style>
</head>
<body>
  <div class="breadcrumb">${breadcrumbHTML}</div>

  <div class="header-row">
    <h1>${folderName.charAt(0).toUpperCase() + folderName.slice(1)}</h1>
    <div class="btn-group">
      <button class="btn btn-primary" onclick="togglePanel('folderPanel')">+ New Folder</button>
      <button class="btn btn-success" onclick="togglePanel('uploadPanel')">+ Upload Report</button>
    </div>
  </div>

  <!-- Create Folder Panel -->
  <div class="panel" id="folderPanel">
    <h3>Create new folder inside ${folderName}</h3>
    <div class="form-row">
      <label>Name:</label>
      <input type="text" id="folderName" placeholder="e.g. 2026 or europe" onkeydown="if(event.key==='Enter') createFolder()">
    </div>
    <div class="action-row">
      <button class="btn btn-primary" onclick="createFolder()">Create Folder</button>
      <button class="btn-cancel" onclick="togglePanel('folderPanel')">Cancel</button>
      <span class="status" id="folderStatus"></span>
    </div>
  </div>

  <!-- Upload Report Panel -->
  <div class="panel" id="uploadPanel">
    <h3>Upload HTML report to ${folderName}</h3>
    <div class="drop-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
      <input type="file" id="fileInput" accept=".html" onchange="fileSelected(this)">
      <div class="drop-icon">&#128196;</div>
      <div id="dropText">Click to browse or drag & drop an HTML file</div>
      <div class="drop-hint">Only .html files · Max 10MB</div>
    </div>
    <div class="form-row">
      <label>Save as:</label>
      <input type="text" id="filenameInput" placeholder="report-name.html">
    </div>
    <div class="action-row">
      <button class="btn btn-success" id="submitBtn" onclick="doUpload()" disabled>Upload</button>
      <button class="btn-cancel" onclick="togglePanel('uploadPanel')">Cancel</button>
      <span class="status" id="uploadStatus"></span>
    </div>
  </div>

  ${folders.length > 0 ? `<div class="section-title">Folders (${folders.length})</div><div class="card-grid">${foldersHTML}</div>` : ''}
  ${files.length > 0 ? `<div class="section-title">Reports (${files.length})</div><div class="card-grid">${filesHTML}</div>` : ''}
  ${emptyMsg}

  <script>
    const CURRENT_PATH = '${apiRelPath}';

    function togglePanel(id) {
      document.querySelectorAll('.panel').forEach(p => {
        if (p.id !== id) p.classList.remove('open');
      });
      document.getElementById(id).classList.toggle('open');
    }

    async function createFolder() {
      const name = document.getElementById('folderName').value.trim();
      const status = document.getElementById('folderStatus');
      if (!name) { status.textContent = 'Please enter a folder name'; status.className = 'status error'; return; }
      status.textContent = 'Creating...'; status.className = 'status';
      try {
        const res = await fetch('/api/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: CURRENT_PATH ? CURRENT_PATH + '/' + name : name })
        });
        const data = await res.json();
        if (res.ok) {
          status.textContent = 'Created!'; status.className = 'status success';
          setTimeout(() => window.location.reload(), 800);
        } else throw new Error(data.error || 'Failed');
      } catch(e) { status.textContent = 'Error: ' + e.message; status.className = 'status error'; }
    }

    let selectedFile = null;
    function fileSelected(input) {
      selectedFile = input.files[0];
      if (selectedFile) {
        document.getElementById('dropText').textContent = selectedFile.name;
        if (!document.getElementById('filenameInput').value) {
          document.getElementById('filenameInput').value = selectedFile.name;
        }
        document.getElementById('submitBtn').disabled = false;
      }
    }

    async function doUpload() {
      if (!selectedFile) return;
      const filename = document.getElementById('filenameInput').value.trim() || selectedFile.name;
      const btn = document.getElementById('submitBtn');
      const status = document.getElementById('uploadStatus');
      btn.disabled = true; btn.textContent = 'Uploading...';
      const formData = new FormData();
      formData.append('folder', CURRENT_PATH || 'general');
      formData.append('filename', filename);
      formData.append('report', selectedFile);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
          status.textContent = 'Uploaded!'; status.className = 'status success';
          setTimeout(() => window.location.reload(), 800);
        } else throw new Error(data.error || 'Upload failed');
      } catch(e) {
        status.textContent = 'Error: ' + e.message; status.className = 'status error';
        btn.disabled = false; btn.textContent = 'Upload';
      }
    }

    const dz = document.getElementById('dropZone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.html')) {
        document.getElementById('fileInput').files = e.dataTransfer.files;
        fileSelected(document.getElementById('fileInput'));
      } else alert('Only .html files are allowed');
    });
  </script>
</body>
</html>`;
}

function generateMainIndex() {
  if (!fs.existsSync(REPORTS_DIR)) return;
  const { folders } = scanDir(REPORTS_DIR);

  const folderCards = folders.map(f => {
    const { files, folders: subFolders } = scanDir(path.join(REPORTS_DIR, f.name));
    const count = files.length;
    const subCount = subFolders.length;
    const modified = new Date(f.modified).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return `
      <a href="/reports/${f.name}/" class="folder-card">
        <div class="card-icon">&#128193;</div>
        <div class="card-info">
          <div class="folder-name">${f.name.charAt(0).toUpperCase() + f.name.slice(1)}</div>
          <div class="folder-meta">${subCount > 0 ? subCount + ' subfolders · ' : ''}${count} report${count !== 1 ? 's' : ''} · ${modified}</div>
        </div>
      </a>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Reports Portal</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; max-width: 960px; margin: 40px auto; padding: 0 20px; color: #333; }
    h1 { color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
    .stats { font-size: 14px; color: #999; margin-bottom: 24px; }
    .folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
    .folder-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border: 1px solid #e0e0e0; border-radius: 8px; text-decoration: none; color: inherit; transition: border-color 0.15s, box-shadow 0.15s; }
    .folder-card:hover { border-color: #0066cc; box-shadow: 0 2px 8px rgba(0,102,204,0.1); }
    .card-icon { font-size: 32px; }
    .folder-name { font-weight: 600; color: #0066cc; font-size: 15px; }
    .folder-meta { font-size: 12px; color: #999; margin-top: 3px; }
    .empty { color: #999; font-style: italic; }
    .updated { font-size: 12px; color: #bbb; margin-top: 40px; }
  </style>
</head>
<body>
  <h1>Reports Portal</h1>
  <div class="stats">${folders.length} folder${folders.length !== 1 ? 's' : ''}</div>
  <div class="folder-grid">
    ${folderCards || '<p class="empty">No folders yet.</p>'}
  </div>
  <p class="updated">Last updated: ${new Date().toLocaleString('en-GB')}</p>
</body>
</html>`;

  fs.writeFileSync(path.join(REPORTS_DIR, 'index.html'), html);
}

function regenerateAll(dirPath, relPath) {
  if (!fs.existsSync(dirPath)) return;
  fs.writeFileSync(path.join(dirPath, 'index.html'), generateFolderPage(relPath, dirPath));
  fs.readdirSync(dirPath).forEach(item => {
    const full = path.join(dirPath, item);
    if (fs.statSync(full).isDirectory()) {
      regenerateAll(full, relPath ? relPath + '/' + item : item);
    }
  });
  generateMainIndex();
}

// ── Health ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', reportsDir: REPORTS_DIR });
});

// ── Create folder ─────────────────────────────────────
app.post('/folders', (req, res) => {
  const { path: folderPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: 'path is required' });
  const safe = sanitizePath(folderPath);
  const full = path.join(REPORTS_DIR, safe);
  if (fs.existsSync(full)) return res.status(409).json({ error: 'Folder already exists' });
  fs.mkdirSync(full, { recursive: true });
  regenerateAll(REPORTS_DIR, '');
  res.status(201).json({
    message: 'Folder created',
    path: safe,
    url: `${BASE_URL}/reports/${safe}/`
  });
});

// ── Upload report ─────────────────────────────────────
app.post('/upload', upload.single('report'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Use field name: report' });
  const folder = sanitizePath(req.body.folder || 'general');
  const filename = (req.body.filename || req.file.originalname).replace(/[^a-zA-Z0-9\-_\.]/g, '_');
  const uploadPath = path.join(REPORTS_DIR, folder);
  fs.mkdirSync(uploadPath, { recursive: true });
  fs.writeFileSync(path.join(uploadPath, filename), req.file.buffer);
  regenerateAll(REPORTS_DIR, '');
  res.status(201).json({
    message: 'Report uploaded successfully',
    filename, folder,
    url: `${BASE_URL}/reports/${folder}/${filename}`,
    size: req.file.size,
    uploadedAt: new Date().toISOString()
  });
});

// ── List all reports ──────────────────────────────────
app.get('/files', (req, res) => {
  const reports = [];
  const walk = (dir, base) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(item => {
      const full = path.join(dir, item);
      const rel = base ? base + '/' + item : item;
      if (fs.statSync(full).isDirectory()) {
        walk(full, rel);
      } else if (item.endsWith('.html') && item !== 'index.html') {
        reports.push({
          path: rel,
          url: `${BASE_URL}/reports/${rel}`,
          size: fs.statSync(full).size,
          modified: fs.statSync(full).mtime
        });
      }
    });
  };
  walk(REPORTS_DIR, '');
  res.json({ total: reports.length, reports });
});

// ── Delete report ─────────────────────────────────────
app.delete('/files/*', (req, res) => {
  const relPath = req.params[0];
  const filePath = path.join(REPORTS_DIR, sanitizePath(relPath));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  fs.unlinkSync(filePath);
  regenerateAll(REPORTS_DIR, '');
  res.json({ message: 'Report deleted', path: relPath });
});

// ── Delete folder ─────────────────────────────────────
app.delete('/folders/*', (req, res) => {
  const relPath = req.params[0];
  const folderPath = path.join(REPORTS_DIR, sanitizePath(relPath));
  if (!fs.existsSync(folderPath)) return res.status(404).json({ error: 'Folder not found' });
  fs.rmSync(folderPath, { recursive: true });
  regenerateAll(REPORTS_DIR, '');
  res.json({ message: 'Folder deleted', path: relPath });
});

// ── Regenerate index ──────────────────────────────────
app.post('/regenerate-index', (req, res) => {
  regenerateAll(REPORTS_DIR, '');
  res.json({ message: 'All indexes regenerated' });
});

// ── Welcome ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'HTML Reports Upload API',
    version: '4.0.0',
    endpoints: {
      'POST /folders':          'Create folder at any path',
      'POST /upload':           'Upload HTML report',
      'GET  /files':            'List all reports',
      'DELETE /files/*':        'Delete a report',
      'DELETE /folders/*':      'Delete a folder',
      'POST /regenerate-index': 'Regenerate all indexes',
      'GET  /health':           'Health check'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Upload API v4.0.0 running on port ${PORT}`);
  regenerateAll(REPORTS_DIR, '');
});
