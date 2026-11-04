// CONFIGURATION: URL Google Apps Script Web App Anda
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzefvuOmcLV4u7WqRXN47DckTK-FQ9_LXLFOAnXQlGfaLI4BZ9PCPGGBqmWgt2NjAUo/exec";

// State Management
let currentProjectId = null;
let currentProjectName = "";
let currentNodes = [];
let projectsList = [];

let activeNodeId = null;
let contextMenuNodeId = null;
let isProjectModalEdit = false;

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

let onConfirmAction = null;

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupPanAndDrag();
  fetchProjectsList();
});

/* -------------------------------------------------------------
   DATABASE GOOGLE SHEETS API CALLS
------------------------------------------------------------- */
function showLoading(msg = "Memuat data...") {
  const el = document.getElementById('loading-spinner');
  if (el) {
    document.getElementById('loading-text').textContent = msg;
    el.classList.remove('hidden');
  }
}

function hideLoading() {
  const el = document.getElementById('loading-spinner');
  if (el) el.classList.add('hidden');
}

function fetchProjectsList() {
  showLoading("Memuat daftar proyek...");
  fetch(`${APPS_SCRIPT_URL}?action=getProjects`)
    .then(res => res.json())
    .then(data => {
      hideLoading();
      if (data.status === 'success') {
        projectsList = data.projects || [];
        renderProjectDropdown();
      }
    })
    .catch(err => {
      hideLoading();
      console.error("Gagal memuat daftar proyek:", err);
    });
}

function fetchProjectData(projectId) {
  showLoading("Memuat roadmap proyek...");
  fetch(`${APPS_SCRIPT_URL}?action=getProjectData&projectId=${projectId}`)
    .then(res => res.json())
    .then(data => {
      hideLoading();
      if (data.status === 'success') {
        currentNodes = (data.nodes || []).map(n => ({
          ...n,
          date: n.date || ""
        }));
        renderBoard();
        renderHeaderStats();
      }
    })
    .catch(err => {
      hideLoading();
      console.error("Gagal memuat data proyek:", err);
    });
}

function saveCurrentProjectToDB() {
  if (!currentProjectId) return;
  showLoading("Menyimpan ke Google Sheets...");
  
  const payload = {
    action: "saveProject",
    projectId: currentProjectId,
    projectName: currentProjectName,
    nodes: currentNodes
  };

  fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      hideLoading();
      if (data.status === 'success') {
        openAlertModal("Berhasil!", "Data roadmap berhasil disimpan ke Google Sheets.", "success");
      } else {
        openAlertModal("Gagal", "Gagal menyimpan data: " + (data.message || "Unknown error"), "error");
      }
    })
    .catch(err => {
      hideLoading();
      console.error("Error saving data:", err);
      openAlertModal("Kesalahan", "Terjadi kesalahan saat menyimpan data ke Sheets.", "error");
    });
}

function deleteProjectFromDB(projectId) {
  showLoading("Menghapus proyek...");
  const payload = { action: "deleteProject", projectId: projectId };
  fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      hideLoading();
      if (data.status === 'success') {
        currentProjectId = null;
        currentProjectName = "";
        currentNodes = [];
        document.getElementById('map-canvas').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
        document.getElementById('btn-edit-project').classList.add('hidden');
        document.getElementById('btn-delete-project').classList.add('hidden');
        fetchProjectsList();
      }
    })
    .catch(err => {
      hideLoading();
      console.error("Error deleting project:", err);
    });
}

/* -------------------------------------------------------------
   RENDER FUNCTIONS
------------------------------------------------------------- */
function renderProjectDropdown() {
  const selector = document.getElementById('project-selector');
  selector.innerHTML = '<option value="">-- Pilih Proyek --</option>';
  
  projectsList.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === currentProjectId) opt.selected = true;
    selector.appendChild(opt);
  });

  if (!currentProjectId) {
    document.getElementById('map-canvas').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
    document.getElementById('btn-edit-project').classList.add('hidden');
    document.getElementById('btn-delete-project').classList.add('hidden');
  }
}

function selectProject(projectId) {
  if (!projectId) {
    currentProjectId = null;
    currentProjectName = "";
    currentNodes = [];
    renderProjectDropdown();
    return;
  }
  
  const proj = projectsList.find(p => p.id == projectId);
  if (proj) {
    currentProjectId = proj.id;
    currentProjectName = proj.name;
    
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('map-canvas').classList.remove('hidden');
    document.getElementById('btn-edit-project').classList.remove('hidden');
    document.getElementById('btn-delete-project').classList.remove('hidden');
    
    fetchProjectData(currentProjectId);
  }
}

function renderHeaderStats() {
  const total = currentNodes.length;
  const completed = currentNodes.filter(n => n.status === 'completed').length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  
  document.getElementById('stat-acquired').textContent = completed;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-progress').textContent = `${percent}%`;
  document.getElementById('progress-bar').style.width = `${percent}%`;
}

function renderBoard() {
  const canvas = document.getElementById('map-canvas');
  const svg = document.getElementById('connections-layer');
  
  canvas.style.transform = `translate(${panX}px, ${panY}px)`;
  canvas.querySelectorAll('.craft-node').forEach(n => n.remove());
  svg.innerHTML = '';

  const nodeMap = {};
  currentNodes.forEach(node => { nodeMap[node.id] = node; });

  currentNodes.forEach(node => {
    if (node.parents && node.parents.length > 0) {
      node.parents.forEach(parentId => {
        const parent = nodeMap[parentId];
        if (parent) {
          drawLine(svg, parent, node);
        }
      });
    }
  });

  currentNodes.forEach(node => {
    const el = createNodeElement(node);
    canvas.appendChild(el);
  });
}

function drawLine(svg, source, target) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const x1 = source.x + 88;
  const y1 = source.y + 60;
  const x2 = target.x + 88;
  const y2 = target.y + 60;
  
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
  const dateFormatted = node.date ? `<div class="text-[10px] text-slate-400 mt-1 font-mono"><i class="fa-regular fa-calendar mr-1"></i>${node.date}</div>` : '';
  
  div.innerHTML = `
    <div class="flex items-center justify-between mb-2 pointer-events-none">
      <span class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
        <i class="fa-solid ${node.icon}"></i>
      </span>
      <div class="flex flex-col items-end">
        ${statusBadge}
        ${dateFormatted}
      </div>
    </div>
    <h4 class="font-bold text-sm text-slate-100 truncate mb-1 pointer-events-none">${node.title}</h4>
    <p class="text-xs text-slate-400 line-clamp-2 pointer-events-none">${node.desc || 'Tidak ada keterangan'}</p>
  `;

  // Event Klik Kanan (Context Menu) pada Node
  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    contextMenuNodeId = node.id;
    showContextMenu(e.clientX, e.clientY);
  });
  
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
   PAN & DRAG & CONTEXT MENU HANDLERS
------------------------------------------------------------- */
function setupPanAndDrag() {
  const viewport = document.getElementById('map-viewport');

  // Tutup context menu saat klik di luar
  window.addEventListener('click', () => {
    hideContextMenu();
  });

  viewport.addEventListener('mousedown', (e) => {
    hideContextMenu();
    if (!currentProjectId) return;
    const nodeEl = e.target.closest('.craft-node');
    
    if (nodeEl && e.button === 0) { // Klik kiri
      isDraggingNode = true;
      draggedNodeId = nodeEl.dataset.id;
      nodeEl.classList.add('is-dragging');
      
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      
      const nodeData = currentNodes.find(n => n.id === draggedNodeId);
      if (nodeData) {
        initialNodeX = nodeData.x;
        initialNodeY = nodeData.y;
      }
    } else if (e.button === 0) {
      isPanning = true;
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingNode && draggedNodeId) {
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      
      const nodeData = currentNodes.find(n => n.id === draggedNodeId);
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

function showContextMenu(x, y) {
  const menu = document.getElementById('node-context-menu');
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove('hidden');
}

function hideContextMenu() {
  const menu = document.getElementById('node-context-menu');
  menu.classList.add('hidden');
}

function updateConnectionsOnly() {
  const svg = document.getElementById('connections-layer');
  svg.innerHTML = '';
  
  const nodeMap = {};
  currentNodes.forEach(node => { nodeMap[node.id] = node; });

  currentNodes.forEach(node => {
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
   MODAL HANDLERS
------------------------------------------------------------- */
function openNodeModal(id = null) {
  if (!currentProjectId) {
    openAlertModal("Perhatian", "Pilih proyek terlebih dahulu sebelum menambah atau mengedit node.");
    return;
  }
  activeNodeId = id;
  const modal = document.getElementById('node-modal');
  const titleEl = document.getElementById('modal-title');
  const btnDelete = document.getElementById('btn-delete-node');
  
  const parentSelect = document.getElementById('node-parents');
  parentSelect.innerHTML = '';
  
  const availableParents = currentNodes.filter(n => n.id !== id);
  if (availableParents.length === 0) {
    parentSelect.innerHTML = '<option value="" disabled selected>Belum ada node lain yang tersedia</option>';
  } else {
    availableParents.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = n.title;
      parentSelect.appendChild(opt);
    });
  }

  if (id) {
    titleEl.textContent = 'Edit Milestone / Task';
    btnDelete.classList.remove('hidden');
    const node = currentNodes.find(n => n.id === id);
    if (node) {
      document.getElementById('node-title').value = node.title;
      document.getElementById('node-desc').value = node.desc || '';
      document.getElementById('node-icon').value = node.icon;
      document.getElementById('node-status').value = node.status;
      document.getElementById('node-date').value = node.date || '';
      
      Array.from(parentSelect.options).forEach(opt => {
        if ((node.parents || []).includes(opt.value)) {
          opt.selected = true;
        }
      });
    }
  } else {
    titleEl.textContent = 'Tambah Milestone Baru';
    btnDelete.classList.add('hidden');
    document.getElementById('node-title').value = '';
    document.getElementById('node-desc').value = '';
    document.getElementById('node-icon').value = 'fa-flask';
    document.getElementById('node-status').value = 'locked';
    document.getElementById('node-date').value = '';
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

function openProjectModal(isEdit = false) {
  isProjectModalEdit = isEdit;
  const modal = document.getElementById('project-modal');
  const title = document.getElementById('project-modal-title');
  const input = document.getElementById('input-project-name');

  if (isEdit) {
    title.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Rename Proyek`;
    input.value = currentProjectName;
  } else {
    title.innerHTML = `<i class="fa-solid fa-folder-plus"></i> Proyek Baru`;
    input.value = '';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeProjectModal() {
  const modal = document.getElementById('project-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function openConfirmModal(title, message, callback) {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
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

function openAlertModal(title, message, type = "info") {
  const modal = document.getElementById('alert-modal');
  document.getElementById('alert-title').textContent = title;
  document.getElementById('alert-message').textContent = message;
  
  const iconWrap = document.getElementById('alert-icon-wrap');
  const icon = document.getElementById('alert-icon');
  
  if (type === "success") {
    iconWrap.className = "w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3";
    icon.className = "fa-solid fa-circle-check text-xl";
  } else if (type === "error") {
    iconWrap.className = "w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3";
    icon.className = "fa-solid fa-circle-exclamation text-xl";
  } else {
    iconWrap.className = "w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3";
    icon.className = "fa-solid fa-circle-info text-xl";
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeAlertModal() {
  const modal = document.getElementById('alert-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

/* -------------------------------------------------------------
   EVENTS SETUP
------------------------------------------------------------- */
function setupEventListeners() {
  document.getElementById('project-selector').addEventListener('change', (e) => {
    selectProject(e.target.value);
  });

  document.getElementById('btn-create-project').addEventListener('click', () => openProjectModal(false));
  document.getElementById('btn-empty-create').addEventListener('click', () => openProjectModal(false));
  document.getElementById('btn-edit-project').addEventListener('click', () => openProjectModal(true));

  document.getElementById('btn-delete-project').addEventListener('click', () => {
    if (!currentProjectId) return;
    openConfirmModal(
      'Hapus Proyek Ini?',
      `Seluruh roadmap "${currentProjectName}" akan dihapus dari Google Sheets.`,
      () => deleteProjectFromDB(currentProjectId)
    );
  });

  document.getElementById('btn-close-project-modal').addEventListener('click', closeProjectModal);
  document.getElementById('btn-cancel-project-modal').addEventListener('click', closeProjectModal);

  document.getElementById('project-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('input-project-name').value.trim();
    if (!name) return;

    if (isProjectModalEdit) {
      currentProjectName = name;
      saveCurrentProjectToDB();
      fetchProjectsList();
    } else {
      currentProjectId = "proj_" + Date.now();
      currentProjectName = name;
      currentNodes = [];
      saveCurrentProjectToDB();
      fetchProjectsList();
      selectProject(currentProjectId);
    }
    closeProjectModal();
  });

  document.getElementById('btn-add-node').addEventListener('click', () => openNodeModal());
  document.getElementById('btn-close-modal').addEventListener('click', closeNodeModal);

  document.getElementById('node-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const selectedParents = Array.from(document.getElementById('node-parents').selectedOptions)
      .map(o => o.value)
      .filter(val => val !== "");

    if (activeNodeId) {
      const idx = currentNodes.findIndex(n => n.id === activeNodeId);
      if (idx !== -1) {
        currentNodes[idx].title = document.getElementById('node-title').value.trim();
        currentNodes[idx].desc = document.getElementById('node-desc').value.trim();
        currentNodes[idx].icon = document.getElementById('node-icon').value;
        currentNodes[idx].status = document.getElementById('node-status').value;
        currentNodes[idx].date = document.getElementById('node-date').value;
        currentNodes[idx].parents = selectedParents;
      }
    } else {
      const newId = "node_" + Date.now();
      currentNodes.push({
        id: newId,
        title: document.getElementById('node-title').value.trim(),
        desc: document.getElementById('node-desc').value.trim(),
        icon: document.getElementById('node-icon').value,
        status: document.getElementById('node-status').value,
        date: document.getElementById('node-date').value,
        x: Math.abs(panX) + 300,
        y: Math.abs(panY) + 250,
        parents: selectedParents
      });
    }

    renderBoard();
    renderHeaderStats();
    closeNodeModal();
  });

  document.getElementById('btn-delete-node').addEventListener('click', () => {
    if (activeNodeId) {
      openConfirmModal(
        'Hapus Task ini?',
        'Node item ini akan dihapus dari proyek.',
        () => {
          currentNodes = currentNodes.filter(n => n.id !== activeNodeId);
          currentNodes.forEach(n => {
            if (n.parents) n.parents = n.parents.filter(pId => pId !== activeNodeId);
          });
          renderBoard();
          renderHeaderStats();
          closeNodeModal();
        }
      );
    }
  });

  // Context Menu Actions (Copy & Delete)
  document.getElementById('ctx-copy').addEventListener('click', () => {
    if (contextMenuNodeId) {
      const targetNode = currentNodes.find(n => n.id === contextMenuNodeId);
      if (targetNode) {
        const newNodeId = "node_" + Date.now();
        const duplicatedNode = {
          ...targetNode,
          id: newNodeId,
          title: targetNode.title + " (Copy)",
          x: targetNode.x + 30,
          y: targetNode.y + 30
        };
        currentNodes.push(duplicatedNode);
        renderBoard();
        renderHeaderStats();
      }
    }
    hideContextMenu();
  });

  document.getElementById('ctx-delete').addEventListener('click', () => {
    if (contextMenuNodeId) {
      openConfirmModal(
        'Hapus Task ini?',
        'Node item ini akan dihapus dari proyek.',
        () => {
          currentNodes = currentNodes.filter(n => n.id !== contextMenuNodeId);
          currentNodes.forEach(n => {
            if (n.parents) n.parents = n.parents.filter(pId => pId !== contextMenuNodeId);
          });
          renderBoard();
          renderHeaderStats();
        }
      );
    }
    hideContextMenu();
  });

  document.getElementById('btn-save-db').addEventListener('click', saveCurrentProjectToDB);

  document.getElementById('btn-confirm-cancel').addEventListener('click', closeConfirmModal);
  document.getElementById('btn-confirm-action').addEventListener('click', () => {
    if (typeof onConfirmAction === 'function') onConfirmAction();
    closeConfirmModal();
  });

  document.getElementById('btn-alert-ok').addEventListener('click', closeAlertModal);
}
