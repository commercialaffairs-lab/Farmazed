/**
 * Farmazed — Shared app shell (sidebar + topbar)
 * Renders the Approx-theme-based sidebar/topbar around a page's existing
 * content, wired to real Firebase auth (not the design prototypes'
 * sessionStorage-only fake auth). Used by both the client portal and the
 * admin panel — only the nav item set and role differ.
 */
import { requireLogin, isAdmin, logout } from './auth.js';

const NAV = {
  client: [
    { section: 'Mi Portal', items: [
      { id: 'resumen',    icon: 'iconoir-home-simple', label: 'Resumen',        href: '/portal/dashboard.html' },
      { id: 'productos',  icon: 'iconoir-package',     label: 'Mis Productos',  href: '/portal/dashboard.html#productos' },
      { id: 'documentos', icon: 'iconoir-page',        label: 'Mis Documentos', href: '/portal/dashboard.html#documentos' },
      { id: 'mensajes',   icon: 'iconoir-chat-bubble', label: 'Mensajes',       href: '/portal/dashboard.html#mensajes', badgeId: 'msg-badge' },
    ]},
    { section: 'Trámites', items: [
      { id: 'solicitar', icon: 'iconoir-add-circle', label: 'Solicitar Registro', href: '/portal/nuevo.html' },
    ]},
  ],
  admin: [
    { section: 'Panel', items: [
      { id: 'casos',   icon: 'iconoir-list-select', label: 'Expedientes', href: '/admin/casos.html' },
      { id: 'precios', icon: 'iconoir-coins',       label: 'Precios',     href: '/admin/precios.html' },
    ]},
  ],
};

function navHtml(role, activeId) {
  return (NAV[role] || []).map(group => `
    <li class="nav-section-label">${group.section}</li>
    ${group.items.map(item => `
      <li class="nav-item">
        <a href="${item.href}" class="nav-link${item.id === activeId ? ' active' : ''}" data-nav-id="${item.id}">
          <i class="${item.icon} menu-icon"></i>
          <span>${item.label}</span>
          ${item.badgeId ? `<span class="badge ms-auto" id="${item.badgeId}" style="background:var(--fz-amber);display:none;"></span>` : ''}
        </a>
      </li>`).join('')}
  `).join('');
}

/**
 * Renders the shell and enforces auth. Returns { user, admin }, or null if
 * the page navigated away (not logged in, or admin-only page + not admin).
 *
 * @param {object} opts
 * @param {'client'|'admin'} opts.role
 * @param {string} opts.activeNav  - nav item id to highlight
 * @param {string} [opts.logoPath] - relative path to Logo.png from this page
 */
export async function initShell({ role, activeNav, logoPath = '../src/images/Logo.png' }) {
  const user = await requireLogin();

  const admin = await isAdmin();
  if (role === 'admin' && !admin) {
    window.location.href = '/portal/dashboard.html';
    return null;
  }

  document.body.insertAdjacentHTML('afterbegin', `
    <div class="topbar d-print-none">
      <div class="container-fluid">
        <nav class="topbar-custom d-flex justify-content-between align-items-center">
          <ul class="topbar-item list-unstyled d-flex align-items-center mb-0">
            <li>
              <button class="nav-link mobile-menu-btn nav-icon border-0 bg-transparent" id="togglemenu" type="button">
                <i class="iconoir-menu" style="color:#fff;font-size:1.3rem;"></i>
              </button>
            </li>
          </ul>
          <ul class="topbar-item list-unstyled d-flex align-items-center gap-3 mb-0">
            <li class="dropdown">
              <a class="nav-link" data-bs-toggle="dropdown" href="#" role="button">
                <div class="tb-user">
                  <div>
                    <div class="tb-user-name" id="tb-user-name">${user.displayName || user.email}</div>
                    <div class="tb-user-role">${admin ? 'Administrador' : 'Cliente'}</div>
                  </div>
                  <div class="tb-dot"></div>
                </div>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item" href="#" id="btn-logout"><i class="iconoir-log-out me-2"></i>Cerrar sesión</a></li>
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <div class="startbar d-print-none">
      <div class="brand">
        <div class="logo d-flex align-items-center gap-2">
          <img src="${logoPath}" alt="Farmazed" style="height:44px;">
          <span>Farmazed</span>
        </div>
      </div>
      <div class="startbar-menu">
        <div class="startbar-collapse" id="startbarCollapse">
          <ul class="navbar-nav">
            ${navHtml(role, activeNav)}
          </ul>
        </div>
      </div>
      <div class="startbar-footer">Farmazed<br>Asuntos Regulatorios · Panamá 2026</div>
    </div>
    <div class="startbar-overlay d-print-none"></div>
  `);

  document.getElementById('btn-logout')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });

  return { user, admin };
}
