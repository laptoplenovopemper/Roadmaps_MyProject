// Data default jika LocalStorage kosong
const defaultData = {
  projectName: "PROYEK SAINS DR. STONE",
  nodes: [
    { id: "start", title: "MULAI", desc: "Titik awal penemuan sains", icon: "fa-play", status: "completed", x: 60, y: 300, parents: [] },
    { id: "iron", title: "Biji Besi", desc: "Mengumpulkan pasir besi di sungai", icon: "fa-gem", status: "completed", x: 250, y: 180, parents: ["start"] },
    { id: "charcoal", title: "Arang", desc: "Membakar kayu di dalam tungku", icon: "fa-fire", status: "completed", x: 250, y: 420, parents: ["start"] },
    { id: "furnace", title: "Tungku Tinggi", desc: "Tungku pembakaran suhu tinggi", icon: "fa-dumpster-fire", status: "in-progress", x: 450, y: 300, parents: ["iron", "charcoal"] },
    { id: "steel", title: "Baja Industri", desc: "Besi murni yang diperkuat karbon", icon: "fa-shield-halved", status: "locked", x: 650, y: 300, parents: ["furnace"] },
    { id: "goal", title: "GOAL: MOBIL SAINS", desc: "Kendaraan tempur kerajaan sains", icon: "fa-car-side", status: "locked", x: 860, y: 300, parents: ["steel"] }
  ]
};

// Application State
let appData = loadData();
let activeNodeId = null;

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderBoard();
  setupEventListeners();
});

function loadData() {
  const saved = localStorage.getItem('drstone_roadmap_simple');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { console.error(e); }
  }
  return JSON.parse(JSON.stringify(defaultData));
}

function saveData() {
  localStorage.setItem('drstone_roadmap_simple', JSON.stringify(appData));
  renderHeader();
  renderBoard();
}

function renderHeader() {
  document.getElementById('project-title').textContent = appData.projectName;
  const total = appData.nodes.length;
  const completed = appData.nodes.filter(n => n.status === 'completed').length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  
  document.getElementById('stat-acquired').textContent = completed;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-progress').textContent = `${percent}%`;
  document.getElementById('progress-bar').style.width = `${percent}%`;
}

function renderBoard() {
  const canvas = document.getElementById('map-canvas');
  const svg = document.getElementById('connections-layer');
  
  // Clean canvas (keep SVG layer)
  canvas.querySelectorAll('.craft-node').forEach(n => n.remove());
  svg.innerHTML = '';

  const nodeMap = {};
  appData.nodes.forEach(node => { nodeMap[node.id] = node; });

  // 1. Render Connections (Lines)
  appData.nodes.forEach(node => {
    if (node.parents && node.parents.length > 0) {
      node.parents.forEach(parentId => {
        const parent = nodeMap[parentId];
        if (parent) {
          drawLine(svg, parent, node);
        }
      });
    }
  });

  // 2. Render Nodes
  appData.nodes.forEach(node => {
    const el = createNodeElement(node);
    canvas.appendChild(el);
  });
}

function drawLine(svg, source, target) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  
  // Calculate center of nodes (width: 176px / height: ~120px)
  const x1 = source.x + 88;
  const y1 = source.y + 60;
  const x2 = target.x + 88;
  const y2 = target.y + 60;
  
  // Curved Bezier Path
  const dx = Math.abs(x2 - x1) * 0.5;
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  
  // Line styling based on target status
  if (target.status === 'completed') {
    path.setAttribute("stroke", "#10b981");
    path.setAttribute("stroke-width", "3");
  } else if (target.status === 'in-progress') {
    path.setAttribute("stroke", "#f59e0b");
    path.setAttribute("stroke-width", "3");
  } else {
    path.setAttribute("stroke", "#475569");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-dasharray", "4");
  }
  
  svg.appendChild(path);
}

function createNodeElement(node) {
  const div = document.createElement('div');
  div.className = `craft-node absolute w-44 bg-slate-900 border-2 rounded-xl p-3 cursor-pointer shadow-md select-none ${getStatusBorderClass(node.status)}`;
  div.style.left = `${node.x}px`;
  div.style.top = `${node.y}px`;
  
  const statusBadge = getStatusBadgeHTML(node.status);
  
  div.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <span class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
        <i class="fa-solid ${node.icon}"></i>
      </span>
      ${statusBadge}
    </div>
    <h4 class="font-bold text-sm text-slate-100 truncate mb-1">${node.title}</h4>
    <p class="text-xs text-slate-400 line-clamp-2">${node.desc || 'Tidak ada keterangan'}</p>
  `;
  
  div.addEventListener('click', () => openNodeModal(node.id));
  return div;
}

function getStatusBorderClass(status) {
  if (status === 'completed') return 'border-emerald-500 bg-emerald-950/20';
  if (status === 'in-progress') return 'border-amber-500 bg-amber-950/20';
  return 'border-slate-700 opacity-80';
}

function getStatusBadgeHTML(status) {
  if (status === 'completed') {
    return `<span class="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded">DONE</span>`;
  }
  if (status === 'in-progress') {
    return `<span class="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded">PROSES</span>`;
  }
  return `<span class="px-1.5 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 rounded">LOCKED</span>`;
}

// Modal Handlers
function openNodeModal(id = null) {
  activeNodeId = id;
  const modal = document.getElementById('node-modal');
  const titleEl = document.getElementById('modal-title');
  const btnDelete = document.getElementById('btn-delete-node');
  
  // Populate Parent Selection Options
  const parentSelect = document.getElementById('node-parents');
  parentSelect.innerHTML = '';
  
  appData.nodes.forEach(n => {
    if (n.id !== id) {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = n.title;
      parentSelect.appendChild(opt);
    }
  });

  if (id) {
    // Edit Existing Node
    titleEl.textContent = 'Edit Milestone / Penemuan';
    btnDelete.classList.remove('hidden');
    const node = appData.nodes.find(n => n.id === id);
    if (node) {
      document.getElementById('node-title').value = node.title;
      document.getElementById('node-desc').value = node.desc || '';
      document.getElementById('node-icon').value = node.icon;
      document.getElementById('node-status').value = node.status;
      document.getElementById('node-pos-x').value = node.x;
      document.getElementById('node-pos-y').value = node.y;
      
      Array.from(parentSelect.options).forEach(opt => {
        opt.selected = (node.parents || []).includes(opt.value);
      });
    }
  } else {
    // Add New Node
    titleEl.textContent = 'Tambah Milestone Baru';
    btnDelete.classList.add('hidden');
    document.getElementById('node-title').value = '';
    document.getElementById('node-desc').value = '';
    document.getElementById('node-icon').value = 'fa-flask';
    document.getElementById('node-status').value = 'locked';
    document.getElementById('node-pos-x').value = 350;
    document.getElementById('node-pos-y').value = 300;
  }
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeNodeModal() {
  const modal = document.getElementById('node-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  activeNodeId = null;
}

function setupEventListeners() {
  // Modal Buttons
  document.getElementById('btn-add-node').addEventListener('click', () => openNodeModal());
  document.getElementById('btn-close-modal').addEventListener('click', closeNodeModal);
  
  // Form Submit
  document.getElementById('node-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const selectedParents = Array.from(document.getElementById('node-parents').selectedOptions).map(o => o.value);
    const formData = {
      title: document.getElementById('node-title').value.trim(),
      desc: document.getElementById('node-desc').value.trim(),
      icon: document.getElementById('node-icon').value,
      status: document.getElementById('node-status').value,
      x: parseInt(document.getElementById('node-pos-x').value) || 100,
      y: parseInt(document.getElementById('node-pos-y').value) || 100,
      parents: selectedParents
    };

    if (activeNodeId) {
      // Update
      const index = appData.nodes.findIndex(n => n.id === activeNodeId);
      if (index !== -1) {
        appData.nodes[index] = { ...appData.nodes[index], ...formData };
      }
    } else {
      // Create New
      const newId = 'node_' + Date.now();
      appData.nodes.push({ id: newId, ...formData });
    }
    
    saveData();
    closeNodeModal();
  });

  // Delete Node
  document.getElementById('btn-delete-node').addEventListener('click', () => {
    if (activeNodeId && confirm('Hapus item penemuan ini?')) {
      appData.nodes = appData.nodes.filter(n => n.id !== activeNodeId);
      // Remove references from parents
      appData.nodes.forEach(n => {
        if (n.parents) {
          n.parents = n.parents.filter(pId => pId !== activeNodeId);
        }
      });
      saveData();
      closeNodeModal();
    }
  });

  // Edit Project Title
  document.getElementById('btn-edit-project').addEventListener('click', () => {
    const newName = prompt('Masukkan Nama Project Roadmap:', appData.projectName);
    if (newName && newName.trim() !== '') {
      appData.projectName = newName.trim();
      saveData();
    }
  });

  // Export Data JSON
  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadmap_${appData.projectName.toLowerCase().replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Reset Data
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Kembalikan peta ke data awal? Perubahan Anda akan hilang.')) {
      appData = JSON.parse(JSON.stringify(defaultData));
      saveData();
    }
  });
}
