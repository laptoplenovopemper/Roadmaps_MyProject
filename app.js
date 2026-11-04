// Data default
const defaultData = {
  projectName: "PROYEK SAINS DR. STONE",
  nodes: [
    { id: "start", title: "MULAI", desc: "Titik awal penemuan sains", icon: "fa-play", status: "completed", x: 100, y: 300, parents: [] },
    { id: "iron", title: "Biji Besi", desc: "Mengumpulkan pasir besi di sungai", icon: "fa-gem", status: "completed", x: 350, y: 180, parents: ["start"] },
    { id: "charcoal", title: "Arang", desc: "Membakar kayu di dalam tungku", icon: "fa-fire", status: "completed", x: 350, y: 420, parents: ["start"] },
    { id: "furnace", title: "Tungku Tinggi", desc: "Tungku pembakaran suhu tinggi", icon: "fa-dumpster-fire", status: "in-progress", x: 600, y: 300, parents: ["iron", "charcoal"] },
    { id: "steel", title: "Baja Industri", desc: "Besi murni yang diperkuat karbon", icon: "fa-shield-halved", status: "locked", x: 850, y: 300, parents: ["furnace"] },
    { id: "goal", title: "GOAL: MOBIL SAINS", desc: "Kendaraan tempur kerajaan sains", icon: "fa-car-side", status: "locked", x: 1100, y: 300, parents: ["steel"] }
  ]
};

// Application State
let appData = loadData();
let activeNodeId = null;

// Pan Canvas State
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

// Drag Node State
let isDraggingNode = false;
let draggedNodeId = null;
let dragStartX = 0;
let dragStartY = 0;
let initialNodeX = 0;
let initialNodeY = 0;

// Custom Confirm Callback
let onConfirmAction = null;

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderBoard();
  setupEventListeners();
  setupPanAndDrag();
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
  
  // Apply canvas pan transformation
  canvas.style.transform = `translate(${panX}px, ${panY}px)`;
  
  // Clean existing nodes & lines
  canvas.querySelectorAll('.craft-node').forEach(n => n.remove());
  svg.innerHTML = '';

  const nodeMap = {};
  appData.nodes.forEach(node => { nodeMap[node.id] = node; });

  // 1. Draw Connection Lines
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
  
  const x1 = source.x + 88;
  const y1 = source.y + 55;
  const x2 = target.x + 88;
  const y2 = target.y + 55;
  
  const dx = Math.abs(x2 - x1) * 0.5;
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  
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
  div.className = `craft-node absolute w-44 bg-slate-900 border-2 rounded-xl p-3 cursor-grab select-none z-10 ${getStatusBorderClass(node.status)}`;
  div.style.left = `${node.x}px`;
  div.style.top = `${node.y}px`;
  div.dataset.id = node.id;
  
  const statusBadge = getStatusBadgeHTML(node.status);
  
  div.innerHTML = `
    <div class="flex items-center justify-between mb-2 pointer-events-none">
      <span class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
        <i class="fa-solid ${node.icon}"></i>
      </span>
      ${statusBadge}
    </div>
    <h4 class="font-bold text-sm text-slate-100 truncate mb-1 pointer-events-none">${node.title}</h4>
    <p class="text-xs text-slate-400 line-clamp-2 pointer-events-none">${node.desc || 'Tidak ada keterangan'}</p>
  `;
  
  return div;
}

function getStatusBorderClass(status) {
  if (status === 'completed') return 'border-emerald-500 bg-emerald-950/20';
  if (status === 'in-progress') return 'border-amber-500 bg-amber-950/20';
  return 'border-slate-700 opacity-90';
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

/* -------------------------------------------------------------
   PAN & DRAG HANDLERS
------------------------------------------------------------- */
function setupPanAndDrag() {
  const viewport = document.getElementById('map-viewport');

  viewport.addEventListener('mousedown', (e) => {
    const nodeEl = e.target.closest('.craft-node');
    
    if (nodeEl) {
      isDraggingNode = true;
      draggedNodeId = nodeEl.dataset.id;
      nodeEl.classList.add('is-dragging');
      
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      
      const nodeData = appData.nodes.find(n => n.id === draggedNodeId);
      if (nodeData) {
        initialNodeX = nodeData.x;
        initialNodeY = nodeData.y;
      }
    } else {
      isPanning = true;
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingNode && draggedNodeId) {
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      
      const nodeData = appData.nodes.find(n => n.id === draggedNodeId);
      if (nodeData) {
        nodeData.x = Math.max(0, initialNodeX + deltaX);
        nodeData.y = Math.max(0, initialNodeY + deltaY);
        
        const nodeEl = document.querySelector(`.craft-node[data-id="${draggedNodeId}"]`);
        if (nodeEl) {
          nodeEl.style.left = `${nodeData.x}px`;
          nodeEl.style.top = `${nodeData.y}px`;
        }
        updateConnectionsOnly();
      }
    } else if (isPanning) {
      panX = e.clientX - startPanX;
      panY = e.clientY - startPanY;
      const canvas = document.getElementById('map-canvas');
      canvas.style.transform = `translate(${panX}px, ${panY}px)`;
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (isDraggingNode) {
      const deltaX = Math.abs(e.clientX - dragStartX);
      const deltaY = Math.abs(e.clientY - dragStartY);
      
      if (deltaX < 4 && deltaY < 4 && draggedNodeId) {
        openNodeModal(draggedNodeId);
      } else {
        saveData();
      }
      
      const nodeEl = document.querySelector(`.craft-node[data-id="${draggedNodeId}"]`);
      if (nodeEl) nodeEl.classList.remove('is-dragging');
      
      isDraggingNode = false;
      draggedNodeId = null;
    }

    if (isPanning) {
      isPanning = false;
    }
  });
}

function updateConnectionsOnly() {
  const svg = document.getElementById('connections-layer');
  svg.innerHTML = '';
  
  const nodeMap = {};
  appData.nodes.forEach(node => { nodeMap[node.id] = node; });

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
}

/* -------------------------------------------------------------
   MODAL HANDLERS (UNIFIED CUSTOM MODALS)
------------------------------------------------------------- */
// Node Modal
function openNodeModal(id = null) {
  activeNodeId = id;
  const modal = document.getElementById('node-modal');
  const titleEl = document.getElementById('modal-title');
  const btnDelete = document.getElementById('btn-delete-node');
  
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
    titleEl.textContent = 'Edit Milestone / Penemuan';
    btnDelete.classList.remove('hidden');
    const node = appData.nodes.find(n => n.id === id);
    if (node) {
      document.getElementById('node-title').value = node.title;
      document.getElementById('node-desc').value = node.desc || '';
      document.getElementById('node-icon').value = node.icon;
      document.getElementById('node-status').value = node.status;
      
      Array.from(parentSelect.options).forEach(opt => {
        opt.selected = (node.parents || []).includes(opt.value);
      });
    }
  } else {
    titleEl.textContent = 'Tambah Milestone Baru';
    btnDelete.classList.add('hidden');
    document.getElementById('node-title').value = '';
    document.getElementById('node-desc').value = '';
    document.getElementById('node-icon').value = 'fa-flask';
    document.getElementById('node-status').value = 'locked';
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

// Project Modal
function openProjectModal() {
  const modal = document.getElementById('project-modal');
  document.getElementById('input-project-name').value = appData.projectName;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeProjectModal() {
  const modal = document.getElementById('project-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// Confirm Modal (Global Helper)
function openConfirmModal(title, message, callback, actionText = 'Ya, Lanjutkan') {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('btn-confirm-action').textContent = actionText;
  
  onConfirmAction = callback;
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  onConfirmAction = null;
}

/* -------------------------------------------------------------
   SETUP EVENT LISTENERS
------------------------------------------------------------- */
function setupEventListeners() {
  // Node Modal Events
  document.getElementById('btn-add-node').addEventListener('click', () => openNodeModal());
  document.getElementById('btn-close-modal').addEventListener('click', closeNodeModal);
  
  document.getElementById('node-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const selectedParents = Array.from(document.getElementById('node-parents').selectedOptions).map(o => o.value);
    
    if (activeNodeId) {
      const index = appData.nodes.findIndex(n => n.id === activeNodeId);
      if (index !== -1) {
        appData.nodes[index].title = document.getElementById('node-title').value.trim();
        appData.nodes[index].desc = document.getElementById('node-desc').value.trim();
        appData.nodes[index].icon = document.getElementById('node-icon').value;
        appData.nodes[index].status = document.getElementById('node-status').value;
        appData.nodes[index].parents = selectedParents;
      }
    } else {
      const newId = 'node_' + Date.now();
      appData.nodes.push({
        id: newId,
        title: document.getElementById('node-title').value.trim(),
        desc: document.getElementById('node-desc').value.trim(),
        icon: document.getElementById('node-icon').value,
        status: document.getElementById('node-status').value,
        x: Math.abs(panX) + 300,
        y: Math.abs(panY) + 250,
        parents: selectedParents
      });
    }
    
    saveData();
    closeNodeModal();
  });

  // Hapus Node via Custom Confirm Modal
  document.getElementById('btn-delete-node').addEventListener('click', () => {
    if (activeNodeId) {
      openConfirmModal(
        'Hapus Penemuan ini?',
        'Langkah ini akan menghapus node item dari peta crafting secara permanen.',
        () => {
          appData.nodes = appData.nodes.filter(n => n.id !== activeNodeId);
          appData.nodes.forEach(n => {
            if (n.parents) {
              n.parents = n.parents.filter(pId => pId !== activeNodeId);
            }
          });
          saveData();
          closeNodeModal();
        },
        'Hapus Node'
      );
    }
  });

  // Project Modal Events
  document.getElementById('btn-edit-project').addEventListener('click', openProjectModal);
  document.getElementById('btn-close-project-modal').addEventListener('click', closeProjectModal);
  document.getElementById('btn-cancel-project-modal').addEventListener('click', closeProjectModal);
  
  document.getElementById('project-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newName = document.getElementById('input-project-name').value.trim();
    if (newName) {
      appData.projectName = newName;
      saveData();
      closeProjectModal();
    }
  });

  // Confirm Modal Actions
  document.getElementById('btn-confirm-cancel').addEventListener('click', closeConfirmModal);
  document.getElementById('btn-confirm-action').addEventListener('click', () => {
    if (typeof onConfirmAction === 'function') {
      onConfirmAction();
    }
    closeConfirmModal();
  });

  // Reset Map via Custom Confirm Modal
  document.getElementById('btn-reset').addEventListener('click', () => {
    openConfirmModal(
      'Reset Peta Penemuan?',
      'Semua node dan struktur peta yang telah diubah akan kembali ke posisi awal.',
      () => {
        panX = 0;
        panY = 0;
        appData = JSON.parse(JSON.stringify(defaultData));
        saveData();
      },
      'Ya, Reset Data'
    );
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
}
