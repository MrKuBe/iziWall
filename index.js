// ==================== SESSION ID ====================
function getSessionId() {
  let sessionId = localStorage.getItem('wallSessionId');
  if (!sessionId) {
    sessionId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('wallSessionId', sessionId);
  }
  return sessionId;
}

// ==================== STATE ====================
let state = {
  categories: [],
  cartes: [],
  likes: [],
  commentaires: [],
  configuration: [],
  users: [],
  responsables: [],
  currentUser: null,
  currentEmail: '',
  currentPseudo: '',
  currentFirstName: '',
  currentLastName: '',
  currentEntity: '',
  currentTheme: localStorage.getItem('wallTheme') || 'dark',
  sessionId: getSessionId(),
  isAdmin: false,
  moderationActive: false,
  searchQuery: '',
  filterAuthor: '',
  filterPriority: '',
  filterStatus: '',
  filterTag: '',
  filterResponsable: '',
  wallTitle: '📌 Mur collaboratif',
  wallEmoji: '📌',
  wallSlogan: 'Partagez vos idées !',
  isSyncing: false,
  draggedCardId: null,
  dragOverColumnId: null,
  cardImages: {},
  showStatistics: false,
  showArchives: false,
  showCodir: false,
  showCalendar: false,
  modalType: null
};

const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899'
];

const PRIORITY_LEVELS = {
  'basse': { icon: '⬇️', color: '#10b981', label: 'Basse' },
  'moyenne': { icon: '➡️', color: '#f59e0b', label: 'Moyenne' },
  'haute': { icon: '⬆️', color: '#ef4444', label: 'Haute' },
  'urgente': { icon: '🔴', color: '#dc2626', label: 'Urgente' }
};

// ==================== USER MANAGEMENT ====================
function generatePseudo(firstName, lastName) {
  const first = (firstName || 'User').trim().split(' ')[0];
  const last = (lastName || '').trim().split(' ')[0];
  return last ? `${first} ${last}` : first;
}

async function tryGetGristSessionEmail() {
  try {
    const tokenData = await grist.getAccessToken();
    if (tokenData && tokenData.baseUrl && tokenData.token) {
      const response = await fetch(`${tokenData.baseUrl}/api/session/access/active`, {
        headers: { 'Authorization': `Bearer ${tokenData.token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.user && data.user.email && !data.user.email.includes('anon@')) {
          console.log('✓ Email détecté via session Grist:', data.user.email);
          return {
            email: data.user.email.toLowerCase(),
            name: data.user.name || ''
          };
        }
      }
    }
  } catch (err) {
    console.warn('Impossible de récupérer la session Grist:', err.message);
  }
  return null;
}

function initializeUser() {
  // Vérifier si on a un email stocké localement
  const storedEmail = localStorage.getItem('userEmail');
  
  if (storedEmail) {
    // Chercher l'utilisateur dans la table Users
    const existingUser = state.users.find(u => u.mail && u.mail.toLowerCase() === storedEmail.toLowerCase());
    
    if (existingUser) {
      state.currentUser = existingUser;
      state.currentEmail = storedEmail;
      state.currentPseudo = existingUser.Pseudo || generatePseudo(existingUser.firstname || '', existingUser.lastname || '');
      state.currentFirstName = existingUser.firstname || '';
      state.currentLastName = existingUser.lastname || '';
      state.currentEntity = existingUser.Entity || '';
      console.log('✓ Utilisateur chargé depuis Users:', state.currentPseudo);
      return true;
    }
  }

  // Vérifier si connexion anonyme
  const isAnonymous = localStorage.getItem('anonymousMode');
  if (isAnonymous === 'true') {
    state.currentPseudo = 'Anonyme';
    state.currentEmail = '';
    console.log('✓ Mode anonyme actif');
    return true;
  }
  
  // Pas d'utilisateur trouvé
  return false;
}

async function autoLoginFromGristSession() {
  const gristSession = await tryGetGristSessionEmail();
  if (!gristSession) return false;

  const emailLower = gristSession.email;
  const existingUser = state.users.find(u => u.mail && u.mail.toLowerCase() === emailLower);

  if (existingUser) {
    // Auto-connexion
    localStorage.setItem('userEmail', emailLower);
    state.currentUser = existingUser;
    state.currentEmail = emailLower;
    state.currentPseudo = existingUser.Pseudo || generatePseudo(existingUser.firstname || '', existingUser.lastname || '');
    state.currentFirstName = existingUser.firstname || '';
    state.currentLastName = existingUser.lastname || '';
    state.currentEntity = existingUser.Entity || '';

    // MAJ dernière visite
    try {
      await grist.docApi.applyUserActions([
        ['UpdateRecord', 'Users', existingUser.id, { DateLastVisit: toGristDateTime() }]
      ]);
    } catch (e) { console.warn('MAJ DateLastVisit:', e); }

    console.log('✓ Auto-connexion Grist:', state.currentPseudo);
    showToast(`Bienvenue ${state.currentPseudo} ! 👋`, 'success');
    render();
    return true;
  } else {
    // L'email Grist n'est pas dans Users, pré-remplir le formulaire de création
    const nameParts = (gristSession.name || '').split(' ');
    openUserCreationModal(emailLower, nameParts[0] || '', nameParts.slice(1).join(' ') || '');
    return true; // On gère l'affichage
  }
}

// ==================== UTILS ====================
async function fetchTableWithTimeout(tableName, timeout = 3000) {
  try {
    const promise = grist.docApi.fetchTable(tableName);
    return await Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout`)), timeout))
    ]);
  } catch (err) {
    console.warn(`Impossible de charger ${tableName}:`, err.message);
    return { id: [] };
  }
}

function generateColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  let timestamp = parseFloat(dateStr);
  if (timestamp < 10000000000) {
    timestamp = timestamp * 1000;
  }
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days}j`;
  return date.toLocaleDateString('fr-FR');
}

function formatDeadline(dateStr) {
  if (!dateStr) return '';
  let timestamp = parseFloat(dateStr);
  if (timestamp < 10000000000) {
    timestamp = timestamp * 1000;
  }
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(date);
  deadlineDate.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((deadlineDate - now) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { text: 'Dépassée', color: '#ef4444', icon: '⚠️' };
  if (daysLeft === 0) return { text: "Aujourd'hui", color: '#f59e0b', icon: '⏰' };
  if (daysLeft === 1) return { text: 'Demain', color: '#06b6d4', icon: '📅' };
  if (daysLeft <= 7) return { text: `${daysLeft}j restant`, color: '#3b82f6', icon: '📆' };
  return { text: date.toLocaleDateString('fr-FR'), color: '#6b7280', icon: '📅' };
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function processRichTextLinks(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  const links = div.querySelectorAll('a');
  links.forEach(link => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
  return div.innerHTML;
}

function getFileIcon(filename) {
  if (!filename) return '📎';
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    'pdf': '📄', 'doc': '📝', 'docx': '📝',
    'xls': '📊', 'xlsx': '📊', 'ppt': '📽️', 'pptx': '📽️',
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️',
    'mp3': '🎵', 'wav': '🎵', 'mp4': '🎬', 'mov': '🎬',
    'zip': '🗜️', 'rar': '🗜️', 'txt': '📃'
  };
  return icons[ext] || '📎';
}

function renderAttachmentsSection(carte) {
  const attachmentIds = parseAttachments(carte.PieceJointe);
  const hasAttachments = attachmentIds.length > 0;
  const hasExternalLink = !!carte.LienExterne;

  if (!hasAttachments && !hasExternalLink) return '';

  let attachmentItems = '';
  if (hasAttachments && state.attachmentsTable) {
    attachmentItems = attachmentIds.map(id => {
      const index = state.attachmentsTable.id.indexOf(id);
      const fileName = index !== -1 ? state.attachmentsTable.fileName[index] : `Fichier ${id}`;
      const icon = getFileIcon(fileName);
      const url = getAttachmentUrl(id);
      return `
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="attachment-link" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-main); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); text-decoration: none; color: var(--text-primary); transition: all 0.2s ease; cursor: pointer;" onmouseover="this.style.borderColor='var(--accent-primary)'; this.style.background='var(--bg-card)'" onmouseout="this.style.borderColor='var(--border-subtle)'; this.style.background='var(--bg-main)'">
          <span style="font-size: 1.25rem;">${icon}</span>
          <span style="flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(fileName)}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">⬇️</span>
        </a>
      `;
    }).join('');
  } else if (hasAttachments) {
    attachmentItems = `<p style="color: var(--text-muted); font-size: 0.85rem;">📎 ${attachmentIds.length} pièce(s) jointe(s) (chargement...)</p>`;
  }

  const externalLinkHtml = hasExternalLink ? `
    <a href="${escapeHtml(carte.LienExterne)}" target="_blank" rel="noopener noreferrer" class="attachment-link" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-main); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); text-decoration: none; color: var(--text-primary); transition: all 0.2s ease; cursor: pointer;" onmouseover="this.style.borderColor='var(--accent-primary)'; this.style.background='var(--bg-card)'" onmouseout="this.style.borderColor='var(--border-subtle)'; this.style.background='var(--bg-main)'">
      <span style="font-size: 1.25rem;">🔗</span>
      <span style="flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(carte.LienExterne)}</span>
      <span style="font-size: 0.75rem; color: var(--text-muted);">↗️</span>
    </a>
  ` : '';

  return `
    <div style="margin: 16px 0; padding: 16px; background: var(--bg-secondary); border-radius: var(--radius-md);">
      <h4 style="margin: 0 0 10px 0; color: var(--text-primary); font-size: 0.9rem;">📎 Pièces jointes & Liens</h4>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${attachmentItems}
        ${externalLinkHtml}
      </div>
    </div>
  `;
}

function isImageFile(filename) {
  if (!filename) return false;
  const ext = filename.split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
}


function getAttachmentUrl(attachmentId) {
  if (state.attachmentBaseUrl && state.attachmentToken) {
    return `${state.attachmentBaseUrl}/attachments/${attachmentId}/download?auth=${state.attachmentToken}`;
  }
  return `attachment/${attachmentId}`;
}

function parseAttachments(attachmentData) {
  if (!attachmentData) return [];
  if (Array.isArray(attachmentData) && attachmentData[0] === 'L') {
    return attachmentData.slice(1);
  }
  return [];
}

// Grist ChoiceList helpers : ['L', 'val1', 'val2'] ↔ string
function parseChoiceList(val) {
  if (!val) return '';
  if (Array.isArray(val) && val[0] === 'L') {
    return val[1] || '';
  }
  if (typeof val === 'string') return val;
  return '';
}

function buildChoiceList(val) {
  if (!val) return ['L'];
  return ['L', val];
}

// Grist DateTime helper : timestamp Unix en secondes
function toGristDateTime() {
  return Math.floor(Date.now() / 1000);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function toggleTheme() {
  state.currentTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', state.currentTheme);
  localStorage.setItem('wallTheme', state.currentTheme);
}

// ==================== DATA FETCHING ====================
async function fetchAllData(silent = false) {
  if (!silent) {
    state.isSyncing = true;
    updateSyncIndicator();
  }

  try {
    // Charger les tables avec timeout individual pour éviter les blocages RPC
    const [categories, cartes, likes, commentaires, configuration, users, responsables] = await Promise.all([
      fetchTableWithTimeout('Categories', 3000),
      fetchTableWithTimeout('Cartes', 3000),
      fetchTableWithTimeout('Likes', 3000),
      fetchTableWithTimeout('Commentaires', 3000),
      fetchTableWithTimeout('Configuration', 3000),
      fetchTableWithTimeout('Users', 3000),
      fetchTableWithTimeout('Responsables', 3000)
    ]);

    state.categories = transformGristData(categories);
    state.cartes = transformGristData(cartes);
    state.likes = transformGristData(likes);
    state.commentaires = transformGristData(commentaires);
    state.configuration = transformGristData(configuration);
    state.users = transformGristData(users);
    state.responsables = transformGristData(responsables);

    // Initialiser l'utilisateur depuis localStorage ou Users table
    const userInitialized = initializeUser();

    const moderationConfig = state.configuration.find(c => c.Cle === 'moderation_active');
    state.moderationActive = moderationConfig ? moderationConfig.Valeur : false;

    const titleConfig = state.configuration.find(c => c.Cle === 'wall_title');
    const emojiConfig = state.configuration.find(c => c.Cle === 'wall_emoji');
    const sloganConfig = state.configuration.find(c => c.Cle === 'wall_slogan');

    if (titleConfig && titleConfig.Valeur_Text) state.wallTitle = titleConfig.Valeur_Text;
    if (emojiConfig && emojiConfig.Valeur_Text) state.wallEmoji = emojiConfig.Valeur_Text;
    if (sloganConfig && sloganConfig.Valeur_Text) state.wallSlogan = sloganConfig.Valeur_Text;

    updateWallTitle();
    await detectAdminPermissions();
    
    try {
      const tokenData = await grist.getAccessToken();
      state.attachmentBaseUrl = tokenData.baseUrl;
      state.attachmentToken = tokenData.token;
      await loadCardImages();
    } catch (err) {
      console.warn('getAccessToken non disponible:', err);
    }

    // Redessiner tout le widget
    render();
    
    if (state.modalType === 'cardDetail' && state.selectedCard) {
      updateCardDetailModal(state.selectedCard);
    }

    // Afficher la modale de connexion si pas d'utilisateur
    if (!userInitialized) {
      // Tenter l'auto-connexion via la session Grist DINUM
      const autoLogged = await autoLoginFromGristSession();
      if (!autoLogged) {
        openUserLoginModal();
      }
    }
  } catch (err) {
    console.error('Erreur chargement données:', err);
    if (!silent) {
      showError('Erreur de chargement des données');
    }
  } finally {
    state.isSyncing = false;
    updateSyncIndicator();
  }
}

function transformGristData(gristData) {
  if (!gristData || !gristData.id) return [];
  const result = [];
  const keys = Object.keys(gristData);
  const length = gristData.id.length;
  
  for (let i = 0; i < length; i++) {
    const obj = {};
    keys.forEach(key => {
      obj[key] = gristData[key][i];
    });
    // Normaliser Priorite (ChoiceList → string simple) pour usage interne
    if (obj.Priorite !== undefined) {
      obj.Priorite = parseChoiceList(obj.Priorite);
    }
    result.push(obj);
  }
  return result;
}

async function loadCardImages() {
  if (!state.attachmentBaseUrl || !state.attachmentToken) return;

  if (!state.cardImages) {
    state.cardImages = {};
  }

  try {
    const attachmentsTable = await grist.docApi.fetchTable('_grist_Attachments');
    state.attachmentsTable = attachmentsTable;

    for (const carte of state.cartes) {
      const attachmentIds = parseAttachments(carte.PieceJointe);
      if (attachmentIds.length === 0) continue;

      for (const id of attachmentIds) {
        const index = attachmentsTable.id.indexOf(id);
        if (index !== -1) {
          const fileName = attachmentsTable.fileName[index];
          if (isImageFile(fileName)) {
            state.cardImages[carte.id] = getAttachmentUrl(id);
            break;
          }
        }
      }
    }
  } catch (err) {
    console.error('Erreur loadCardImages:', err);
  }
}

function updateSyncIndicator() {
  const indicator = document.getElementById('sync-indicator');
  if (indicator) {
    indicator.className = `sync-indicator ${state.isSyncing ? 'syncing' : ''}`;
    indicator.innerHTML = `
      <span class="sync-dot"></span>
      <span>${state.isSyncing ? 'Sync...' : 'Connecté'}</span>
    `;
  }
}

async function detectAdminPermissions() {
  if (state.isAdmin) return;
  state.isAdmin = false;
}

async function toggleAdminMode() {
  if (state.isAdmin) {
    state.isAdmin = false;
    showToast('Mode admin désactivé', 'info');
    renderHeader();
    renderBoard();
    return;
  }

  try {
    state.isSyncing = true;

    if (!state.cartes || state.cartes.length === 0) {
      showToast('Aucune carte disponible pour tester les permissions', 'error');
      return;
    }

    const testCarte = state.cartes[0];
    const currentApprouveValue = testCarte.Approuve;

    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Cartes', testCarte.id, { Approuve: !currentApprouveValue }]
    ]);

    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Cartes', testCarte.id, { Approuve: currentApprouveValue }]
    ]);

    state.isAdmin = true;
    state.isSyncing = false;

    showToast('Mode admin activé !', 'success');
    renderHeader();
    renderBoard();

  } catch (err) {
    console.error('Erreur test admin:', err);
    state.isSyncing = false;
    showToast('Vous n\'avez pas les permissions de modération', 'error');
    state.isAdmin = false;
  }
}

// ==================== DRAG & DROP ====================
let dragStartTime = 0;
let isDragging = false;

function handleDragStart(e, carteId) {
  dragStartTime = Date.now();
  isDragging = true;
  state.draggedCardId = carteId;

  const cardElement = e.currentTarget;
  cardElement.classList.add('dragging');

  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', carteId.toString());

  setTimeout(() => {
    cardElement.style.opacity = '0.4';
  }, 0);
}

function handleDragEnd(e) {
  const cardElement = e.currentTarget;
  cardElement.classList.remove('dragging');
  cardElement.style.opacity = '1';

  document.querySelectorAll('.column').forEach(col => {
    col.classList.remove('drag-over');
  });

  setTimeout(() => {
    isDragging = false;
    state.draggedCardId = null;
    state.dragOverColumnId = null;
  }, 100);
}

function handleCardClick(e, carteId) {
  showCardDetail(carteId);
}

async function moveCardToColumn(carteId, targetColumnId) {
  try {
    const carte = state.cartes.find(c => c.id === carteId);
    const oldCat = carte ? state.categories.find(cat => cat.id === carte.Categorie) : null;
    const newCat = state.categories.find(cat => cat.id === targetColumnId);
    const oldCatName = oldCat ? oldCat.Nom : 'Inconnu';
    const newCatName = newCat ? newCat.Nom : 'Inconnu';
    const author = state.currentPseudo || 'Anonyme';
    const historique = carte ? (carte.Historique || '') : '';
    const entry = `[${new Date().toLocaleString('fr-FR')}] ${author} - Déplacement: "${oldCatName}" → "${newCatName}"`;
    const newHistorique = historique ? historique + '\n' + entry : entry;

    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Cartes', carteId, { Categorie: targetColumnId, Historique: newHistorique }]
    ]);
    showToast('Carte déplacée !', 'success');
    await fetchAllData(true);
  } catch (err) {
    console.error('Erreur déplacement carte:', err);
    showToast('Erreur lors du déplacement', 'error');
  }
}

// ==================== STATISTIQUES ====================
function getStatistics() {
  const stats = {
    totalCartes: state.cartes.length,
    cartesByCategory: {},
    cartesByPriority: { basse: 0, moyenne: 0, haute: 0, urgente: 0 },
    approved: 0,
    pending: 0,
    overdue: 0,
    deadlineToday: 0,
    deadlineSoon: 0,
    tags: {},
    totalComments: state.commentaires.length,
    totalLikes: state.likes.length,
    cartesByAuthor: {},
    cartesByResponsable: {},
    cartesWithoutResponsable: 0,
    cartesWithResponsable: 0,
    cartesWithImage: 0,
    cartesWithLink: 0,
    cartesWithAttachment: 0,
    cartesArchived: 0,
    cartesActive: 0,
    cartesCodir: 0
  };

  state.cartes.forEach(carte => {
    // Compteur archives
    if (carte.Archive === true) {
      stats.cartesArchived++;
    } else {
      stats.cartesActive++;
    }

    // Compteur CODIR
    if (carte.Codir === true) {
      stats.cartesCodir++;
    }

    // Par catégorie
    if (!stats.cartesByCategory[carte.Categorie]) {
      stats.cartesByCategory[carte.Categorie] = 0;
    }
    stats.cartesByCategory[carte.Categorie]++;

    // Par priorité
    const priority = carte.Priorite || 'moyenne';
    if (stats.cartesByPriority[priority] !== undefined) {
      stats.cartesByPriority[priority]++;
    }

    // Approbation
    if (carte.Approuve) {
      stats.approved++;
    } else {
      stats.pending++;
    }

    // Deadlines
    if (carte.Deadline) {
      const deadline = new Date(parseFloat(carte.Deadline) * 1000);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        stats.overdue++;
      } else if (diffDays === 0) {
        stats.deadlineToday++;
      } else if (diffDays <= 3) {
        stats.deadlineSoon++;
      }
    }

    // Tags
    if (carte.Tags) {
      const tags = carte.Tags.split(',').map(t => t.trim()).filter(t => t);
      tags.forEach(tag => {
        stats.tags[tag] = (stats.tags[tag] || 0) + 1;
      });
    }

    // Par auteur
    const auteur = carte.Auteur_Pseudo || carte.Auteur || 'Anonyme';
    stats.cartesByAuthor[auteur] = (stats.cartesByAuthor[auteur] || 0) + 1;

    // Par responsable
    if (carte.Responsable) {
      stats.cartesWithResponsable++;
      stats.cartesByResponsable[carte.Responsable] = (stats.cartesByResponsable[carte.Responsable] || 0) + 1;
    } else {
      stats.cartesWithoutResponsable++;
    }

    // Contenu riche
    if (carte.ImageURL) stats.cartesWithImage++;
    if (carte.LienExterne) stats.cartesWithLink++;
    if (carte.PieceJointe) stats.cartesWithAttachment++;
  });

  return stats;
}

function renderStatisticsDashboard() {
  const stats = getStatistics();
  const categoryNames = {};
  const categoryColors = {};
  state.categories.forEach(cat => {
    categoryNames[cat.id] = cat.Nom;
    categoryColors[cat.id] = cat.Couleur || '#6366f1';
  });

  const maxCatCount = Math.max(...Object.values(stats.cartesByCategory), 1);

  const categoryBars = Object.entries(stats.cartesByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([catId, count]) => `
      <div class="stat-bar">
        <div class="stat-label">${categoryNames[catId] || 'Catégorie'}</div>
        <div class="stat-progress">
          <div class="stat-fill" style="width: ${(count / maxCatCount * 100) || 0}%; background: ${categoryColors[catId] || 'var(--accent-primary)'}"></div>
        </div>
        <div class="stat-value">${count}</div>
      </div>
    `).join('');

  const tagsList = Object.entries(stats.tags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => `
      <span class="tag-badge" style="background-color: ${getTagColor(tag)}20; color: ${getTagColor(tag)}; border: 1px solid ${getTagColor(tag)}40; cursor: pointer;" onclick="filterByTag('${escapeHtml(tag)}')">
        🏷️ ${escapeHtml(tag)} <small>(${count})</small>
      </span>
    `).join('');

  const topAuthors = Object.entries(stats.cartesByAuthor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxAuthorCount = topAuthors.length > 0 ? topAuthors[0][1] : 1;

  const authorBars = topAuthors.map(([author, count]) => `
    <div class="stat-bar">
      <div class="stat-label" style="display: flex; align-items: center; gap: 6px;">
        <span style="background: ${generateColor(author)}; color: white; width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 600; flex-shrink: 0;">${getInitials(author)}</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(author)}</span>
      </div>
      <div class="stat-progress">
        <div class="stat-fill" style="width: ${(count / maxAuthorCount * 100) || 0}%; background: ${generateColor(author)}"></div>
      </div>
      <div class="stat-value">${count}</div>
    </div>
  `).join('');

  const topResponsables = Object.entries(stats.cartesByResponsable)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxRespCount = topResponsables.length > 0 ? topResponsables[0][1] : 1;

  const responsableBars = topResponsables.map(([resp, count]) => `
    <div class="stat-bar">
      <div class="stat-label" style="display: flex; align-items: center; gap: 6px;">
        <span style="background: var(--accent-primary); color: white; width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 600; flex-shrink: 0;">${getInitials(resp)}</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(resp)}</span>
      </div>
      <div class="stat-progress">
        <div class="stat-fill" style="width: ${(count / maxRespCount * 100) || 0}%"></div>
      </div>
      <div class="stat-value">${count}</div>
    </div>
  `).join('');

  const totalPriority = stats.cartesByPriority.basse + stats.cartesByPriority.moyenne + stats.cartesByPriority.haute + stats.cartesByPriority.urgente || 1;

  return `
    <div class="statistics-dashboard">
      <div class="stats-header">
        <h3>📊 Statistiques du mur</h3>
        <button class="btn-icon" onclick="toggleStatistics()" title="Fermer">✕</button>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${stats.totalCartes}</div>
          <div class="stat-label">📌 Cartes</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #10b981;">✅ ${stats.approved}</div>
          <div class="stat-label">Approuvées</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #f59e0b;">⏳ ${stats.pending}</div>
          <div class="stat-label">En attente</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #ef4444;">⚠️ ${stats.overdue}</div>
          <div class="stat-label">Dépassées</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #f97316;">⏰ ${stats.deadlineToday}</div>
          <div class="stat-label">Échéance aujourd'hui</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #06b6d4;">📅 ${stats.deadlineSoon}</div>
          <div class="stat-label">Sous 3 jours</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">💬 ${stats.totalComments}</div>
          <div class="stat-label">Commentaires</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #ef4444;">❤️ ${stats.totalLikes}</div>
          <div class="stat-label">Likes</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #8b5cf6;">📦 ${stats.cartesArchived}</div>
          <div class="stat-label">Archivées</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #7c3aed;">🏛️ ${stats.cartesCodir}</div>
          <div class="stat-label">CODIR</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div class="stats-section">
          <h4>📁 Répartition par catégorie</h4>
          ${categoryBars || '<p style="color: var(--text-secondary);">Aucune catégorie</p>'}
        </div>

        <div class="stats-section">
          <h4>🎯 Priorités</h4>
          <div class="priority-breakdown">
            <div class="priority-item">
              <span class="priority-dot" style="background: #10b981;"></span>
              <span style="flex: 1;">Basse</span>
              <strong>${stats.cartesByPriority.basse}</strong>
              <small style="color: var(--text-muted); width: 36px; text-align: right;">${Math.round(stats.cartesByPriority.basse / totalPriority * 100)}%</small>
            </div>
            <div class="priority-item">
              <span class="priority-dot" style="background: #f59e0b;"></span>
              <span style="flex: 1;">Moyenne</span>
              <strong>${stats.cartesByPriority.moyenne}</strong>
              <small style="color: var(--text-muted); width: 36px; text-align: right;">${Math.round(stats.cartesByPriority.moyenne / totalPriority * 100)}%</small>
            </div>
            <div class="priority-item">
              <span class="priority-dot" style="background: #ef4444;"></span>
              <span style="flex: 1;">Haute</span>
              <strong>${stats.cartesByPriority.haute}</strong>
              <small style="color: var(--text-muted); width: 36px; text-align: right;">${Math.round(stats.cartesByPriority.haute / totalPriority * 100)}%</small>
            </div>
            <div class="priority-item">
              <span class="priority-dot" style="background: #dc2626;"></span>
              <span style="flex: 1;">Urgente</span>
              <strong>${stats.cartesByPriority.urgente}</strong>
              <small style="color: var(--text-muted); width: 36px; text-align: right;">${Math.round(stats.cartesByPriority.urgente / totalPriority * 100)}%</small>
            </div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div class="stats-section">
          <h4>✍️ Top contributeurs</h4>
          ${authorBars || '<p style="color: var(--text-secondary);">Aucun auteur</p>'}
        </div>

        <div class="stats-section">
          <h4>👤 Responsables</h4>
          ${topResponsables.length > 0 ? `
            <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
              <span style="background: rgba(102, 126, 234, 0.1); color: var(--accent-primary); padding: 4px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 500;">
                ✅ Assignées: ${stats.cartesWithResponsable}
              </span>
              <span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 4px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 500;">
                ❌ Non assignées: ${stats.cartesWithoutResponsable}
              </span>
            </div>
            ${responsableBars}
          ` : `
            <p style="color: var(--text-secondary); font-size: 0.875rem;">Aucun responsable assigné</p>
            <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">${stats.totalCartes} carte(s) sans responsable</p>
          `}
        </div>
      </div>

      <div class="stats-section">
        <h4>🏷️ Tags populaires</h4>
        <div class="tags-list">
          ${tagsList || '<p style="color: var(--text-secondary);">Aucun tag utilisé</p>'}
        </div>
      </div>

      <div class="stats-section">
        <h4>📎 Contenu des cartes</h4>
        <div class="priority-breakdown">
          <div class="priority-item">
            <span>🖼️</span>
            <span style="flex: 1;">Avec image</span>
            <strong>${stats.cartesWithImage}</strong>
          </div>
          <div class="priority-item">
            <span>🔗</span>
            <span style="flex: 1;">Avec lien</span>
            <strong>${stats.cartesWithLink}</strong>
          </div>
          <div class="priority-item">
            <span>📎</span>
            <span style="flex: 1;">Pièces jointes</span>
            <strong>${stats.cartesWithAttachment}</strong>
          </div>
          <div class="priority-item">
            <span>🏷️</span>
            <span style="flex: 1;">Tags distincts</span>
            <strong>${Object.keys(stats.tags).length}</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==================== TAGS MANAGEMENT ====================
function getTagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899'];
  return colors[Math.abs(hash) % colors.length];
}

async function addTagToCarte(carteId, tag) {
  const carte = state.cartes.find(c => c.id === carteId);
  if (!carte) return;

  const tags = carte.Tags ? carte.Tags.split(',').map(t => t.trim()) : [];
  if (!tags.includes(tag)) {
    tags.push(tag);
    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Cartes', carteId, { Tags: tags.join(', ') }]
    ]);
    showToast(`Tag "${tag}" ajouté !`, 'success');
    await fetchAllData(true);
  }
}

async function removeTagFromCarte(carteId, tag) {
  const carte = state.cartes.find(c => c.id === carteId);
  if (!carte) return;

  const tags = carte.Tags ? carte.Tags.split(',').map(t => t.trim()).filter(t => t !== tag) : [];
  await grist.docApi.applyUserActions([
    ['UpdateRecord', 'Cartes', carteId, { Tags: tags.join(', ') }]
  ]);
  showToast(`Tag "${tag}" supprimé !`, 'success');
  await fetchAllData(true);
}

function filterByTag(tag) {
  state.filterTag = tag;
  renderBoard();
}

// ==================== ARCHIVAGE ====================
async function archiveCarte(carteId) {
  try {
    const carte = state.cartes.find(c => c.id === carteId);
    if (!carte) return;

    const author = state.currentPseudo || 'Anonyme';
    const historique = carte.Historique || '';
    const entry = `[${new Date().toLocaleString('fr-FR')}] ${author} - Archivage de la carte`;

    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Cartes', carteId, {
        Archive: true,
        Historique: historique ? historique + '\n' + entry : entry
      }]
    ]);
    showToast('Carte archivée 📦', 'success');
    closeModal();
    await fetchAllData(true);
  } catch (err) {
    console.error('Erreur archivage:', err);
    showToast('Erreur lors de l\'archivage', 'error');
  }
}

async function unarchiveCarte(carteId) {
  try {
    const carte = state.cartes.find(c => c.id === carteId);
    if (!carte) return;

    const author = state.currentPseudo || 'Anonyme';
    const historique = carte.Historique || '';
    const entry = `[${new Date().toLocaleString('fr-FR')}] ${author} - Désarchivage de la carte`;

    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Cartes', carteId, {
        Archive: false,
        Historique: historique ? historique + '\n' + entry : entry
      }]
    ]);
    showToast('Carte désarchivée ✅', 'success');
    await fetchAllData(true);
  } catch (err) {
    console.error('Erreur désarchivage:', err);
    showToast('Erreur lors du désarchivage', 'error');
  }
}

function toggleArchives() {
  state.showArchives = !state.showArchives;
  if (state.showArchives) { state.showCodir = false; state.showCalendar = false; }
  render();
}

function toggleCodir() {
  state.showCodir = !state.showCodir;
  if (state.showCodir) { state.showArchives = false; state.showCalendar = false; }
  render();
}

function toggleCalendar() {
  state.showCalendar = !state.showCalendar;
  if (state.showCalendar) { state.showArchives = false; state.showCodir = false; }
  render();
}

async function toggleCodirCarte(carteId) {
  const carte = state.cartes.find(c => c.id === carteId);
  if (!carte) return;

  const newValue = !carte.Codir;
  const author = state.currentPseudo || 'Anonyme';
  const historique = carte.Historique || '';
  const action = newValue ? 'Ajout au CODIR' : 'Retrait du CODIR';
  const entry = `[${new Date().toLocaleString('fr-FR')}] ${author} - ${action}`;
  const newHistorique = historique ? historique + '\n' + entry : entry;

  try {
    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Cartes', carteId, { Codir: newValue, Historique: newHistorique }]
    ]);
    showToast(newValue ? 'Carte ajoutée au CODIR 🏛️' : 'Carte retirée du CODIR', 'success');
    await fetchAllData(true);
  } catch (err) {
    console.error('Erreur toggle CODIR:', err);
    showToast('Erreur lors de la mise à jour', 'error');
  }
}

function renderCodirPanel() {
  const codirCartes = state.cartes.filter(c => c.Codir === true && c.Archive !== true);
  const categoryNames = {};
  const categoryColors = {};
  const categoryIcons = {};
  state.categories.forEach(cat => {
    categoryNames[cat.id] = cat.Nom;
    categoryColors[cat.id] = cat.Couleur || '#6366f1';
    categoryIcons[cat.id] = cat.Icone || '📁';
  });

  if (codirCartes.length === 0) {
    return `
      <div class="archives-panel" style="border-left: 4px solid #8b5cf6;">
        <div class="archives-header">
          <h3>🏛️ Ordre du jour — CODIR</h3>
          <button class="btn-icon" onclick="toggleCodir()" title="Fermer">✕</button>
        </div>
        <div class="empty-state" style="padding: 40px 20px;">
          <div class="empty-state-icon">🏛️</div>
          <p>Aucune carte sélectionnée pour le CODIR</p>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">Activez le toggle CODIR sur les cartes à évoquer en Comité de Direction</p>
        </div>
      </div>
    `;
  }

  // Grouper par catégorie et trier par priorité
  const priorityOrder = { urgente: 0, haute: 1, moyenne: 2, basse: 3 };
  const groupedByCategory = {};
  codirCartes.forEach(c => {
    const catId = c.Categorie;
    if (!groupedByCategory[catId]) groupedByCategory[catId] = [];
    groupedByCategory[catId].push(c);
  });

  // Trier chaque groupe par priorité
  Object.values(groupedByCategory).forEach(cartes => {
    cartes.sort((a, b) => (priorityOrder[a.Priorite] || 2) - (priorityOrder[b.Priorite] || 2));
  });

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const sections = Object.entries(groupedByCategory).map(([catId, cartes]) => {
    const catName = categoryNames[catId] || 'Sans catégorie';
    const catColor = categoryColors[catId] || '#6366f1';
    const catIcon = categoryIcons[catId] || '📁';
    return `
      <div class="archives-category">
        <h4 style="display: flex; align-items: center; gap: 8px; margin: 0 0 12px 0; color: var(--text-primary);">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${catColor}; display: inline-block;"></span>
          ${catIcon} ${escapeHtml(catName)} <small style="color: var(--text-muted);">(${cartes.length})</small>
        </h4>
        <div class="archives-cards-grid">
          ${cartes.map((carte, idx) => {
            const priorityInfo = PRIORITY_LEVELS[carte.Priorite] || PRIORITY_LEVELS.moyenne;
            const deadlineInfo = carte.Deadline ? formatDeadline(carte.Deadline) : null;
            return `
              <div class="archive-card" style="border-left: 3px solid ${catColor}; cursor: pointer;" onclick="handleCardClick(event, ${carte.id})">
                <div class="archive-card-content">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <div style="flex: 1; min-width: 0;">
                      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                        <span style="background: ${priorityInfo.color}20; color: ${priorityInfo.color}; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${priorityInfo.icon} ${priorityInfo.label}</span>
                        ${deadlineInfo ? `<span style="background: ${deadlineInfo.color}20; color: ${deadlineInfo.color}; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${deadlineInfo.icon} ${deadlineInfo.text}</span>` : ''}
                      </div>
                      <h4 style="margin: 0 0 4px 0; font-size: 0.9rem; color: var(--text-primary);">${escapeHtml(carte.Titre)}</h4>
                      <div style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: var(--text-muted); flex-wrap: wrap;">
                        <span>✍️ ${escapeHtml(carte.Auteur || 'Anonyme')}</span>
                        ${carte.Responsable ? `<span>👤 ${escapeHtml(carte.Responsable)}</span>` : ''}
                      </div>
                    </div>
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); toggleCodirCarte(${carte.id})" title="Retirer du CODIR" style="padding: 4px 8px; font-size: 0.75rem; flex-shrink: 0;">❌</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="archives-panel" style="border-left: 4px solid #8b5cf6;">
      <div class="archives-header">
        <h3>🏛️ Ordre du jour — CODIR <small style="color: var(--text-muted); font-weight: 400;">(${codirCartes.length} sujet${codirCartes.length > 1 ? 's' : ''})</small></h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="btn btn-sm btn-primary" onclick="exportCodirPDF()" style="font-size: 0.75rem; padding: 4px 12px;">📋 Exporter l'ordre du jour</button>
          <button class="btn-icon" onclick="toggleCodir()" title="Fermer">✕</button>
        </div>
      </div>
      <div style="padding: 0 24px 12px; color: var(--text-muted); font-size: 0.85rem;">
        📅 ${today}
      </div>
      ${sections}
    </div>
  `;
}

function renderCalendarPanel() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const userName = state.currentPseudo || '';
  const userEmail = (state.currentEmail || '').toLowerCase();

  // Filtrer les cartes de l'utilisateur (auteur OU responsable)
  const myCartes = state.cartes.filter(c => {
    if (c.Archive === true) return false;
    const isAuthor = (c.Auteur && c.Auteur === userName) || (c.Auteur_Pseudo && c.Auteur_Pseudo === userName);
    const isResponsable = c.Responsable && c.Responsable === userName;
    return isAuthor || isResponsable;
  });

  // Helper pour parser une deadline et obtenir un Date
  function parseDeadlineDate(dateStr) {
    if (!dateStr) return null;
    let ts = parseFloat(dateStr);
    if (ts < 10000000000) ts = ts * 1000;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }

  // Grouper par période
  const groups = {
    overdue: { label: '🔴 En retard', color: '#ef4444', cards: [] },
    today: { label: '🟠 Aujourd\'hui', color: '#f59e0b', cards: [] },
    tomorrow: { label: '🔵 Demain', color: '#3b82f6', cards: [] },
    thisWeek: { label: '🟢 Cette semaine', color: '#22c55e', cards: [] },
    nextWeek: { label: '📆 Semaine prochaine', color: '#8b5cf6', cards: [] },
    later: { label: '⏳ Plus tard', color: '#6b7280', cards: [] },
    noDeadline: { label: '📌 Sans échéance', color: '#9ca3af', cards: [] }
  };

  myCartes.forEach(c => {
    const dDate = parseDeadlineDate(c.Deadline);
    if (!dDate) {
      groups.noDeadline.cards.push(c);
      return;
    }
    const dd = new Date(dDate); dd.setHours(0,0,0,0);
    const diff = Math.floor((dd - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) groups.overdue.cards.push(c);
    else if (diff === 0) groups.today.cards.push(c);
    else if (diff === 1) groups.tomorrow.cards.push(c);
    else if (diff <= 7) groups.thisWeek.cards.push(c);
    else if (diff <= 14) groups.nextWeek.cards.push(c);
    else groups.later.cards.push(c);
  });

  // Trier chaque groupe par deadline puis priorité
  const priorityOrder = { urgente: 0, haute: 1, moyenne: 2, basse: 3 };
  Object.values(groups).forEach(g => {
    g.cards.sort((a, b) => {
      const dA = parseDeadlineDate(a.Deadline);
      const dB = parseDeadlineDate(b.Deadline);
      if (dA && dB) return dA - dB;
      if (dA) return -1;
      if (dB) return 1;
      return (priorityOrder[a.Priorite] || 2) - (priorityOrder[b.Priorite] || 2);
    });
  });

  const categoryNames = {};
  const categoryColors = {};
  const categoryIcons = {};
  state.categories.forEach(cat => {
    categoryNames[cat.id] = cat.Nom;
    categoryColors[cat.id] = cat.Couleur || '#6366f1';
    categoryIcons[cat.id] = cat.Icone || '📁';
  });

  const totalCards = myCartes.length;
  const overdueCount = groups.overdue.cards.length;
  const todayCount = groups.today.cards.length;

  if (totalCards === 0) {
    return `
      <div class="archives-panel calendar-panel" style="border-left: 4px solid #3b82f6;">
        <div class="archives-header">
          <h3>📅 Mon calendrier</h3>
          <button class="btn-icon" onclick="toggleCalendar()" title="Fermer">✕</button>
        </div>
        <div class="empty-state" style="padding: 40px 20px;">
          <div class="empty-state-icon">📅</div>
          <p>Aucune carte vous est assignée</p>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">Les cartes où vous êtes auteur ou responsable apparaîtront ici</p>
        </div>
      </div>
    `;
  }

  // Badge résumé
  const summaryParts = [];
  if (overdueCount) summaryParts.push(`<span style="background: #ef444420; color: #ef4444; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">🔴 ${overdueCount} en retard</span>`);
  if (todayCount) summaryParts.push(`<span style="background: #f59e0b20; color: #f59e0b; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">🟠 ${todayCount} aujourd'hui</span>`);
  summaryParts.push(`<span style="background: var(--bg-card); color: var(--text-muted); padding: 3px 10px; border-radius: 12px; font-size: 0.8rem;">${totalCards} carte${totalCards > 1 ? 's' : ''} au total</span>`);

  const sections = Object.entries(groups)
    .filter(([, g]) => g.cards.length > 0)
    .map(([key, g]) => {
      const cards = g.cards.map(carte => {
        const catColor = categoryColors[carte.Categorie] || '#6366f1';
        const catName = categoryNames[carte.Categorie] || 'Sans catégorie';
        const catIcon = categoryIcons[carte.Categorie] || '📁';
        const priorityInfo = PRIORITY_LEVELS[carte.Priorite] || PRIORITY_LEVELS.moyenne;
        const deadlineInfo = carte.Deadline ? formatDeadline(carte.Deadline) : null;
        const deadlineDateObj = parseDeadlineDate(carte.Deadline);
        const deadlineDateStr = deadlineDateObj ? deadlineDateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
        const role = carte.Responsable === userName ? '👤 Responsable' : '✍️ Auteur';

        return `
          <div class="archive-card calendar-card" style="border-left: 3px solid ${catColor}; cursor: pointer;" onclick="handleCardClick(event, ${carte.id})">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
                  <span style="background: ${priorityInfo.color}20; color: ${priorityInfo.color}; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${priorityInfo.icon} ${priorityInfo.label}</span>
                  <span style="background: ${catColor}20; color: ${catColor}; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 500;">${catIcon} ${escapeHtml(catName)}</span>
                  ${deadlineInfo ? `<span style="background: ${deadlineInfo.color}20; color: ${deadlineInfo.color}; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${deadlineInfo.icon} ${deadlineInfo.text}</span>` : ''}
                </div>
                <h4 style="margin: 0 0 4px 0; font-size: 0.9rem; color: var(--text-primary);">${escapeHtml(carte.Titre)}</h4>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: var(--text-muted); flex-wrap: wrap;">
                  <span>${role}</span>
                  ${deadlineDateStr ? `<span>📅 ${deadlineDateStr}</span>` : ''}
                  ${carte.Codir ? '<span style="color: #8b5cf6;">🏛️ CODIR</span>' : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="archives-category" style="margin-bottom: 16px;">
          <h4 style="display: flex; align-items: center; gap: 8px; margin: 0 0 10px 0; color: ${g.color}; font-size: 0.95rem;">
            ${g.label} <span style="background: ${g.color}20; color: ${g.color}; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">${g.cards.length}</span>
          </h4>
          <div class="archives-cards-grid">${cards}</div>
        </div>
      `;
    }).join('');

  return `
    <div class="archives-panel calendar-panel" style="border-left: 4px solid #3b82f6;">
      <div class="archives-header">
        <h3>📅 Mon calendrier <small style="color: var(--text-muted); font-weight: 400;">(${userName})</small></h3>
        <button class="btn-icon" onclick="toggleCalendar()" title="Fermer">✕</button>
      </div>
      <div style="padding: 0 24px 16px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        ${summaryParts.join('')}
      </div>
      ${sections}
    </div>
  `;
}

function exportCodirPDF() {
  const codirCartes = state.cartes.filter(c => c.Codir === true && c.Archive !== true);
  const categoryNames = {};
  const categoryIcons = {};
  state.categories.forEach(cat => {
    categoryNames[cat.id] = cat.Nom;
    categoryIcons[cat.id] = cat.Icone || '';
  });

  const priorityOrder = { urgente: 0, haute: 1, moyenne: 2, basse: 3 };
  const groupedByCategory = {};
  codirCartes.forEach(c => {
    const catId = c.Categorie;
    if (!groupedByCategory[catId]) groupedByCategory[catId] = [];
    groupedByCategory[catId].push(c);
  });
  Object.values(groupedByCategory).forEach(cartes => {
    cartes.sort((a, b) => (priorityOrder[a.Priorite] || 2) - (priorityOrder[b.Priorite] || 2));
  });

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const priorityLabels = { urgente: '🔴 URGENT', haute: '🟠 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' };

  let html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>CODIR - Ordre du jour</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a2e; }
    h1 { text-align: center; color: #1a1a2e; border-bottom: 3px solid #8b5cf6; padding-bottom: 16px; }
    .date { text-align: center; color: #666; margin-bottom: 32px; font-size: 1.1rem; }
    .category { margin-bottom: 28px; }
    .category h2 { color: #1a1a2e; font-size: 1.2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    .card-item { padding: 12px 16px; margin: 8px 0; background: #f9fafb; border-radius: 8px; border-left: 3px solid #8b5cf6; }
    .card-title { font-weight: 600; font-size: 1rem; margin-bottom: 4px; }
    .card-info { font-size: 0.85rem; color: #666; display: flex; gap: 16px; flex-wrap: wrap; }
    .priority { font-size: 0.8rem; font-weight: 600; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 0.8rem; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    @media print { body { padding: 20px; } }
  </style></head><body>
  <h1>🏛️ Comité de Direction — Ordre du jour</h1>
  <div class="date">📅 ${today}</div>
  <p style="text-align: center; color: #666; margin-bottom: 32px;">${codirCartes.length} sujet${codirCartes.length > 1 ? 's' : ''} à l'ordre du jour</p>`;

  let itemNum = 1;
  Object.entries(groupedByCategory).forEach(([catId, cartes]) => {
    const catName = categoryNames[catId] || 'Sans catégorie';
    const catIcon = categoryIcons[catId] || '';
    html += `<div class="category"><h2>${catIcon} ${catName}</h2>`;
    cartes.forEach(carte => {
      const priorityLabel = priorityLabels[carte.Priorite] || '🟡 Moyenne';
      const deadline = carte.Deadline ? new Date(parseFloat(carte.Deadline) * 1000).toLocaleDateString('fr-FR') : '';
      html += `<div class="card-item">
        <div class="card-title">${itemNum}. ${carte.Titre}</div>
        <div class="card-info">
          <span class="priority">${priorityLabel}</span>
          <span>✍️ ${carte.Auteur || 'Anonyme'}</span>
          ${carte.Responsable ? `<span>👤 ${carte.Responsable}</span>` : ''}
          ${deadline ? `<span>📅 Échéance: ${deadline}</span>` : ''}
        </div>
      </div>`;
      itemNum++;
    });
    html += `</div>`;
  });

  html += `<div class="footer"><a href="https://github.com/MrKuBe/iziWall" target="_blank" style="color: #8b5cf6; text-decoration: none; font-weight: 700;">iziWall</a> • Vibe codé par <a href="https://github.com/MrKuBe" target="_blank" style="color: #8b5cf6; text-decoration: none; font-weight: 600;">Bertrand Kuzbinski</a> avec <strong>Claude</strong> • v2.1.20260303 — ${today}</div></body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `codir-ordre-du-jour-${new Date().toISOString().split('T')[0]}.html`;
  link.click();

  showToast('Ordre du jour CODIR exporté ! 📋', 'success');
}

function renderArchivesPanel() {
  const archivedCartes = state.cartes.filter(c => c.Archive === true);
  const categoryNames = {};
  const categoryColors = {};
  state.categories.forEach(cat => {
    categoryNames[cat.id] = cat.Nom;
    categoryColors[cat.id] = cat.Couleur || '#6366f1';
  });

  if (archivedCartes.length === 0) {
    return `
      <div class="archives-panel">
        <div class="archives-header">
          <h3>📦 Archives</h3>
          <button class="btn-icon" onclick="toggleArchives()" title="Fermer">✕</button>
        </div>
        <div class="empty-state" style="padding: 40px 20px;">
          <div class="empty-state-icon">📭</div>
          <p>Aucune carte archivée</p>
        </div>
      </div>
    `;
  }

  const groupedByCategory = {};
  archivedCartes.forEach(c => {
    const catId = c.Categorie;
    if (!groupedByCategory[catId]) groupedByCategory[catId] = [];
    groupedByCategory[catId].push(c);
  });

  const sections = Object.entries(groupedByCategory).map(([catId, cartes]) => {
    const catName = categoryNames[catId] || 'Sans catégorie';
    const catColor = categoryColors[catId] || '#6366f1';
    return `
      <div class="archives-category">
        <h4 style="display: flex; align-items: center; gap: 8px; margin: 0 0 12px 0; color: var(--text-primary);">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${catColor}; display: inline-block;"></span>
          ${escapeHtml(catName)} <small style="color: var(--text-muted);">(${cartes.length})</small>
        </h4>
        <div class="archives-cards-grid">
          ${cartes.map(carte => {
            const avatarColor = generateColor(carte.Auteur || 'Anonyme');
            return `
              <div class="archive-card" style="border-left: 3px solid ${catColor};">
                <div class="archive-card-content">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                    <div style="flex: 1; min-width: 0;">
                      <h4 style="margin: 0 0 4px 0; font-size: 0.9rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(carte.Titre)}</h4>
                      <div style="display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--text-muted);">
                        <span class="avatar" style="width: 18px; height: 18px; font-size: 0.55rem; background: ${avatarColor};">${getInitials(carte.Auteur || 'AN')}</span>
                        ${escapeHtml(carte.Auteur || 'Anonyme')}
                        ${carte.Responsable ? `<span style="margin-left: 4px;">👤 ${escapeHtml(carte.Responsable)}</span>` : ''}
                      </div>
                    </div>
                    <div style="display: flex; gap: 4px; flex-shrink: 0;">
                      <button class="btn btn-sm btn-secondary" onclick="unarchiveCarte(${carte.id})" title="Désarchiver" style="padding: 4px 8px; font-size: 0.75rem;">♻️ Restaurer</button>
                      <button class="btn btn-sm btn-secondary" onclick="handleCardClick(event, ${carte.id})" title="Voir" style="padding: 4px 8px; font-size: 0.75rem;">👁️</button>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="archives-panel">
      <div class="archives-header">
        <h3>📦 Archives <small style="color: var(--text-muted); font-weight: 400;">(${archivedCartes.length} carte${archivedCartes.length > 1 ? 's' : ''})</small></h3>
        <button class="btn-icon" onclick="toggleArchives()" title="Fermer">✕</button>
      </div>
      ${sections}
    </div>
  `;
}

// ==================== HISTORIQUE ====================
async function addHistoryEntry(carteId, action, details) {
  const carte = state.cartes.find(c => c.id === carteId);
  if (!carte) return;

  const timestamp = new Date().toLocaleString('fr-FR');
  const author = state.currentPseudo || 'Anonyme';
  const entry = `[${timestamp}] ${author} - ${action}: ${details}`;
  
  const historique = carte.Historique ? carte.Historique + '\n' + entry : entry;
  
  try {
    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Cartes', carteId, { Historique: historique }]
    ]);
  } catch (err) {
    console.error('Erreur historique:', err);
  }
}

async function editCommentaire(commentaireId, newContenu) {
  const commentaire = state.commentaires.find(c => c.id === commentaireId);
  if (!commentaire) return;

  const isOwn = commentaire.Pseudo === state.currentPseudo;
  if (!isOwn && !state.isAdmin) {
    showToast('Vous ne pouvez éditer que vos propres commentaires', 'error');
    return;
  }

  try {
    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Commentaires', commentaireId, { 
        Contenu: newContenu,
        DateCommentaire: toGristDateTime()
      }]
    ]);
    showToast('Commentaire modifié !', 'success');
    await fetchAllData(true);
  } catch (err) {
    console.error('Erreur édition commentaire:', err);
    showToast('Erreur lors de la modification', 'error');
  }
}

async function deleteCommentaire(commentaireId) {
  if (!confirm('Supprimer ce commentaire ?')) return;

  try {
    await grist.docApi.applyUserActions([
      ['RemoveRecord', 'Commentaires', commentaireId]
    ]);
    showToast('Commentaire supprimé !', 'success');
    await fetchAllData(true);
  } catch (err) {
    console.error('Erreur suppression commentaire:', err);
    showToast('Erreur lors de la suppression', 'error');
  }
}

// ==================== EXPORT & PARTAGE ====================
function exportToCSV() {
  const stats = getStatistics();
  const categoryNames = {};
  state.categories.forEach(cat => categoryNames[cat.id] = cat.Nom);

  let csv = 'Titre,Catégorie,Auteur,Responsable,Priorité,Deadline,Tags,Approuvée,Archivée,CODIR,Likes,Commentaires\n';

  state.cartes.forEach(carte => {
    const likes = state.likes.filter(l => l.Carte === carte.id).length;
    const comments = state.commentaires.filter(c => c.Carte === carte.id).length;
    const deadline = carte.Deadline ? new Date(parseFloat(carte.Deadline) * 1000).toLocaleDateString('fr-FR') : '';

    csv += `"${carte.Titre.replace(/"/g, '""')}","${categoryNames[carte.Categorie] || ''}","${carte.Auteur}","${carte.Responsable || ''}","${carte.Priorite || 'moyenne'}","${deadline}","${carte.Tags || ''}","${carte.Approuve ? 'Oui' : 'Non'}","${carte.Archive ? 'Oui' : 'Non'}","${carte.Codir ? 'Oui' : 'Non'}",${likes},${comments}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `mur-collaboratif-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();

  showToast('Exporté en CSV ! 📥', 'success');
}

function generateShareLink() {
  // Construire l'URL du document Grist (pas l'URL du widget)
  let docUrl = '';
  if (state.attachmentBaseUrl) {
    // attachmentBaseUrl est de la forme https://host/api/docs/DOCID
    // L'URL du document est https://host/o/docs/DOCID ou simplement https://host/doc/DOCID
    const match = state.attachmentBaseUrl.match(/^(https?:\/\/[^/]+)\/api\/docs\/([^/]+)/);
    if (match) {
      docUrl = `${match[1]}/doc/${match[2]}`;
    }
  }

  // Fallback si on n'a pas pu construire l'URL du document
  if (!docUrl) {
    // Tenter via le parent frame
    try { docUrl = window.parent.location.href; } catch (e) { docUrl = ''; }
  }

  const filters = {
    search: state.searchQuery,
    author: state.filterAuthor,
    priority: state.filterPriority,
    tag: state.filterTag || '',
    responsable: state.filterResponsable
  };

  const queryString = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  return docUrl || window.location.href.split('?')[0];
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copié dans le presse-papiers ! 📋', 'success');
  }).catch(err => {
    console.error('Erreur copie:', err);
    showToast('Erreur lors de la copie', 'error');
  });
}

function shareCurrentView() {
  const shareUrl = generateShareLink();
  copyToClipboard(shareUrl);
}

// ==================== CATEGORY ACTIONS ====================
async function addCategory(nom, couleur, icone) {
  try {
    const maxOrdre = state.categories.reduce((max, c) => Math.max(max, c.Ordre || 0), 0);
    await grist.docApi.applyUserActions([
      ['AddRecord', 'Categories', null, {
        Nom: nom,
        Couleur: couleur,
        Icone: icone,
        Ordre: maxOrdre + 1
      }]
    ]);
    showToast('Catégorie créée !', 'success');
    await fetchAllData(true);
    closeModal();
  } catch (err) {
    console.error('Erreur ajout catégorie:', err);
    alert('Erreur lors de l\'ajout de la catégorie');
  }
}

async function updateCategory(categoryId, nom, couleur, icone) {
  try {
    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Categories', categoryId, {
        Nom: nom,
        Couleur: couleur,
        Icone: icone
      }]
    ]);
    showToast('Catégorie modifiée !', 'success');
    await fetchAllData(true);
    closeModal();
  } catch (err) {
    console.error('Erreur modification catégorie:', err);
    alert('Erreur lors de la modification de la catégorie');
  }
}

async function deleteCategory(categoryId) {
  const cardsInCategory = state.cartes.filter(c => c.Categorie === categoryId);
  if (cardsInCategory.length > 0) {
    alert(`Impossible de supprimer cette catégorie : elle contient ${cardsInCategory.length} carte(s).`);
    return;
  }
  
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;
  
  try {
    await grist.docApi.applyUserActions([
      ['RemoveRecord', 'Categories', categoryId]
    ]);
    showToast('Catégorie supprimée', 'success');
    await fetchAllData(true);
    closeModal();
  } catch (err) {
    console.error('Erreur suppression catégorie:', err);
    alert('Erreur lors de la suppression de la catégorie');
  }
}

// ==================== CARD ACTIONS ====================
async function addCarte(categorieId, titre, contenu, imageUrl, lienExterne, priorite, deadline, tags = '', responsable = '') {
  const pseudo = state.currentPseudo || 'Anonyme';
  try {
    const record = {
      Titre: titre,
      Contenu: contenu,
      Auteur: pseudo,
      Auteur_Pseudo: pseudo,
      Session_ID: state.sessionId,
      Approuve: false,
      Categorie: categorieId,
      DateCreation: toGristDateTime(),
      Ordre: state.cartes.filter(c => c.Categorie === categorieId).length + 1,
      Priorite: buildChoiceList(priorite || 'moyenne'),
      Deadline: deadline || null,
      Tags: tags,
      Responsable: responsable || null,
      Historique: `[${new Date().toLocaleString('fr-FR')}] ${pseudo} - Création: Nouvelle carte`
    };
    if (imageUrl) record.ImageURL = imageUrl;
    if (lienExterne) record.LienExterne = lienExterne;

    await grist.docApi.applyUserActions([
      ['AddRecord', 'Cartes', null, record]
    ]);

    if (state.moderationActive) {
      showToast('Carte créée ! En attente d\'approbation.', 'success');
    } else {
      showToast('Carte créée !', 'success');
    }

    await fetchAllData(true);
    closeModal();
  } catch (err) {
    console.error('Erreur ajout carte:', err);
    alert('Erreur lors de l\'ajout de la carte');
  }
}

async function updateCarte(carteId, titre, contenu, imageUrl, lienExterne, categorieId, priorite, deadline, tags = '', responsable = '') {
  if (state.moderationActive && !state.isAdmin) {
    const carte = state.cartes.find(c => c.id === carteId);
    if (!carte) {
      showToast('Carte introuvable', 'error');
      return;
    }

    const isOwnCardByPseudo = state.currentPseudo && carte.Auteur_Pseudo === state.currentPseudo;
    const isOwnCardBySession = carte.Session_ID === state.sessionId;
    const isOwnCard = isOwnCardByPseudo || isOwnCardBySession;

    if (!isOwnCard) {
      showToast('Vous ne pouvez modifier que vos propres cartes', 'error');
      return;
    }
  }

  try {
    const carte = state.cartes.find(c => c.id === carteId);
    const changes = [];
    if (carte.Titre !== titre) changes.push(`Titre: "${carte.Titre}" → "${titre}"`);
    if (carte.Categorie !== categorieId) {
      const oldCat = state.categories.find(cat => cat.id === carte.Categorie);
      const newCat = state.categories.find(cat => cat.id === categorieId);
      changes.push(`Déplacement: "${oldCat ? oldCat.Nom : 'Inconnu'}" → "${newCat ? newCat.Nom : 'Inconnu'}"`);
    }
    if (carte.Priorite !== priorite) changes.push(`Priorité: "${carte.Priorite}" → "${priorite}"`);
    if (carte.Tags !== tags) changes.push(`Tags modifiés`);
    if (carte.Responsable !== responsable) changes.push(`Responsable: "${carte.Responsable || 'Aucun'}" → "${responsable || 'Aucun'}"`);

    const record = {
      Titre: titre,
      Contenu: contenu,
      Categorie: categorieId,
      Priorite: buildChoiceList(priorite || 'moyenne'),
      Tags: tags,
      Responsable: responsable || null
    };
    
    if (imageUrl !== undefined) record.ImageURL = imageUrl || '';
    if (lienExterne !== undefined) record.LienExterne = lienExterne || '';
    if (deadline !== undefined) record.Deadline = deadline || null;

    const author = state.currentPseudo || 'Anonyme';
    const historique = carte.Historique || '';
    const entry = `[${new Date().toLocaleString('fr-FR')}] ${author} - Modification: ${changes.join(', ') || 'Contenu'}`;
    record.Historique = historique ? historique + '\n' + entry : entry;

    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Cartes', carteId, record]
    ]);
    showToast('Carte modifiée !', 'success');
    await fetchAllData(true);
    closeModal();
  } catch (err) {
    console.error('Erreur modification carte:', err);
    alert('Erreur lors de la modification de la carte');
  }
}

async function approveCard(carteId) {
  if (!state.isAdmin) {
    showToast('Action réservée aux administrateurs', 'error');
    return;
  }

  try {
    const carte = state.cartes.find(c => c.id === carteId);
    const author = state.currentPseudo || 'Anonyme';
    const historique = carte ? (carte.Historique || '') : '';
    const entry = `[${new Date().toLocaleString('fr-FR')}] ${author} - Approbation de la carte`;
    const newHistorique = historique ? historique + '\n' + entry : entry;

    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Cartes', carteId, { Approuve: true, Historique: newHistorique }]
    ]);
    showToast('Carte approuvée !', 'success');
    await fetchAllData(true);
  } catch (err) {
    console.error('Erreur approbation carte:', err);
    showToast('Erreur lors de l\'approbation', 'error');
  }
}

async function deleteCarte(carteId) {
  if (state.moderationActive && !state.isAdmin) {
    const carte = state.cartes.find(c => c.id === carteId);
    if (!carte) {
      showToast('Carte introuvable', 'error');
      return;
    }

    const isOwnCardByPseudo = state.currentPseudo && carte.Auteur_Pseudo === state.currentPseudo;
    const isOwnCardBySession = carte.Session_ID === state.sessionId;
    const isOwnCard = isOwnCardByPseudo || isOwnCardBySession;

    if (!isOwnCard) {
      showToast('Vous ne pouvez supprimer que vos propres cartes', 'error');
      return;
    }
  }

  if (!confirm('Êtes-vous sûr de vouloir supprimer cette carte ?')) return;

  try {
    const cardLikes = state.likes.filter(l => l.Carte === carteId);
    for (const like of cardLikes) {
      await grist.docApi.applyUserActions([['RemoveRecord', 'Likes', like.id]]);
    }

    const cardComments = state.commentaires.filter(c => c.Carte === carteId);
    for (const comment of cardComments) {
      await grist.docApi.applyUserActions([['RemoveRecord', 'Commentaires', comment.id]]);
    }

    await grist.docApi.applyUserActions([['RemoveRecord', 'Cartes', carteId]]);
    showToast('Carte supprimée', 'success');
    await fetchAllData(true);
    closeModal();
  } catch (err) {
    console.error('Erreur suppression carte:', err);
    alert('Erreur lors de la suppression de la carte');
  }
}

async function toggleLike(carteId) {
  const pseudo = state.currentPseudo || 'Anonyme';
  const existingLike = state.likes.find(l => l.Carte === carteId && l.Pseudo === pseudo);

  try {
    if (existingLike) {
      await grist.docApi.applyUserActions([['RemoveRecord', 'Likes', existingLike.id]]);
    } else {
      await grist.docApi.applyUserActions([
        ['AddRecord', 'Likes', null, {
          Carte: carteId,
          Pseudo: pseudo,
          DateLike: toGristDateTime()
        }]
      ]);
    }
    await fetchAllData(true);
  } catch (err) {
    console.error('Erreur like:', err);
  }
}

async function addCommentaire(carteId, contenu) {
  const pseudo = state.currentPseudo || 'Anonyme';
  try {
    await grist.docApi.applyUserActions([
      ['AddRecord', 'Commentaires', null, {
        Carte: carteId,
        Pseudo: pseudo,
        Contenu: contenu,
        DateCommentaire: toGristDateTime()
      }]
    ]);
    await fetchAllData(true);
  } catch (err) {
    console.error('Erreur commentaire:', err);
  }
}

// ==================== RENDER ====================
function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="header">
      <div class="header-title">
        <h1><span id="wall-emoji">${state.wallEmoji}</span> <span id="wall-title">${state.wallTitle}</span></h1>
        <span class="subtitle" id="wall-slogan">${state.wallSlogan}</span>
      </div>
      <div class="header-actions" id="header-actions">
        <div class="sync-indicator" id="sync-indicator">
          <span class="sync-dot"></span>
          <span>Connecté</span>
        </div>
      </div>
    </header>
    
    ${state.showStatistics ? renderStatisticsDashboard() : ''}
    ${state.showArchives ? renderArchivesPanel() : ''}
    ${state.showCodir ? renderCodirPanel() : ''}
    ${state.showCalendar ? renderCalendarPanel() : ''}
    
    <div class="board" id="board"></div>
    
    <div class="pseudo-input-container">
      ${state.currentPseudo ? `
        <div class="user-info">
          <div class="user-avatar" style="background: ${generateColor(state.currentPseudo)}">${getInitials(state.currentPseudo)}</div>
          <div class="user-details">
            <div class="user-name">${escapeHtml(state.currentPseudo)}</div>
            <div class="user-email">${escapeHtml(state.currentEmail || 'Utilisateur local')}</div>
            ${state.currentEntity ? `<div class="user-entity">📍 ${escapeHtml(state.currentEntity)}</div>` : ''}
          </div>
        </div>
      ` : `
        <div class="user-loading">
          <span class="spinner-small"></span>
          <span>Chargement des informations utilisateur...</span>
        </div>
      `}
    </div>
    
    <footer class="widget-footer">
      <div class="footer-content">
        <a href="https://github.com/MrKuBe/iziWall" target="_blank" rel="noopener noreferrer" class="footer-link" style="font-weight: 700;">iziWall</a>
        <span class="footer-separator">•</span>
        <span class="footer-credit">Vibe codé par <a href="https://github.com/MrKuBe" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary); text-decoration: none; font-weight: 600;"><strong>Bertrand Kuzbinski</strong></a> avec <strong>Claude</strong></span>
        <span class="footer-separator">•</span>
        <span class="footer-version">v2.1.20260303</span>
        <span class="footer-separator">•</span>
        <a href="https://podeduc.apps.education.fr/video/132080-grist-mur-collaboratif/" target="_blank" rel="noopener noreferrer" class="footer-link">
          📚 Inspiré du mur collaboratif
        </a>
      </div>
    </footer>
    
    <div class="modal-overlay" id="modal-overlay" onclick="handleModalOverlayClick(event)">
      <div class="modal" id="modal-content" onclick="event.stopPropagation()"></div>
    </div>
  `;
  
  renderHeader();
  renderBoard();
}

function updateSearch(query) {
  state.searchQuery = query.toLowerCase();
  renderBoard();
}

function filterByAuthor(author) {
  state.filterAuthor = author;
  renderBoard();
}

function filterByPriority(priority) {
  state.filterPriority = priority;
  renderBoard();
}

function filterByStatus(status) {
  state.filterStatus = status;
  renderBoard();
}

function filterByResponsable(responsable) {
  state.filterResponsable = responsable;
  renderBoard();
}

function updateWallTitle() {
  const emojiElement = document.getElementById('wall-emoji');
  const titleElement = document.getElementById('wall-title');
  const sloganElement = document.getElementById('wall-slogan');

  if (emojiElement) emojiElement.textContent = state.wallEmoji;
  if (titleElement) titleElement.textContent = state.wallTitle;
  if (sloganElement) sloganElement.textContent = state.wallSlogan;
}

function renderHeader() {
  const headerActions = document.getElementById('header-actions');
  if (!headerActions) return;

  const authors = [...new Set(state.cartes.map(c => c.Auteur_Pseudo || c.Auteur || 'Anonyme').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  const responsables = [...new Set(state.cartes.map(c => c.Responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  const allTags = [...new Set(state.cartes.flatMap(c => c.Tags ? c.Tags.split(',').map(t => t.trim()).filter(Boolean) : []))].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  headerActions.innerHTML = `
    <div class="search-input-wrapper">
      <input type="text" class="expandable-search" id="search-input" placeholder="🔍 Rechercher..." value="${state.searchQuery}" onkeyup="updateSearch(this.value)">
    </div>
    <select onchange="filterByAuthor(this.value)" style="font-size: 0.75rem; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: var(--text-primary); cursor: pointer;">
      <option value="">👥 Tous les auteurs</option>
      ${authors.map(author => `<option value="${author}" ${state.filterAuthor === author ? 'selected' : ''}>${author}</option>`).join('')}
    </select>
    <select onchange="filterByResponsable(this.value)" style="font-size: 0.75rem; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: var(--text-primary); cursor: pointer;">
      <option value="">👤 Tous les responsables</option>
      <option value="__none__" ${state.filterResponsable === '__none__' ? 'selected' : ''}>❌ Non assignées</option>
      ${responsables.map(r => `<option value="${escapeHtml(r)}" ${state.filterResponsable === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
    </select>
    <select onchange="filterByPriority(this.value)" style="font-size: 0.75rem; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: var(--text-primary); cursor: pointer;">
      <option value="">📊 Toutes les priorités</option>
      <option value="basse" ${state.filterPriority === 'basse' ? 'selected' : ''}>⬇️ Basse</option>
      <option value="moyenne" ${state.filterPriority === 'moyenne' ? 'selected' : ''}>➡️ Moyenne</option>
      <option value="haute" ${state.filterPriority === 'haute' ? 'selected' : ''}>⬆️ Haute</option>
      <option value="urgente" ${state.filterPriority === 'urgente' ? 'selected' : ''}>🔴 Urgente</option>
    </select>
    <select onchange="filterByTag(this.value)" style="font-size: 0.75rem; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: var(--text-primary); cursor: pointer;">
      <option value="">🏷️ Tous les tags</option>
      ${allTags.map(tag => `<option value="${escapeHtml(tag)}" ${state.filterTag === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}
    </select>
    <button class="btn-icon" onclick="toggleCalendar()" title="Mon calendrier" style="${state.showCalendar ? 'background: rgba(59, 130, 246, 0.2); color: #3b82f6;' : ''}">📅</button>
    <button class="btn-icon" onclick="toggleStatistics()" title="Statistiques">📊</button>
    <button class="btn-icon" onclick="toggleArchives()" title="Archives" style="${state.showArchives ? 'background: rgba(102, 126, 234, 0.2); color: var(--accent-primary);' : ''}">📦</button>
    <button class="btn-icon" onclick="toggleCodir()" title="CODIR - Ordre du jour" style="${state.showCodir ? 'background: rgba(139, 92, 246, 0.2); color: #8b5cf6;' : ''}">🏛️</button>
    <button class="btn-icon" onclick="exportToCSV()" title="Exporter en CSV">📥</button>
    ${state.isAdmin ? `
      <button class="btn ${state.moderationActive ? 'btn-warning' : 'btn-secondary'}" onclick="toggleModeration()" style="font-size: 0.75rem; padding: 6px 12px;">
        ${state.moderationActive ? '🔒 Modération ON' : '🔓 Modération OFF'}
      </button>
    ` : ''}
    <button class="btn ${state.isAdmin ? 'btn-secondary' : 'btn-primary'}" onclick="toggleAdminMode()" style="font-size: 0.75rem; padding: 6px 12px;">
      ${state.isAdmin ? '👑 Admin ON' : '🔓 Activer Admin'}
    </button>
    <button class="btn-icon" onclick="openCategoryManagerModal()" title="Gérer les catégories">⚙️</button>
    <button class="btn-icon" onclick="openResponsableManagerModal()" title="Gérer les responsables">👥</button>
    <button class="theme-toggle" onclick="toggleTheme()" title="Changer de thème"></button>
    <button class="btn btn-primary" onclick="openNewCardModal()">
      <span>➕</span> Nouvelle carte
    </button>
  `;

  // Re-setup search bar events after header render
  setupSearchBar();
}

function toggleStatistics() {
  state.showStatistics = !state.showStatistics;
  render();
}


function renderBoard() {
  const board = document.getElementById('board');
  if (!board) return;

  board.classList.add('updating');

  const sortedCategories = [...state.categories].sort((a, b) => (a.Ordre || 0) - (b.Ordre || 0));

  requestAnimationFrame(() => {
    board.innerHTML = `
      ${sortedCategories.map(cat => renderColumn(cat)).join('')}
      ${(!state.moderationActive || state.isAdmin) ? `
        <div class="add-column" onclick="openNewCategoryModal()">
          <span class="add-column-icon">➕</span>
          <span>Ajouter une catégorie</span>
        </div>
      ` : ''}
    `;

    setTimeout(() => {
      attachDragDropListeners();
      board.classList.remove('updating');
    }, 10);
  });
}

function attachDragDropListeners() {
  document.querySelectorAll('.column-cards').forEach(columnCards => {
    const columnId = parseInt(columnCards.closest('.column').dataset.columnId);

    columnCards.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (state.dragOverColumnId !== columnId) {
        state.dragOverColumnId = columnId;
        document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
        columnCards.closest('.column').classList.add('drag-over');
      }
    });

    columnCards.addEventListener('dragleave', (e) => {
      e.stopPropagation();
      if (!columnCards.contains(e.relatedTarget)) {
        columnCards.closest('.column').classList.remove('drag-over');
      }
    });

    columnCards.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const carteIdStr = e.dataTransfer.getData('text/plain');
      if (!carteIdStr) return;

      const carteId = parseInt(carteIdStr);
      const carte = state.cartes.find(c => c.id === carteId);

      if (!carte || carte.Categorie === columnId) {
        document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
        return;
      }

      try {
        const oldCat = state.categories.find(cat => cat.id === carte.Categorie);
        const newCat = state.categories.find(cat => cat.id === columnId);
        const oldCatName = oldCat ? oldCat.Nom : 'Inconnu';
        const newCatName = newCat ? newCat.Nom : 'Inconnu';
        const author = state.currentPseudo || 'Anonyme';
        const historique = carte.Historique || '';
        const entry = `[${new Date().toLocaleString('fr-FR')}] ${author} - Déplacement: "${oldCatName}" → "${newCatName}"`;
        const newHistorique = historique ? historique + '\n' + entry : entry;

        await grist.docApi.applyUserActions([
          ['UpdateRecord', 'Cartes', carteId, { Categorie: columnId, Historique: newHistorique }]
        ]);
        showToast('Carte déplacée !', 'success');
        await fetchAllData(true);
      } catch (err) {
        console.error('Erreur déplacement carte:', err);
        showToast('Erreur lors du déplacement', 'error');
      } finally {
        document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
      }
    });
  });
}

function renderColumn(category) {
  const cartes = state.cartes
    .filter(c => {
      if (c.Categorie !== category.id) return false;

      // Exclure les cartes archivées du board principal
      if (c.Archive === true) return false;

      if (state.filterAuthor) {
        const cardAuthor = c.Auteur_Pseudo || c.Auteur || 'Anonyme';
        if (cardAuthor !== state.filterAuthor) return false;
      }

      if (state.filterPriority && c.Priorite !== state.filterPriority) return false;

      if (state.filterResponsable) {
        if (state.filterResponsable === '__none__') {
          if (c.Responsable) return false;
        } else {
          if (c.Responsable !== state.filterResponsable) return false;
        }
      }

      if (state.filterTag) {
        const cardTags = c.Tags ? c.Tags.split(',').map(t => t.trim()) : [];
        if (!cardTags.includes(state.filterTag)) return false;
      }

      if (state.searchQuery) {
        const searchText = state.searchQuery;
        const titleMatch = (c.Titre || '').toLowerCase().includes(searchText);
        const contentMatch = (c.Contenu || '').toLowerCase().includes(searchText);
        const authorMatch = (c.Auteur || '').toLowerCase().includes(searchText);
        if (!titleMatch && !contentMatch && !authorMatch) return false;
      }

      if (!state.moderationActive) return true;
      if (state.isAdmin) return true;

      const isApproved = c.Approuve === true;
      const isOwnCardByPseudo = state.currentPseudo && c.Auteur_Pseudo === state.currentPseudo;
      const isOwnCardBySession = c.Session_ID === state.sessionId;
      const isOwnCard = isOwnCardByPseudo || isOwnCardBySession;

      return isApproved || isOwnCard;
    })
    .sort((a, b) => (a.Ordre || 0) - (b.Ordre || 0));

  return `
    <div class="column" data-column-id="${category.id}">
      <div class="column-header">
        <div class="column-title">
          <span class="column-color-dot" style="background: ${category.Couleur || '#6366F1'}"></span>
          <span class="column-icon">${category.Icone || '📁'}</span>
          <span class="column-name">${escapeHtml(category.Nom)}</span>
        </div>
        <div class="column-actions">
          <span class="column-count">${cartes.length}</span>
          <button class="column-edit-btn" onclick="openEditCategoryModal(${category.id})" title="Modifier">✏️</button>
        </div>
      </div>
      <div class="column-cards">
        ${cartes.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">🎯</div>
            <p>Aucune carte</p>
          </div>
        ` : cartes.map(carte => renderCard(carte, category)).join('')}
      </div>
      <button class="add-card-btn" onclick="openNewCardModal(${category.id})">
        <span>➕</span> Ajouter une carte
      </button>
    </div>
  `;
}

function renderCard(carte, category) {
  const likesCount = state.likes.filter(l => l.Carte === carte.id).length;
  const commentsCount = state.commentaires.filter(c => c.Carte === carte.id).length;
  const isLiked = state.likes.some(l => l.Carte === carte.id && l.Pseudo === (state.currentPseudo || 'Anonyme'));
  const avatarColor = generateColor(carte.Auteur || 'Anonyme');

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = carte.Contenu || '';
  const textPreview = tempDiv.textContent || tempDiv.innerText || '';

  const attachmentIds = parseAttachments(carte.PieceJointe);
  const hasAttachments = attachmentIds.length > 0;
  const hasExternalLink = !!carte.LienExterne;

  let displayImage = '';
  if (state.cardImages && state.cardImages[carte.id]) {
    displayImage = state.cardImages[carte.id];
  } else if (carte.ImageURL) {
    displayImage = carte.ImageURL;
  }

  const statusBadge = (state.moderationActive && !carte.Approuve) ? `
    <div class="card-badge" style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; margin-bottom: 8px; display: inline-block;">
      ⏳ En attente
    </div>
  ` : '';

  const priorityBadge = carte.Priorite ? `
    <div class="card-badge priority-${carte.Priorite}" style="background: ${PRIORITY_LEVELS[carte.Priorite]?.color || '#6b7280'}20; color: ${PRIORITY_LEVELS[carte.Priorite]?.color || '#6b7280'}; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; display: inline-block; margin-left: 6px;">
      ${PRIORITY_LEVELS[carte.Priorite]?.icon || ''} ${PRIORITY_LEVELS[carte.Priorite]?.label || 'Priorité'}
    </div>
  ` : '';

  const deadlineInfo = carte.Deadline ? formatDeadline(carte.Deadline) : null;
  const deadlineBadge = deadlineInfo ? `
    <div class="card-deadline" style="background: ${deadlineInfo.color}20; color: ${deadlineInfo.color}; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; margin-top: 8px; display: flex; align-items: center; gap: 4px;">
      ${deadlineInfo.icon} ${deadlineInfo.text}
    </div>
  ` : '';

  const tagsList = carte.Tags ? `
    <div class="card-tags" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
      ${carte.Tags.split(',').map(tag => {
        const trimmedTag = tag.trim();
        return `<span class="card-tag" style="background-color: ${getTagColor(trimmedTag)}40; color: ${getTagColor(trimmedTag)}; padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; cursor: pointer;" onclick="event.stopPropagation(); filterByTag('${escapeHtml(trimmedTag)}')">🏷️ ${escapeHtml(trimmedTag)}</span>`;
      }).join('')}
    </div>
  ` : '';

  const adminButtons = (state.moderationActive && state.isAdmin && !carte.Approuve) ? `
    <div class="card-admin-actions" style="display: flex; gap: 8px; margin-bottom: 8px;">
      <button class="btn-approve" onclick="event.stopPropagation(); approveCard(${carte.id})" style="flex: 1; padding: 6px 12px; background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 1px solid #22c55e; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">
        ✓ Approuver
      </button>
      <button class="btn-reject" onclick="event.stopPropagation(); deleteCarte(${carte.id})" style="flex: 1; padding: 6px 12px; background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">
        ✕ Rejeter
      </button>
    </div>
  ` : '';

  const isOwnCardByPseudo = state.currentPseudo && carte.Auteur_Pseudo === state.currentPseudo;
  const isOwnCardBySession = carte.Session_ID === state.sessionId;
  const isOwnCard = isOwnCardByPseudo || isOwnCardBySession;

  const showEditButtons = !state.moderationActive || state.isAdmin || isOwnCard;

  const codirChecked = carte.Codir === true;

  return `
    <div class="card" 
         draggable="true" 
         ondragstart="handleDragStart(event, ${carte.id})"
         ondragend="handleDragEnd(event)"
         onclick="handleCardClick(event, ${carte.id})"
         style="border-left: 4px solid ${category.Couleur || '#6366F1'};">
      <div class="card-toolbar" onclick="event.stopPropagation();">
        <div class="codir-toggle" title="${codirChecked ? 'Retirer du CODIR' : 'Évoquer en CODIR'}">
          <label class="codir-switch">
            <input type="checkbox" ${codirChecked ? 'checked' : ''} onchange="event.stopPropagation(); toggleCodirCarte(${carte.id})">
            <span class="codir-slider"></span>
          </label>
          <span class="codir-label">${codirChecked ? '🏛️' : ''}</span>
        </div>
        ${showEditButtons ? `
          <div class="card-quick-actions">
            <button class="card-edit-btn" onclick="event.stopPropagation(); archiveCarte(${carte.id})" title="Archiver">📦</button>
            <button class="card-edit-btn" onclick="event.stopPropagation(); openEditCardModal(${carte.id})" title="Modifier">✏️</button>
          </div>
        ` : ''}
      </div>
      ${displayImage ? `<img src="${escapeHtml(displayImage)}" class="card-image" alt="" onerror="this.style.display='none'">` : ''}
      <div class="card-content">
        ${statusBadge}${priorityBadge}
        ${adminButtons}
        <h3 class="card-title">${escapeHtml(carte.Titre)}</h3>
        ${carte.Contenu ? `<p class="card-text">${textPreview.slice(0, 120)}${textPreview.length > 120 ? '...' : ''}</p>` : ''}
        ${(hasAttachments || hasExternalLink) ? `
          <div class="card-attachments">
            ${hasAttachments ? `<span class="card-attachment">📎 ${attachmentIds.length}</span>` : ''}
            ${hasExternalLink ? `<span class="card-attachment">🔗 Lien</span>` : ''}
          </div>
        ` : ''}
        ${deadlineBadge}
        ${tagsList}
        ${carte.Responsable ? `
        <div style="display: flex; align-items: center; gap: 6px; padding: 6px 10px; margin-top: 8px; background: rgba(102, 126, 234, 0.08); border-radius: 8px; border: 1px solid rgba(102, 126, 234, 0.15);">
          <span style="background: var(--accent-primary); color: white; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.65rem; flex-shrink: 0;">${getInitials(carte.Responsable)}</span>
          <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">👤 ${escapeHtml(carte.Responsable)}</span>
        </div>
        ` : ''}
        <div class="card-meta">
          <div class="card-author">
            <div class="avatar" style="background: ${avatarColor}">${getInitials(carte.Auteur || 'AN')}</div>
            <span class="author-name">${escapeHtml(carte.Auteur || 'Anonyme')}</span>
          </div>
          <div class="card-stats">
            <span class="stat ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); toggleLike(${carte.id})">
              <span class="stat-icon">${isLiked ? '❤️' : '🤍'}</span>
              <span>${likesCount}</span>
            </span>
            <span class="stat">
              <span class="stat-icon">💬</span>
              <span>${commentsCount}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==================== MODALS ====================
function openModal() {
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  state.selectedCard = null;
  state.editingCard = null;
  state.editingCategory = null;
  state.modalType = null;
  state.modalData = null;
}

function openUserLoginModal() {
  state.modalType = 'userLogin';
  const html = `
    <div class="modal-header">
      <h2 class="modal-title">👤 Identifiez-vous</h2>
    </div>
    <div class="modal-body">
      <p style="color: var(--text-secondary); margin-bottom: 20px;">Entrez votre adresse email pour accéder au mur collaboratif.</p>
      
      <div class="form-group">
        <label class="form-label">Email <span style="color: #ef4444;">*</span></label>
        <input 
          type="email" 
          id="login-email" 
          class="form-input" 
          placeholder="votre.email@example.com"
          required
          onkeydown="if(event.key==='Enter') checkEmailAndProceed()"
        >
        <p class="form-hint">Si votre adresse est déjà enregistrée, vous serez connecté(e) automatiquement.</p>
      </div>

      <div id="login-status" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.875rem;"></div>
    </div>

    <div class="modal-footer">
      <div class="modal-footer-left">
        <button class="btn btn-secondary" onclick="continueAsAnonymous()" style="font-size: 0.8rem;">
          👻 Continuer en anonyme
        </button>
      </div>
      <div class="modal-footer-right">
        <button class="btn btn-primary" onclick="checkEmailAndProceed()">
          ➡️ Continuer
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('modal-content').innerHTML = html;
  openModal();
  
  setTimeout(() => document.getElementById('login-email')?.focus(), 100);
}

async function checkEmailAndProceed() {
  const email = document.getElementById('login-email')?.value?.trim();

  if (!email || !email.includes('@')) {
    const statusDiv = document.getElementById('login-status');
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.style.background = 'rgba(239, 68, 68, 0.1)';
      statusDiv.style.color = '#ef4444';
      statusDiv.textContent = '⚠️ Veuillez saisir une adresse email valide.';
    }
    return;
  }

  const emailLower = email.toLowerCase();
  const existingUser = state.users.find(u => u.mail && u.mail.toLowerCase() === emailLower);

  if (existingUser) {
    // ✅ L'utilisateur existe → connexion automatique
    try {
      await grist.docApi.applyUserActions([
        ['UpdateRecord', 'Users', existingUser.id, { DateLastVisit: toGristDateTime() }]
      ]);
    } catch (e) { console.warn('MAJ DateLastVisit:', e); }

    localStorage.setItem('userEmail', emailLower);
    localStorage.removeItem('anonymousMode');
    state.currentUser = existingUser;
    state.currentEmail = emailLower;
    state.currentPseudo = existingUser.Pseudo || generatePseudo(existingUser.firstname || '', existingUser.lastname || '');
    state.currentFirstName = existingUser.firstname || '';
    state.currentLastName = existingUser.lastname || '';
    state.currentEntity = existingUser.Entity || '';

    closeModal();
    showToast(`Bienvenue ${state.currentPseudo} ! 👋`, 'success');
    render();
  } else {
    // ❌ Email inconnu → formulaire de création
    openUserCreationModal(emailLower, '', '');
  }
}

function openUserCreationModal(email, firstname, lastname) {
  state.modalType = 'userCreation';
  const html = `
    <div class="modal-header">
      <h2 class="modal-title">📝 Créer votre profil</h2>
    </div>
    <div class="modal-body">
      <p style="color: var(--text-secondary); margin-bottom: 20px;">L'adresse <strong>${escapeHtml(email)}</strong> n'est pas encore enregistrée. Complétez votre profil pour continuer.</p>
      
      <input type="hidden" id="creation-email" value="${escapeHtml(email)}">

      <div class="form-group">
        <label class="form-label">Prénom <span style="color: #ef4444;">*</span></label>
        <input 
          type="text" 
          id="creation-firstname" 
          class="form-input" 
          placeholder="Jean"
          value="${escapeHtml(firstname)}"
          required
        >
      </div>

      <div class="form-group">
        <label class="form-label">Nom <span style="color: #ef4444;">*</span></label>
        <input 
          type="text" 
          id="creation-lastname" 
          class="form-input" 
          placeholder="Dupont"
          value="${escapeHtml(lastname)}"
        >
      </div>

      <div class="form-group">
        <label class="form-label">Pseudo (optionnel)</label>
        <input 
          type="text" 
          id="creation-pseudo" 
          class="form-input" 
          placeholder="Sera généré automatiquement si vide"
        >
      </div>

      <div class="form-group">
        <label class="form-label">Entité / Organisation (optionnel)</label>
        <input 
          type="text" 
          id="creation-entity" 
          class="form-input" 
          placeholder="DINUM, Académie de..."
        >
      </div>
    </div>

    <div class="modal-footer">
      <div class="modal-footer-left">
        <button class="btn btn-secondary" onclick="openUserLoginModal()" style="font-size: 0.8rem;">
          ⬅️ Retour
        </button>
      </div>
      <div class="modal-footer-right">
        <button class="btn btn-primary" onclick="submitUserCreation()">
          ✓ Créer mon compte
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('modal-content').innerHTML = html;
  openModal();
  
  setTimeout(() => document.getElementById('creation-firstname')?.focus(), 100);
}

async function submitUserCreation() {
  const email = document.getElementById('creation-email')?.value?.trim();
  const firstname = document.getElementById('creation-firstname')?.value?.trim() || '';
  const lastname = document.getElementById('creation-lastname')?.value?.trim() || '';
  const entity = document.getElementById('creation-entity')?.value?.trim() || '';
  let pseudo = document.getElementById('creation-pseudo')?.value?.trim() || '';

  if (!firstname) {
    showToast('Le prénom est requis', 'error');
    return;
  }

  if (!pseudo) {
    pseudo = generatePseudo(firstname, lastname);
  }

  const emailLower = (email || '').toLowerCase();

  try {
    await grist.docApi.applyUserActions([
      ['AddRecord', 'Users', null, {
        mail: emailLower,
        firstname: firstname,
        lastname: lastname,
        Pseudo: pseudo,
        Entity: entity,
        DateCreation: toGristDateTime(),
        DateLastVisit: toGristDateTime()
      }]
    ]);

    localStorage.setItem('userEmail', emailLower);
    localStorage.removeItem('anonymousMode');
    state.currentEmail = emailLower;
    state.currentPseudo = pseudo;
    state.currentFirstName = firstname;
    state.currentLastName = lastname;
    state.currentEntity = entity;

    closeModal();
    showToast(`Bienvenue ${pseudo} ! 🎉`, 'success');
    await fetchAllData(true);
  } catch (err) {
    console.error('Erreur création compte:', err);
    showToast('Erreur lors de la création du compte. Réessayez.', 'error');
  }
}

function continueAsAnonymous() {
  localStorage.setItem('anonymousMode', 'true');
  localStorage.removeItem('userEmail');
  state.currentPseudo = 'Anonyme';
  state.currentEmail = '';
  state.currentFirstName = '';
  state.currentLastName = '';
  state.currentEntity = '';
  state.currentUser = null;
  closeModal();
  showToast('Vous êtes connecté(e) en mode anonyme 👻', 'info');
  render();
}

function handleModalOverlayClick(event) {
  if (event.target.id === 'modal-overlay') {
    // Ne pas fermer la modal de login/création utilisateur en cliquant à l'extérieur
    if (state.modalType === 'userLogin' || state.modalType === 'userCreation') return;
    closeModal();
  }
}

function renderColorPicker(selectedColor) {
  return `
    <div class="color-picker">
      ${COLORS.map(color => `
        <div 
          class="color-option ${color === selectedColor ? 'selected' : ''}" 
          style="background: ${color}"
          onclick="selectColor('${color}')"
          data-color="${color}"
        ></div>
      `).join('')}
    </div>
  `;
}

function selectColor(color) {
  document.querySelectorAll('.color-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === color);
  });
  document.getElementById('selected-color').value = color;
}

function renderRichEditor(initialContent = '') {
  return `
    <div class="rich-editor-container">
      <div class="editor-toolbar">
        <button type="button" class="toolbar-btn" onclick="execCommand('bold')" title="Gras"><b>B</b></button>
        <button type="button" class="toolbar-btn" onclick="execCommand('italic')" title="Italique"><i>I</i></button>
        <button type="button" class="toolbar-btn" onclick="execCommand('underline')" title="Souligné"><u>U</u></button>
        <button type="button" class="toolbar-btn" onclick="execCommand('strikeThrough')" title="Barré"><s>S</s></button>
        <div class="toolbar-separator"></div>
        <button type="button" class="toolbar-btn" onclick="insertHeading(1)" title="Titre 1">H1</button>
        <button type="button" class="toolbar-btn" onclick="insertHeading(2)" title="Titre 2">H2</button>
        <button type="button" class="toolbar-btn" onclick="insertHeading(3)" title="Titre 3">H3</button>
        <div class="toolbar-separator"></div>
        <button type="button" class="toolbar-btn" onclick="execCommand('insertUnorderedList')" title="Liste à puces">•</button>
        <button type="button" class="toolbar-btn" onclick="execCommand('insertOrderedList')" title="Liste numérotée">1.</button>
      </div>
      <div class="rich-editor" id="rich-editor" contenteditable="true">${initialContent}</div>
    </div>
  `;
}

function execCommand(command, value = null) {
  document.execCommand(command, false, value);
  const editor = document.getElementById('rich-editor');
  if (editor) editor.focus();
}

function insertHeading(level) {
  execCommand('formatBlock', `<h${level}>`);
}

// ==================== CATEGORY MODALS ====================
function openCategoryManagerModal() {
  state.modalType = 'categoryManager';
  const modal = document.getElementById('modal-content');
  const sortedCategories = [...state.categories].sort((a, b) => (a.Ordre || 0) - (b.Ordre || 0));
  
  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">⚙️ Gérer les catégories</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="category-list">
        ${sortedCategories.length === 0 ? `
          <div class="empty-state">
            <p>Aucune catégorie</p>
          </div>
        ` : sortedCategories.map(cat => `
          <div class="category-item">
            <div class="category-item-color" style="background: ${cat.Couleur || '#6366F1'}"></div>
            <span class="category-item-icon">${cat.Icone || '📁'}</span>
            <span class="category-item-name">${escapeHtml(cat.Nom)}</span>
            <div class="category-item-actions">
              <button class="category-item-btn" onclick="openEditCategoryModal(${cat.id})" title="Modifier">✏️</button>
              <button class="category-item-btn delete" onclick="deleteCategory(${cat.id})" title="Supprimer">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="btn btn-secondary" onclick="closeModal()">Fermer</button>
        <button class="btn btn-primary" onclick="openNewCategoryModal()">➕ Ajouter</button>
      </div>
    </div>
  `;
  openModal();
}

function openNewCategoryModal() {
  if (state.moderationActive && !state.isAdmin) {
    showToast('Création de colonnes interdite : la modération est active', 'error');
    return;
  }

  state.modalType = 'categoryNew';
  const modal = document.getElementById('modal-content');
  const defaultColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  
  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">➕ Nouvelle catégorie</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Nom *</label>
        <input type="text" class="form-input" id="category-name" placeholder="Ex: À faire, Idées, Questions..." required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Icône (emoji)</label>
          <input type="text" class="form-input" id="category-icon" placeholder="📋" maxlength="2">
        </div>
        <div class="form-group">
          <label class="form-label">Couleur</label>
          <input type="hidden" id="selected-color" value="${defaultColor}">
          ${renderColorPicker(defaultColor)}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="btn btn-secondary" onclick="openCategoryManagerModal()">Retour</button>
        <button class="btn btn-primary" onclick="submitNewCategory()">Créer</button>
      </div>
    </div>
  `;
  openModal();
}

function openEditCategoryModal(categoryId) {
  const category = state.categories.find(c => c.id === categoryId);
  if (!category) return;
  
  state.modalType = 'categoryEdit';
  state.editingCategory = categoryId;
  const modal = document.getElementById('modal-content');
  
  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">✏️ Modifier la catégorie</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Nom *</label>
        <input type="text" class="form-input" id="category-name" value="${escapeHtml(category.Nom)}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Icône (emoji)</label>
          <input type="text" class="form-input" id="category-icon" value="${escapeHtml(category.Icone || '')}" maxlength="2">
        </div>
        <div class="form-group">
          <label class="form-label">Couleur</label>
          <input type="hidden" id="selected-color" value="${category.Couleur || '#6366F1'}">
          ${renderColorPicker(category.Couleur || '#6366F1')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <div class="modal-footer-left">
        <button class="btn btn-danger btn-sm" onclick="deleteCategory(${categoryId})">🗑️ Supprimer</button>
      </div>
      <div class="modal-footer-right">
        <button class="btn btn-secondary" onclick="openCategoryManagerModal()">Retour</button>
        <button class="btn btn-primary" onclick="submitEditCategory(${categoryId})">Enregistrer</button>
      </div>
    </div>
  `;
  openModal();
}

function submitNewCategory() {
  const nom = document.getElementById('category-name').value.trim();
  const icone = document.getElementById('category-icon').value.trim();
  const couleur = document.getElementById('selected-color').value;
  
  if (!nom) {
    alert('Le nom est obligatoire');
    return;
  }
  
  addCategory(nom, couleur, icone);
}

function submitEditCategory(categoryId) {
  const nom = document.getElementById('category-name').value.trim();
  const icone = document.getElementById('category-icon').value.trim();
  const couleur = document.getElementById('selected-color').value;
  
  if (!nom) {
    alert('Le nom est obligatoire');
    return;
  }
  
  updateCategory(categoryId, nom, couleur, icone);
}

// ==================== RESPONSABLES MANAGEMENT ====================
function getResponsablesList() {
  // Priorité : table Responsables dédiée, sinon fallback sur Users
  if (state.responsables.length > 0) {
    return state.responsables
      .map(r => ({ id: r.id, nom: r.Nom || '', email: r.Email || '', fonction: r.Fonction || '' }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
  }
  return state.users.map(user => ({
    id: user.id,
    nom: user.Pseudo || `${user.firstname || ''} ${user.lastname || ''}`.trim(),
    email: user.email || '',
    fonction: ''
  })).filter(u => u.nom).sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
}

function openResponsableManagerModal() {
  state.modalType = 'responsableManager';
  const modal = document.getElementById('modal-content');
  const responsables = getResponsablesList();

  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">👥 Gérer les responsables</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      ${state.responsables.length === 0 ? `
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 16px; font-size: 0.85rem; color: var(--text-secondary);">
          ℹ️ La table <strong>Responsables</strong> n'existe pas encore dans Grist. Créez-la avec les colonnes : <strong>Nom</strong> (Text), <strong>Email</strong> (Text), <strong>Fonction</strong> (Text). En attendant, la liste des utilisateurs est utilisée.
        </div>
      ` : ''}
      <div class="category-list">
        ${responsables.length === 0 ? `
          <div class="empty-state">
            <p>Aucun responsable</p>
          </div>
        ` : responsables.map(r => `
          <div class="category-item">
            <span style="background: var(--accent-primary); color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.7rem; flex-shrink: 0;">${getInitials(r.nom)}</span>
            <div style="flex: 1; min-width: 0;">
              <div class="category-item-name" style="font-weight: 500;">${escapeHtml(r.nom)}</div>
              ${r.fonction ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(r.fonction)}</div>` : ''}
              ${r.email ? `<div style="font-size: 0.7rem; color: var(--text-muted);">${escapeHtml(r.email)}</div>` : ''}
            </div>
            ${state.responsables.length > 0 ? `
              <div class="category-item-actions">
                <button class="category-item-btn" onclick="openEditResponsableModal(${r.id})" title="Modifier">✏️</button>
                <button class="category-item-btn delete" onclick="deleteResponsable(${r.id})" title="Supprimer">🗑️</button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="btn btn-secondary" onclick="closeModal()">Fermer</button>
        <button class="btn btn-primary" onclick="openNewResponsableModal()">➕ Ajouter</button>
      </div>
    </div>
  `;
  openModal();
}

function openNewResponsableModal() {
  state.modalType = 'responsableNew';
  const modal = document.getElementById('modal-content');

  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">➕ Nouveau responsable</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Nom *</label>
        <input type="text" class="form-input" id="responsable-nom" placeholder="Prénom Nom" required>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="responsable-email" placeholder="email@exemple.fr">
      </div>
      <div class="form-group">
        <label class="form-label">Fonction</label>
        <input type="text" class="form-input" id="responsable-fonction" placeholder="Ex: Chef de projet, Développeur...">
      </div>
    </div>
    <div class="modal-footer">
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="btn btn-secondary" onclick="openResponsableManagerModal()">Retour</button>
        <button class="btn btn-primary" onclick="submitNewResponsable()">Créer</button>
      </div>
    </div>
  `;
  openModal();
}

function openEditResponsableModal(responsableId) {
  const resp = state.responsables.find(r => r.id === responsableId);
  if (!resp) return;

  state.modalType = 'responsableEdit';
  state.editingResponsable = responsableId;
  const modal = document.getElementById('modal-content');

  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">✏️ Modifier le responsable</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Nom *</label>
        <input type="text" class="form-input" id="responsable-nom" value="${escapeHtml(resp.Nom || '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="responsable-email" value="${escapeHtml(resp.Email || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Fonction</label>
        <input type="text" class="form-input" id="responsable-fonction" value="${escapeHtml(resp.Fonction || '')}">
      </div>
    </div>
    <div class="modal-footer">
      <div class="modal-footer-left">
        <button class="btn btn-danger btn-sm" onclick="deleteResponsable(${responsableId})">🗑️ Supprimer</button>
      </div>
      <div class="modal-footer-right">
        <button class="btn btn-secondary" onclick="openResponsableManagerModal()">Retour</button>
        <button class="btn btn-primary" onclick="submitEditResponsable(${responsableId})">Enregistrer</button>
      </div>
    </div>
  `;
  openModal();
}

async function submitNewResponsable() {
  const nom = document.getElementById('responsable-nom').value.trim();
  const email = document.getElementById('responsable-email').value.trim();
  const fonction = document.getElementById('responsable-fonction').value.trim();

  if (!nom) {
    alert('Le nom est obligatoire');
    return;
  }

  try {
    await grist.docApi.applyUserActions([
      ['AddRecord', 'Responsables', null, {
        Nom: nom,
        Email: email || null,
        Fonction: fonction || null
      }]
    ]);
    showToast('Responsable ajouté !', 'success');
    await fetchAllData(true);
    openResponsableManagerModal();
  } catch (err) {
    console.error('Erreur ajout responsable:', err);
    if (err.message && err.message.includes('not found')) {
      alert('La table "Responsables" n\'existe pas dans Grist.\nCréez-la avec les colonnes : Nom (Text), Email (Text), Fonction (Text).');
    } else {
      alert('Erreur lors de l\'ajout du responsable');
    }
  }
}

async function submitEditResponsable(responsableId) {
  const nom = document.getElementById('responsable-nom').value.trim();
  const email = document.getElementById('responsable-email').value.trim();
  const fonction = document.getElementById('responsable-fonction').value.trim();

  if (!nom) {
    alert('Le nom est obligatoire');
    return;
  }

  try {
    const oldResp = state.responsables.find(r => r.id === responsableId);
    const oldNom = oldResp ? oldResp.Nom : '';

    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Responsables', responsableId, {
        Nom: nom,
        Email: email || null,
        Fonction: fonction || null
      }]
    ]);

    // Mettre à jour le nom dans les cartes si le nom a changé
    if (oldNom && oldNom !== nom) {
      const cartesToUpdate = state.cartes.filter(c => c.Responsable === oldNom);
      for (const carte of cartesToUpdate) {
        await grist.docApi.applyUserActions([
          ['UpdateRecord', 'Cartes', carte.id, { Responsable: nom }]
        ]);
      }
      if (cartesToUpdate.length > 0) {
        showToast(`Responsable modifié ! ${cartesToUpdate.length} carte(s) mise(s) à jour.`, 'success');
      } else {
        showToast('Responsable modifié !', 'success');
      }
    } else {
      showToast('Responsable modifié !', 'success');
    }

    await fetchAllData(true);
    openResponsableManagerModal();
  } catch (err) {
    console.error('Erreur modification responsable:', err);
    alert('Erreur lors de la modification du responsable');
  }
}

async function deleteResponsable(responsableId) {
  const resp = state.responsables.find(r => r.id === responsableId);
  if (!resp) return;

  const cartesAssignees = state.cartes.filter(c => c.Responsable === resp.Nom);
  let confirmMsg = `Supprimer le responsable "${resp.Nom}" ?`;
  if (cartesAssignees.length > 0) {
    confirmMsg += `\n\n⚠️ ${cartesAssignees.length} carte(s) lui sont assignées. Le champ responsable de ces cartes sera vidé.`;
  }

  if (!confirm(confirmMsg)) return;

  try {
    // Vider le champ responsable des cartes assignées
    for (const carte of cartesAssignees) {
      await grist.docApi.applyUserActions([
        ['UpdateRecord', 'Cartes', carte.id, { Responsable: null }]
      ]);
    }

    await grist.docApi.applyUserActions([
      ['RemoveRecord', 'Responsables', responsableId]
    ]);
    showToast('Responsable supprimé', 'success');
    await fetchAllData(true);
    openResponsableManagerModal();
  } catch (err) {
    console.error('Erreur suppression responsable:', err);
    alert('Erreur lors de la suppression du responsable');
  }
}

// ==================== CARD MODALS ====================
function openNewCardModal(categoryId = null) {
  state.modalType = 'cardNew';
  const modal = document.getElementById('modal-content');
  const sortedCategories = [...state.categories].sort((a, b) => (a.Ordre || 0) - (b.Ordre || 0));
  
  if (sortedCategories.length === 0) {
    alert('Veuillez d\'abord créer au moins une catégorie.');
    openNewCategoryModal();
    return;
  }
  
  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">✨ Nouvelle carte</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Catégorie</label>
        <select class="form-select" id="new-card-category">
          ${sortedCategories.map(cat => `
            <option value="${cat.id}" ${cat.id === categoryId ? 'selected' : ''}>
              ${cat.Icone || ''} ${escapeHtml(cat.Nom)}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Titre *</label>
        <input type="text" class="form-input" id="new-card-title" placeholder="Donnez un titre à votre carte" required>
      </div>
      <div class="form-group">
        <label class="form-label">Contenu</label>
        ${renderRichEditor()}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Priorité</label>
          <select class="form-select" id="new-card-priority">
            <option value="basse">⬇️ Basse</option>
            <option value="moyenne" selected>➡️ Moyenne</option>
            <option value="haute">⬆️ Haute</option>
            <option value="urgente">🔴 Urgente</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Date limite</label>
          <input type="date" class="form-input" id="new-card-deadline">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">👤 Responsable</label>
        <select class="form-select" id="new-card-responsible">
          <option value="">-- Aucun responsable --</option>
          ${getResponsablesList().map(r => `<option value="${escapeHtml(r.nom)}">${escapeHtml(r.nom)}${r.fonction ? ' — ' + escapeHtml(r.fonction) : ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">🏷️ Tags (séparés par comma)</label>
        <input type="text" class="form-input" id="new-card-tags" placeholder="ex: urgent, client, feedback">
      </div>
      <div class="form-group">
        <label class="form-label">🖼️ URL d'image (optionnel)</label>
        <input type="url" class="form-input" id="new-card-image" placeholder="https://...">
      </div>
      <div class="form-group">
        <label class="form-label">🔗 Lien externe (optionnel)</label>
        <input type="url" class="form-input" id="new-card-link" placeholder="https://...">
      </div>

    </div>
    <div class="modal-footer">
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitNewCard()">Publier</button>
      </div>
    </div>
  `;
  openModal();
}

function openEditCardModal(carteId) {
  state.modalType = 'cardEdit';
  state.editingCard = carteId;
  const carte = state.cartes.find(c => c.id === carteId);
  if (!carte) return;
  
  const modal = document.getElementById('modal-content');
  const sortedCategories = [...state.categories].sort((a, b) => (a.Ordre || 0) - (b.Ordre || 0));
  
  const deadlineDate = carte.Deadline ? new Date(parseFloat(carte.Deadline) * 1000).toISOString().split('T')[0] : '';
  
  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">✏️ Modifier la carte</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Catégorie</label>
        <select class="form-select" id="edit-card-category">
          ${sortedCategories.map(cat => `
            <option value="${cat.id}" ${cat.id === carte.Categorie ? 'selected' : ''}>
              ${cat.Icone || ''} ${escapeHtml(cat.Nom)}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Titre *</label>
        <input type="text" class="form-input" id="edit-card-title" value="${escapeHtml(carte.Titre)}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Contenu</label>
        ${renderRichEditor(carte.Contenu || '')}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Priorité</label>
          <select class="form-select" id="edit-card-priority">
            <option value="basse" ${carte.Priorite === 'basse' ? 'selected' : ''}>⬇️ Basse</option>
            <option value="moyenne" ${carte.Priorite === 'moyenne' ? 'selected' : ''}>➡️ Moyenne</option>
            <option value="haute" ${carte.Priorite === 'haute' ? 'selected' : ''}>⬆️ Haute</option>
            <option value="urgente" ${carte.Priorite === 'urgente' ? 'selected' : ''}>🔴 Urgente</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Date limite</label>
          <input type="date" class="form-input" id="edit-card-deadline" value="${deadlineDate}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">👤 Responsable</label>
        <select class="form-select" id="edit-card-responsible">
          <option value="">-- Aucun responsable --</option>
          ${getResponsablesList().map(r => {
            const selected = carte.Responsable === r.nom ? 'selected' : '';
            return `<option value="${escapeHtml(r.nom)}" ${selected}>${escapeHtml(r.nom)}${r.fonction ? ' — ' + escapeHtml(r.fonction) : ''}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">🏷️ Tags (séparés par comma)</label>
        <input type="text" class="form-input" id="edit-card-tags" value="${escapeHtml(carte.Tags || '')}" placeholder="ex: urgent, client, feedback">
      </div>
      <div class="form-group">
        <label class="form-label">🖼️ URL d'image (optionnel)</label>
        <input type="url" class="form-input" id="edit-card-image" value="${escapeHtml(carte.ImageURL || '')}" placeholder="https://...">
      </div>
      <div class="form-group">
        <label class="form-label">🔗 Lien externe (optionnel)</label>
        <input type="url" class="form-input" id="edit-card-link" value="${escapeHtml(carte.LienExterne || '')}" placeholder="https://...">
      </div>

    </div>
    <div class="modal-footer">
      <div class="modal-footer-left">
        <button class="btn btn-danger btn-sm" onclick="deleteCarte(${carteId})">🗑️ Supprimer</button>
      </div>
      <div class="modal-footer-right">
        <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitEditCard(${carteId})">Enregistrer</button>
      </div>
    </div>
  `;
  openModal();
}

async function submitNewCard() {
  const categoryId = parseInt(document.getElementById('new-card-category').value);
  const titre = document.getElementById('new-card-title').value.trim();
  const contenu = document.getElementById('rich-editor').innerHTML;
  const imageUrl = document.getElementById('new-card-image').value.trim();
  const lienExterne = document.getElementById('new-card-link').value.trim();
  const priorite = document.getElementById('new-card-priority').value;
  const deadlineInput = document.getElementById('new-card-deadline').value;
  const responsible = document.getElementById('new-card-responsible').value.trim();
  const tags = document.getElementById('new-card-tags').value.trim();
  
  let deadline = null;
  if (deadlineInput) {
    const date = new Date(deadlineInput + 'T00:00:00');
    deadline = Math.floor(date.getTime() / 1000);
  }

  if (!titre) {
    alert('Le titre est obligatoire');
    return;
  }

  await addCarte(categoryId, titre, contenu, imageUrl, lienExterne, priorite, deadline, tags, responsible);
}

async function submitEditCard(carteId) {
  const categoryId = parseInt(document.getElementById('edit-card-category').value);
  const titre = document.getElementById('edit-card-title').value.trim();
  const contenu = document.getElementById('rich-editor').innerHTML;
  const imageUrl = document.getElementById('edit-card-image').value.trim();
  const lienExterne = document.getElementById('edit-card-link').value.trim();
  const priorite = document.getElementById('edit-card-priority').value;
  const deadlineInput = document.getElementById('edit-card-deadline').value;
  const responsible = document.getElementById('edit-card-responsible').value.trim();
  const tags = document.getElementById('edit-card-tags').value.trim();
  
  let deadline = null;
  if (deadlineInput) {
    const date = new Date(deadlineInput + 'T00:00:00');
    deadline = Math.floor(date.getTime() / 1000);
  }

  if (!titre) {
    alert('Le titre est obligatoire');
    return;
  }

  await updateCarte(carteId, titre, contenu, imageUrl, lienExterne, categoryId, priorite, deadline, tags, responsible);
}

// ==================== CARD DETAIL ====================
function showCardDetail(carteId) {
  state.modalType = 'cardDetail';
  state.selectedCard = carteId;
  updateCardDetailModal(carteId);
  openModal();
}

function updateCardDetailModal(carteId) {
  const carte = state.cartes.find(c => c.id === carteId);
  if (!carte) return;

  const category = state.categories.find(c => c.id === carte.Categorie);
  const cardLikes = state.likes.filter(l => l.Carte === carteId);
  const cardComments = state.commentaires.filter(c => c.Carte === carteId).sort((a, b) =>
    new Date(a.DateCommentaire) - new Date(b.DateCommentaire)
  );
  const isLiked = cardLikes.some(l => l.Pseudo === (state.currentPseudo || 'Anonyme'));
  const avatarColor = generateColor(carte.Auteur || 'Anonyme');
  const attachmentIds = parseAttachments(carte.PieceJointe);

  let displayImage = '';
  if (state.cardImages && state.cardImages[carte.id]) {
    displayImage = state.cardImages[carte.id];
  } else if (carte.ImageURL) {
    displayImage = carte.ImageURL;
  }

  const priorityInfo = PRIORITY_LEVELS[carte.Priorite] || PRIORITY_LEVELS.moyenne;
  const deadlineInfo = carte.Deadline ? formatDeadline(carte.Deadline) : null;

  const modal = document.getElementById('modal-content');
  modal.style.borderLeft = `4px solid ${category?.Couleur || '#6366f1'}`;
  modal.innerHTML = `
    ${displayImage ? `<img src="${escapeHtml(displayImage)}" class="card-detail-image" alt="" onerror="this.style.display='none'">` : ''}
    <div class="card-detail-header">
      <div class="card-detail-category" style="background: ${category?.Couleur || '#6366f1'}20; color: ${category?.Couleur || '#6366f1'}">
        ${category?.Icone || '📁'} ${escapeHtml(category?.Nom || 'Sans catégorie')}
      </div>
      <h2 class="card-detail-title">${escapeHtml(carte.Titre)}</h2>
      <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
        <div style="background: ${priorityInfo.color}20; color: ${priorityInfo.color}; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">
          ${priorityInfo.icon} ${priorityInfo.label}
        </div>
        ${deadlineInfo ? `
          <div style="background: ${deadlineInfo.color}20; color: ${deadlineInfo.color}; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">
            ${deadlineInfo.icon} ${deadlineInfo.text}
          </div>
        ` : ''}
      </div>
      ${carte.Tags ? `
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
          ${carte.Tags.split(',').map(tag => {
            const trimmedTag = tag.trim();
            return `<span style="background-color: ${getTagColor(trimmedTag)}20; color: ${getTagColor(trimmedTag)}; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 500;">🏷️ ${escapeHtml(trimmedTag)}</span>`;
          }).join('')}
        </div>
      ` : ''}
      <div class="card-detail-meta">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="card-author">
            <div class="avatar" style="background: ${avatarColor}">${getInitials(carte.Auteur || 'AN')}</div>
            <span>${escapeHtml(carte.Auteur || 'Anonyme')}</span>
          </div>
          ${carte.Responsable ? `
            <div style="display: flex; align-items: center; gap: 6px; font-size: 0.9rem; color: var(--text-secondary);">
              <span style="background: var(--accent-primary); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.75rem;">${getInitials(carte.Responsable)}</span>
              <span style="font-weight: 500;">👤 Responsable: ${escapeHtml(carte.Responsable)}</span>
            </div>
          ` : ''}
        </div>
        <span>•</span>
        <span>${formatDate(carte.DateCreation)}</span>
        <button class="btn btn-secondary btn-sm" onclick="openEditCardModal(${carteId})" style="margin-left: auto;">✏️ Modifier</button>
      </div>
    </div>
    <div class="card-detail-body">
      ${carte.Contenu ? `<div class="card-detail-text">${processRichTextLinks(carte.Contenu)}</div>` : ''}
      ${renderAttachmentsSection(carte)}
      
      <div class="card-detail-actions">
        <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike(${carteId})">
          ${isLiked ? '❤️' : '🤍'} ${cardLikes.length} J'aime${cardLikes.length > 1 ? 's' : ''}
        </button>
        <button class="action-btn" onclick="toggleCodirCarte(${carteId})" style="${carte.Codir ? 'color: #8b5cf6; font-weight: 600;' : ''}">
          🏛️ ${carte.Codir ? 'CODIR ✓' : 'CODIR'}
        </button>
        ${carte.Archive ? `
          <button class="action-btn" onclick="unarchiveCarte(${carteId})" style="color: #22c55e;">
            ♻️ Désarchiver
          </button>
        ` : `
          <button class="action-btn" onclick="archiveCarte(${carteId})">
            📦 Archiver
          </button>
        `}
      </div>
      
      ${carte.Historique ? `
        <div class="history-section" style="margin-bottom: 24px; padding: 16px; background: var(--bg-main); border-radius: var(--radius-md);">
          <h3 style="margin: 0 0 12px 0; color: var(--text-primary); font-size: 0.95rem;">📝 Historique</h3>
          ${carte.Historique.split('\n').filter(h => h.trim()).slice(-5).reverse().map(entry => `
            <div class="history-entry">${escapeHtml(entry)}</div>
          `).join('')}
        </div>
      ` : ''}
      
      <div class="comments-section">
        <h3>💬 Commentaires (${cardComments.length})</h3>
        
        <div class="comments-list" id="comments-list">
          ${cardComments.length === 0 ? `
            <p style="color: var(--text-muted); text-align: center; padding: 20px;">
              Aucun commentaire. Soyez le premier !
            </p>
          ` : cardComments.map(comment => {
            const commentColor = generateColor(comment.Pseudo || 'Anonyme');
            return `
              <div class="comment">
                <div class="comment-avatar" style="background: ${commentColor}">
                  ${getInitials(comment.Pseudo || 'AN')}
                </div>
                <div class="comment-content">
                  <div class="comment-header">
                    <span class="comment-author">${escapeHtml(comment.Pseudo || 'Anonyme')}</span>
                    <span class="comment-date">${formatDate(comment.DateCommentaire)}</span>
                  </div>
                  <p class="comment-text">${escapeHtml(comment.Contenu)}</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <form class="comment-form" onsubmit="submitComment(event, ${carteId})">
          <input type="text" class="comment-input" id="comment-input" placeholder="Écrire un commentaire..." required>
          <button type="submit" class="btn btn-primary">Envoyer</button>
        </form>
      </div>
    </div>
    <button class="modal-close" onclick="closeModal()" style="position: absolute; top: 16px; right: 16px;">✕</button>
  `;
  modal.style.position = 'relative';
}

async function submitComment(event, carteId) {
  event.preventDefault();
  const input = document.getElementById('comment-input');
  const contenu = input.value.trim();
  if (!contenu) return;
  
  input.value = '';
  await addCommentaire(carteId, contenu);
}

async function updateUserPseudo(newPseudo) {
  // Cette fonction permet de changer le pseudo dans la table Users
  if (!state.currentUser) return;
  
  try {
    state.currentPseudo = newPseudo;
    await grist.docApi.applyUserActions([
      ['UpdateRecord', 'Users', state.currentUser.id, { Pseudo: newPseudo }]
    ]);
    showToast('Pseudo mis à jour !', 'success');
    await fetchAllData(true);
  } catch (err) {
    console.error('Erreur mise à jour pseudo:', err);
    showToast('Erreur lors de la mise à jour du pseudo', 'error');
  }
}

function showError(message) {
  document.getElementById('app').innerHTML = `
    <div class="loading">
      <div style="font-size: 3rem;">😕</div>
      <p>${message}</p>
      <button class="btn btn-primary" onclick="location.reload()">Réessayer</button>
    </div>
  `;
}

async function toggleModeration() {
  if (!state.isAdmin) {
    showToast('Action réservée aux administrateurs', 'error');
    return;
  }

  const newValue = !state.moderationActive;

  if (!confirm(`Voulez-vous ${newValue ? 'activer' : 'désactiver'} la modération ?`)) return;

  try {
    const moderationConfig = state.configuration.find(c => c.Cle === 'moderation_active');

    if (moderationConfig) {
      await grist.docApi.applyUserActions([
        ['UpdateRecord', 'Configuration', moderationConfig.id, { Valeur: newValue }]
      ]);

      state.moderationActive = newValue;
      showToast(`Modération ${newValue ? 'activée' : 'désactivée'} !`, 'success');

      renderHeader();
      renderBoard();
    }
  } catch (err) {
    console.error('Erreur toggle modération:', err);
    showToast('Erreur lors de la modification de la modération', 'error');
  }
}

// ==================== INIT ====================
document.body.setAttribute('data-theme', state.currentTheme);

grist.ready({
  requiredAccess: 'full',
  columns: []
});

grist.onRecords(function(records) {
  if (state.modalType === 'cardEdit' || state.modalType === 'cardNew' ||
      state.modalType === 'categoryEdit' || state.modalType === 'categoryNew') {
    return;
  }

  if (state.isSyncing) {
    return;
  }

  fetchAllData(true);
});

function setupSearchBar() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  // Expand on focus
  searchInput.addEventListener('focus', function() {
    this.classList.add('expanded');
  });

  // Collapse on blur if empty
  searchInput.addEventListener('blur', function() {
    if (this.value.trim() === '') {
      this.classList.remove('expanded');
    }
  });

  // Expand on hover
  searchInput.addEventListener('mouseenter', function() {
    this.classList.add('expanded');
  });

  // Handle escape key to collapse
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (this.value.trim() === '') {
        this.classList.remove('expanded');
        this.blur();
      } else {
        this.value = '';
        this.classList.remove('expanded');
        updateSearch('');
      }
    }
  });
}

render();
fetchAllData();