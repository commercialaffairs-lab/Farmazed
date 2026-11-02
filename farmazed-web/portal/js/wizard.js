/**
 * Farmazed — New Case Wizard (5 steps)
 * Handles step navigation, checklist rendering, and file upload (native fetch).
 */
import { esc, requireLogin } from './auth.js';
import api from './api.js';
import { confirmar } from './dialogos.js';

// Idiomas (farmazed-web/i18n/README.md): i18n.js es un script clásico del <head>. Con fallback
// porque portal/nuevo.html también carga este módulo y puede no traer la capa.
const i18n = () => window.FZI18N || null;
// Sin la capa (portal/nuevo.html) se interpolan igual los {marcadores}, para no mostrarlos literales.
const interpolar = (texto, vars) => String(texto ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));
const t = (texto, vars) => (i18n() ? i18n().t(texto, vars) : interpolar(texto, vars));

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  user:     null,
  step:     1,
  caseId:   null,           // set after step 1 creates the case
  uploads:  {},             // { [faddiDocId]: { file, status, docId } }
  data: {
    tramiteType:     '',
    tipoSolicitud:   'Nuevo Registro',
    tipoRegistro:    'Regular',
    tipoMedicamento: [],
    product:         {},
    entities:        {},
  },
};

// ── FADDI Tramite metadata ─────────────────────────────────────────────────────
// D15 — ESTRUCTURA DECLARATIVA UNICA.
//
//   disponible: false  → el trámite/vía NO se renderiza en el Paso 1.
//   disponible: true   → se renderiza.
//
// Encender o apagar una vía es cambiar UN valor aquí. Ninguna función de
// render se toca: todas leen de estas dos listas y de los derivados de abajo.
//
// `flujoPropio: false` significa "se muestra, pero no avanza: el cliente va a
// gestión personalizada". Es independiente de `disponible`.
const TRAMITES = [
  { id: 'medicamentos', label: 'Medicamentos',                       icon: '💊', desc: 'Síntesis química, biológicos, homeopáticos, huérfanos y demás.',  disponible: true,  flujoPropio: true },
  { id: 'cosmeticos',   label: 'Cosméticos y Similares',            icon: '🧴', desc: 'Cremas, shampoos, maquillaje, protectores solares, etc.',          disponible: true,  flujoPropio: true },
  // ── Decisión F-2 (R1+Z3 / B10) — checklist construido leyendo decretos, SIN
  // validación del área regulatoria. Rick decidió OCULTARLOS del front end
  // mientras no haya matriz validada: opción (a). Para revertir, poner estos
  // cuatro `disponible` en true (solo front end; el backend no se tocó).
  // Ver organizacion/06_TRAMITES_NO_VALIDADOS_D15.md
  //   (a) ocultar  → disponible: false   ← ACTIVA
  //   (b) avisar   → disponible: true,  flujoPropio: false
  //   (c) como está→ disponible: true,  flujoPropio: true
  { id: 'higienicos',   label: 'Higiénicos / Desinfectantes',       icon: '🧼', desc: 'Antisépticos, desinfectantes de uso doméstico u hospitalario.',    disponible: false, flujoPropio: true },
  { id: 'plaguicidas',  label: 'Plaguicidas',                        icon: '🌿', desc: 'Uso doméstico o profesional (químico, biológico, otro).',          disponible: false, flujoPropio: true },
  { id: 'excepcion',    label: 'Excepción al Registro Sanitario',   icon: '🚨', desc: 'Calamidad, razón humanitaria, desabasto o investigación.',         disponible: false, flujoPropio: true },
  { id: 'publicidad',   label: 'Publicidad de Producto Registrado', icon: '📢', desc: 'Aprobación de material publicitario de un RS vigente.',            disponible: false, flujoPropio: true },
];

// Vías de registro (solo aplican a `medicamentos`).
//   paisesARR: muestra el panel informativo de países (D.E. 29/2023).
const VIAS_REGISTRO = [
  { id: 'Regular',              label: 'Regular',              disponible: true,  flujoPropio: true,  paisesARR: false },
  { id: 'Abreviado',            label: 'Abreviado',            disponible: true,  flujoPropio: true,  paisesARR: true  },
  { id: 'Reconocimiento Mutuo', label: 'Reconocimiento Mutuo', disponible: true,  flujoPropio: false, paisesARR: true  },
  { id: 'Reconocimiento WLA',   label: 'Reconocimiento WLA',   disponible: true,  flujoPropio: false, paisesARR: false },
  // 5.ª vía — B01/Z17. La Fase 2 verificó el Drive completo: NO existe matriz,
  // ni borrador, ni notas de WHO-PQP. Queda declarada y apagada: el día que
  // Zelky entregue la matriz, esto es `disponible: true` y nada más.
  { id: 'WHO-PQP',              label: 'Reconocimiento WHO-PQP', disponible: false, flujoPropio: false, paisesARR: false },
];

// ── Derivados. Nadie más filtra por su cuenta; todo sale de aquí. ─────────────
const tramitesVisibles = () => TRAMITES.filter(t => t.disponible);
const viasVisibles     = () => VIAS_REGISTRO.filter(v => v.disponible);
const getTramite       = id => TRAMITES.find(t => t.id === id) || null;
const getVia           = id => VIAS_REGISTRO.find(v => v.id === id) || null;

// Compatibilidad con el resto del archivo: mismos nombres, mismo contenido,
// ahora derivados en vez de escritos a mano en dos sitios.
const TIPOS_REGISTRO           = viasVisibles().map(v => v.id);
const TIPOS_REGISTRO_SIN_FLUJO = VIAS_REGISTRO.filter(v => !v.flujoPropio).map(v => v.id);
const TIPOS_REGISTRO_CON_PAISES = VIAS_REGISTRO.filter(v => v.paisesARR).map(v => v.id);
// Debe coincidir EXACTO con las keys de MED_VARIABLE_BY_SUBTYPE en
// tracker/data/faddi_checklists.js — un nombre distinto hace que getChecklist()
// devuelva [] en silencio para ese subtipo (bug encontrado por el PM 2026-08-26).
// 'Producto Hemoderivado', 'Alérgeno' y 'Cannabis' se quitaron: no tienen
// entrada en faddi_checklists.js todavía — agregar ambos lados a la vez si
// Farmazed confirma que gestiona esos trámites.
const TIPOS_MED = [
  'Síntesis Química', 'Biológicos', 'Biotecnológicos', 'Homeopático',
  'Huérfanos', 'Radiofármaco', 'Vacuna', 'Medio de Contraste',
  'Gas Medicinal', 'Suplementos', 'Productos Naturales',
];
const CONDICION_VENTA = [
  'Con Prescripción Médica', 'Sin Prescripción Médica',
  'Venta Libre o Venta Popular', 'Con Prescripción Médica Controlada',
];
const TIPOS_PUBLICIDAD = [
  'Impresos', 'Audiovisuales', 'Cupones promocionales', 'Material Promocional', 'Otros',
];

// ── DOM helpers ───────────────────────────────────────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function showStep(n) {
  $$('.wz-step').forEach(el => el.classList.add('d-none'));
  $(`#step-${n}`)?.classList.remove('d-none');
  $$('.wz-tab').forEach((el, i) => {
    el.classList.toggle('active',   i + 1 === n);
    el.classList.toggle('done',     i + 1 < n);
  });
  state.step = n;
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.dataset.orig = btn.dataset.orig || btn.innerHTML;
  btn.innerHTML = loading
    ? `<span class="spinner-border spinner-border-sm me-2"></span>${esc(t('Guardando...'))}`
    : btn.dataset.orig;
}

function showLoadingModal(msg = t('Procesando...')) {
  const modal = $('#fz-loading-modal');
  if (!modal) return;
  const msgEl = $('#fz-loading-msg');
  if (msgEl) msgEl.textContent = msg;
  modal.classList.add('show');
}

function hideLoadingModal() {
  $('#fz-loading-modal')?.classList.remove('show');
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${type} border-0 show position-fixed bottom-0 end-0 m-3`;
  el.style.zIndex = 9999;
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(msg)}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.toast').remove()"></button></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ── Step 1: Tipo de trámite ───────────────────────────────────────────────────
// Solo pinta (sin cablear eventos): se vuelve a llamar al cambiar de idioma.
function pintarTramites(grid) {
  grid.innerHTML = tramitesVisibles().map(tr => `
    <div class="col-md-4 col-sm-6">
      <label class="tramite-card ${state.data.tramiteType === tr.id ? 'selected' : ''}" data-id="${tr.id}">
        <input type="radio" name="tramiteType" value="${tr.id}" class="d-none" ${state.data.tramiteType === tr.id ? 'checked' : ''}>
        <div class="tramite-icon">${tr.icon}</div>
        <div class="tramite-label">${esc(t(tr.label))}</div>
        <div class="tramite-desc text-muted small">${esc(t(tr.desc))}</div>
      </label>
    </div>`).join('');
}

// Opciones de la vía de registro (valor = español, texto = traducido). Conserva la elegida.
function pintarViasRegistro(tipoRegSelect) {
  tipoRegSelect.innerHTML = TIPOS_REGISTRO.map(id => `<option value="${esc(id)}">${esc(t(getVia(id)?.label || id))}</option>`).join('');
  tipoRegSelect.value = state.data.tipoRegistro;
}

function renderStep1() {
  const grid = $('#tramite-grid');
  pintarTramites(grid);

  // Sync visibility for a resumed case (state.data.tramiteType already set before first render)
  $('#med-extra')?.classList.toggle('d-none', state.data.tramiteType !== 'medicamentos');
  $('#excepcion-disclaimer')?.classList.toggle('d-none', state.data.tramiteType !== 'excepcion');

  // Tipo de solicitud / registro (only for medicamentos)
  if (grid.dataset.wired) return; // el repintado por idioma no vuelve a cablear
  grid.dataset.wired = '1';
  grid.addEventListener('click', e => {
    const card = e.target.closest('.tramite-card');
    if (!card) return;
    $$('.tramite-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    card.querySelector('input').checked = true;
    state.data.tramiteType = card.dataset.id;
    const medExtra = $('#med-extra');
    if (medExtra) medExtra.classList.toggle('d-none', state.data.tramiteType !== 'medicamentos');
    const excDisclaimer = $('#excepcion-disclaimer');
    if (excDisclaimer) excDisclaimer.classList.toggle('d-none', state.data.tramiteType !== 'excepcion');
  });

  // Tipo de registro (Medicamentos only)
  const tipoRegSelect = $('#tipoRegistro');
  if (tipoRegSelect) {
    pintarViasRegistro(tipoRegSelect);
    // Gap E (auditoría regulatoria PM 2026-08-26): panel informativo de países
    // habilitados (D.E. 29/2023). Ahora sale del flag `paisesARR` de VIAS_REGISTRO.
    const syncContactenos = () => {
      $('#tipo-registro-contactenos')?.classList.toggle('d-none', !TIPOS_REGISTRO_SIN_FLUJO.includes(tipoRegSelect.value));
      $('#abreviado-paises-panel')?.classList.toggle('d-none', !TIPOS_REGISTRO_CON_PAISES.includes(tipoRegSelect.value));
    };
    syncContactenos();
    tipoRegSelect.addEventListener('change', () => {
      state.data.tipoRegistro = tipoRegSelect.value;
      syncContactenos();
    });
  }
}

// ── Step 2: Datos del producto ────────────────────────────────────────────────
function renderStep2() {
  const tramiteType = state.data.tramiteType;
  const isMed = tramiteType === 'medicamentos';
  const isPub = tramiteType === 'publicidad';

  // Unified field visibility: an element with data-tramites shows only for
  // the listed tramiteTypes (comma-separated). No attribute = always shown.
  $$('[data-tramites]').forEach(el => {
    const allowed = el.dataset.tramites.split(',').map(s => s.trim());
    el.classList.toggle('d-none', !allowed.includes(tramiteType));
  });

  // Tipo medicamento checkboxes
  // (valor = español tal como lo espera faddi_checklists.js; texto visible = traducido)
  const container = $('#tipo-med-checks');
  if (container && isMed) {
    container.innerHTML = TIPOS_MED.map(tm => `
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" value="${tm}" id="tm-${tm.replace(/\s/g,'-')}"
          ${state.data.tipoMedicamento.includes(tm) ? 'checked' : ''}>
        <label class="form-check-label" for="tm-${tm.replace(/\s/g,'-')}">${esc(t(tm))}</label>
      </div>`).join('');
    if (!container.dataset.wired) {
      container.dataset.wired = '1';
      container.addEventListener('change', () => {
        state.data.tipoMedicamento = $$('input[type=checkbox]:checked', container).map(cb => cb.value);
      });
    }
  }

  // Tipo publicidad checkboxes
  const pubContainer = $('#tipo-pub-checks');
  if (pubContainer && isPub) {
    const selected = state.data.product.tipoPublicidad || [];
    pubContainer.innerHTML = TIPOS_PUBLICIDAD.map(tp => `
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" value="${tp}" id="tp-${tp.replace(/\s/g,'-')}"
          ${selected.includes(tp) ? 'checked' : ''}>
        <label class="form-check-label" for="tp-${tp.replace(/\s/g,'-')}">${esc(t(tp))}</label>
      </div>`).join('');
    // Igual que tipo de medicamento: lo marcado se guarda al vuelo, así un cambio de idioma (que
    // repinta el paso) no borra la selección.
    if (!pubContainer.dataset.wired) {
      pubContainer.dataset.wired = '1';
      pubContainer.addEventListener('change', () => {
        state.data.product.tipoPublicidad = $$('input[type=checkbox]:checked', pubContainer).map(cb => cb.value);
      });
    }
  }

  // Condición de venta
  const condSelect = $('#condicionVenta');
  if (condSelect) {
    condSelect.innerHTML = CONDICION_VENTA.map(c => `<option value="${esc(c)}">${esc(t(c))}</option>`).join('');
    if (state.data.product.condicionVenta) condSelect.value = state.data.product.condicionVenta;
  }

  // Restore field values
  const fields = ['nombreComercial','principioActivo','concentracion','formaFarmaceutica',
                  'viaAdministracion','codigoATC','descripcionEnvase','vidaUtil',
                  'condicionesAlmacenamiento','descripcionPresentacion','clasificacion',
                  'variante','formaCosmetica','numeroRegistroSanitario','codigoPublicidad',
                  'descripcionMaterial','lote','paisOrigen','cantidadImportar'];
  fields.forEach(f => {
    const el = $(`#${f}`);
    if (el && state.data.product[f]) el.value = state.data.product[f];
  });

  // Restore tipoPresentacion radio (defaults to Comercial via the HTML's checked attr)
  if (state.data.product.tipoPresentacion) {
    const radio = $(`input[name=tipoPresentacion][value="${state.data.product.tipoPresentacion}"]`);
    if (radio) radio.checked = true;
  }
}

function collectStep2() {
  const fields = ['nombreComercial','principioActivo','concentracion','formaFarmaceutica',
                  'viaAdministracion','condicionVenta','codigoATC','descripcionEnvase',
                  'vidaUtil','condicionesAlmacenamiento','descripcionPresentacion',
                  'tipoPresentacion','clasificacion','variante','formaCosmetica',
                  'numeroRegistroSanitario','codigoPublicidad','descripcionMaterial',
                  'lote','paisOrigen','cantidadImportar'];
  const product = {};
  fields.forEach(f => {
    const el = $(`#${f}`);
    if (el) product[f] = el.value;
  });
  const radios = $$('input[name=tipoPresentacion]:checked');
  if (radios.length) product.tipoPresentacion = radios[0].value;
  const pubContainer = $('#tipo-pub-checks');
  if (pubContainer) {
    product.tipoPublicidad = $$('input[type=checkbox]:checked', pubContainer).map(cb => cb.value);
  }
  state.data.product = product;
}

// ── Step 3: Entidades ─────────────────────────────────────────────────────────
function collectEntities() {
  const collect = (prefix) => {
    const obj = {};
    $$(`[id^="${prefix}-"]`).forEach(el => { obj[el.id.replace(prefix + '-', '')] = el.value; });
    return obj;
  };
  state.data.entities = {
    fabricante:          collect('fab'),
    titular:             collect('tit'),
    solicitante:         collect('sol'),
    representanteLegal:  collect('rep'),
    abogado:             collect('abo'),
    farmaceutico:        collect('far'),
    distribuidores:      $$('.distribuidor-licencia').map(el => ({ numeroLicencia: el.value })).filter(d => d.numeroLicencia),
  };
}

// ── Step 4: Carga documental ──────────────────────────────────────────────────
let currentChecklist = [];

async function renderChecklist() {
  const container = $('#checklist-container');
  if (!container || !state.caseId) return;
  container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

  try {
    const { checklist, progress } = await api.getChecklist(state.caseId);
    currentChecklist = checklist;
    renderProgressBar(progress);

    // D11 (organizacion/03_INSTRUCCIONES_DEV.md fila D11, depende de D10):
    // separar por responsable, no por obligatorio/opcional — esa distinción
    // sigue visible en cada tarjeta (badge Obligatorio/Opcional), pero lo que
    // decide si el cliente puede avanzar es de QUIÉN es el documento.
    const clienteDocs  = checklist.filter(d => d.responsable !== 'farmazed');
    const farmazedDocs = checklist.filter(d => d.responsable === 'farmazed');

    container.innerHTML = `
      ${enDemo() ? avisoDocumentosDemo() : ''}
      ${renderDocGroup(t('Documentos que subes tú'), clienteDocs)}
      ${farmazedDocs.length ? renderDocGroup(t('Documentos que aporta Farmazed'), farmazedDocs) : ''}`;

    // Attach upload handler once — innerHTML above replaces children but not
    // the container node itself, so re-adding here on every refresh would
    // stack duplicate listeners and cause repeated uploads.
    if (!container.dataset.wired) {
      container.dataset.wired = '1';
      // Cuenta demo: los botones "Subir" no abren el explorador de archivos, van al aviso que simula
      // la carga (ver "Modo demo" más abajo). preventDefault sobre el <label> evita que active al
      // <input type="file">. Fuera de la demo no interviene.
      container.addEventListener('click', e => {
        if (!enDemo()) return;
        if (e.target.closest('#btn-demo-docs')) { e.preventDefault(); simularTodosLosDocumentosDemo(); return; }
        const etiqueta = e.target.closest('.doc-upload-action label');
        if (!etiqueta) return;
        e.preventDefault();
        abrirSimulacionDemo(etiqueta.querySelector('input[type=file]')?.dataset.docid);
      });
      container.addEventListener('change', e => {
        if (e.target.type === 'file' && e.target.files[0]) {
          const docId = e.target.dataset.docid;
          const file  = e.target.files[0];
          if (file.size > 52 * 1024 * 1024) {
            toast(t('El archivo supera los 50 MB.'), 'danger');
            e.target.value = '';
            return;
          }
          state.uploads[docId] = { file, status: 'pending' };
          uploadDoc(docId, file, currentChecklist.find(d => d.id === docId));
        }
      });
    }

    updateNextButtonState();
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`;
  }
}

// D11: el botón de continuar del Paso 4 se bloquea SOLO por documentos
// obligatorios de responsable:'cliente' — los de Farmazed nunca bloquean al
// cliente (son tarea interna, ver admin/expediente.html).
function updateNextButtonState() {
  if (state.step !== 4) return;
  const btn = $('#btn-next');
  if (!btn) return;
  const missingCliente = currentChecklist.filter(
    d => d.required && d.responsable !== 'farmazed' && !d.uploaded
  );
  btn.disabled = missingCliente.length > 0;
  btn.title = missingCliente.length
    ? t('Faltan {n} documento(s) obligatorio(s) tuyo(s) por subir', { n: missingCliente.length })
    : '';
}

function renderProgressBar({ uploaded, total, percent }) {
  const bar = $('#upload-progress');
  if (!bar) return;
  bar.innerHTML = `
    <div class="d-flex justify-content-between mb-1">
      <small>${t('<strong>{subidos}</strong> de <strong>{total}</strong> documentos subidos', { subidos: Number(uploaded) || 0, total: Number(total) || 0 })}</small>
      <small>${percent}%</small>
    </div>
    <div class="progress" style="height:8px">
      <div class="progress-bar bg-success" style="width:${percent}%"></div>
    </div>`;
}

function renderDocGroup(title, docs, collapsed = false) {
  return `
    <div class="doc-group mb-4">
      <h6 class="text-muted fw-bold mb-3 text-uppercase small">${esc(title)}</h6>
      ${docs.map(d => renderDocCard(d)).join('')}
    </div>`;
}

function renderDocCard(doc) {
  const up       = state.uploads[doc.id];
  const status   = up?.status || (doc.uploaded ? 'uploaded' : 'pending');
  const icons    = { pending: '⬜', pending_upload: '📤', uploaded: '✅', approved: '✅', rejected: '❌', requested: '🔔' };
  const badge    = { pending: 'secondary', uploaded: 'success', approved: 'success', rejected: 'danger', requested: 'warning' };
  // FADDI doesn't have an upload slot for this doc — client must present it
  // physically at DNFD (e.g. the CLV for cosméticos, per RTCA 71.03.35:21).
  // NOTE: faddiCode 'EXTRA' alone isn't a reliable signal — it's also used
  // for docs that need prior arrangement but ARE still uploaded once
  // obtained (e.g. hig_cotizacion). physicalOnly is the explicit marker.
  const isPhysicalOnly = doc.physicalOnly === true;
  // D11: documento a cargo de Farmazed — el cliente lo ve, pero no lo sube
  // ni lo bloquea (ver updateNextButtonState arriba).
  const isFarmazedDoc  = doc.responsable === 'farmazed';

  return `
    <div class="doc-card card mb-2 border-0 shadow-sm" id="doc-${esc(doc.id)}">
      <div class="card-body py-2 px-3 d-flex align-items-start gap-3">
        <div class="doc-status-icon fs-5 mt-1">${isPhysicalOnly ? '📍' : (icons[status] || '⬜')}</div>
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="fw-semibold small">${esc(doc.faddiCode)} — ${esc(t(doc.name))}</span>
            ${doc.required ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle small">${esc(t('Obligatorio'))}</span>` : `<span class="badge bg-secondary-subtle text-secondary border small">${esc(t('Opcional'))}</span>`}
            ${!isPhysicalOnly ? `<span class="badge bg-${badge[status] || 'secondary'} small">${esc(status)}</span>` : ''}
          </div>
          <div class="text-muted small mt-1">${esc(t(doc.description))}</div>
          ${up?.file ? `<div class="small text-success mt-1">📎 ${esc(up.file.name)}</div>` : ''}
          ${doc.condition ? `<div class="small text-warning-emphasis mt-1">⚡ ${esc(t(doc.condition))}</div>` : ''}
          ${isPhysicalOnly ? `<div class="small text-info mt-1">📍 ${esc(t('Este documento se presenta físicamente en DNFD, no se carga en FADDI. Farmazed coordinará la entrega.'))}</div>` : ''}
          ${isFarmazedDoc ? `<div class="small text-primary mt-1">🏢 ${esc(t('Este documento lo aporta Farmazed — no necesitas subirlo tú, y no bloquea tu avance.'))}</div>` : ''}
        </div>
        <div class="doc-upload-action" style="min-width:120px">
          ${isFarmazedDoc
            ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle small">${esc(t('A cargo de Farmazed'))}</span>`
            : isPhysicalOnly
            ? `<span class="badge bg-info-subtle text-info border border-info-subtle small">${esc(t('Presencial'))}</span>`
            : status === 'uploaded' || status === 'approved'
            ? `<span class="text-success small">✓ ${esc(t('Subido'))}</span>`
            : `<label class="btn btn-sm btn-outline-primary" style="cursor:pointer">
                 <input type="file" class="d-none" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" data-docid="${esc(doc.id)}">
                 ${status === 'pending_upload' ? '<span class="spinner-border spinner-border-sm"></span>' : `📎 ${esc(t('Subir'))}`}
               </label>`}
        </div>
      </div>
    </div>`;
}

async function uploadDoc(faddiDocId, file, docMeta) {
  const card = $(`#doc-${faddiDocId}`);
  if (card) card.querySelector('.doc-upload-action').innerHTML = '<span class="spinner-border spinner-border-sm text-primary"></span>';
  showLoadingModal(t('Subiendo documento...'));

  try {
    await api.uploadDocument(state.caseId, file, {
      faddiDocId,
      faddiCode:    docMeta?.faddiCode    || '',
      faddiDocName: docMeta?.name         || '',
      faddiStep:    docMeta?.faddiStep    || 0,
    });
    state.uploads[faddiDocId] = { file, status: 'uploaded' };
    // Await the refresh so the checklist's own spinner-then-render swap
    // happens behind the modal instead of flashing in front of the user —
    // the modal fade-out is what reveals the already-updated list.
    await renderChecklist();
    toast(t('✅ {documento} subido correctamente.', { documento: t(docMeta?.name) || faddiDocId }));
    await warnIfPaqueteIEAExcedido();
  } catch (err) {
    state.uploads[faddiDocId] = { file, status: 'error' };
    toast(t('❌ Error al subir {documento}: {error}', { documento: t(docMeta?.name) || faddiDocId, error: err.message }), 'danger');
    if (card) card.querySelector('.doc-upload-action').innerHTML =
      `<label class="btn btn-sm btn-outline-danger" style="cursor:pointer">
         <input type="file" class="d-none" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" data-docid="${esc(faddiDocId)}">
         ${esc(t('Reintentar'))}
       </label>`;
  } finally {
    hideLoadingModal();
  }
}

// ── Modo demo: carga de documentos simulada (Rick, 01-nov-2026) ──────────────
// En la cuenta de demostración (client-dashboard.html pone body.fz-demo) los
// botones "Subir" del paso 4 no abren el explorador de archivos: un aviso
// explica que en un trámite real ahí se elige el archivo y, al confirmar, se
// adjunta por el cliente el PDF de ejemplo por la MISMA ruta que una subida
// real (POST /api/cases/:id/documents), así el expediente, el regente y el
// recorrido ven un documento normal. "Rellenar con datos de ejemplo" (banner
// del paso 4 y botón del portal) simula todos los documentos del cliente de
// una vez: los que faltan y los que el regente pidió o rechazó (subsanar).
const enDemo = () => document.body.classList.contains('fz-demo');
const PDF_EJEMPLO_DEMO = '/demo/documento-ejemplo.pdf';
const SIMULACIONES_PARALELAS = 3;
const ESTADOS_POR_SUBSANAR = ['requested', 'rejected'];
let pdfEjemploDemo = null; // Promise<File>: se descarga una sola vez por página

function archivoEjemploDemo() {
  if (!pdfEjemploDemo) {
    pdfEjemploDemo = fetch(PDF_EJEMPLO_DEMO)
      .then(r => { if (!r.ok) throw new Error(t('No se pudo cargar el PDF de ejemplo.')); return r.blob(); })
      .then(blob => new File([blob], 'documento-ejemplo.pdf', { type: 'application/pdf' }))
      .catch(err => { pdfEjemploDemo = null; throw err; });
  }
  return pdfEjemploDemo;
}

function avisoDocumentosDemo() {
  return `
    <div class="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2 small mb-4" id="demo-docs-aviso">
      <span>✨ ${esc(t('Modo demo: los botones "Subir" no abren el explorador de archivos, simulan la carga con un PDF de ejemplo. Para dejar todos los documentos listos de una vez:'))}</span>
      <button type="button" class="btn btn-sm btn-primary" id="btn-demo-docs">${esc(t('Rellenar con datos de ejemplo'))}</button>
    </div>`;
}

/** Ids de los documentos del cliente que la simulación "todos" deja como subidos: los que faltan y
 *  los pedidos o rechazados por el regente. Nunca los de Farmazed ni los presenciales. */
async function documentosPorSimularDemo() {
  const delCliente = currentChecklist.filter(d => d.responsable !== 'farmazed' && d.physicalOnly !== true);
  let porSubsanar = new Set();
  try {
    const docs = await api.listDocuments(state.caseId);
    porSubsanar = new Set((Array.isArray(docs) ? docs : []).filter(d => ESTADOS_POR_SUBSANAR.includes(d.status)).map(d => d.faddiDocId));
  } catch (e) {
    toast(t('No se pudo comprobar qué documentos pidió o rechazó el regente; se simulan solo los que faltan.'), 'warning');
  }
  return delCliente.filter(d => !d.uploaded || porSubsanar.has(d.id)).map(d => d.id);
}

// Una simulación a la vez: un doble clic en "Rellenar" (o un "Subir" mientras se lista) no debe
// duplicar subidas. El botón del banner se deshabilita mientras dura.
let simulacionEnCurso = false;
async function conSimulacionExclusiva(fn) {
  if (simulacionEnCurso || !state.caseId) return;
  simulacionEnCurso = true;
  const boton = $('#btn-demo-docs');
  if (boton) boton.disabled = true;
  try { await fn(); } finally {
    simulacionEnCurso = false;
    const b = $('#btn-demo-docs');
    if (b) b.disabled = false;
  }
}

const simularSubidasDemo = (ids) => conSimulacionExclusiva(() => ejecutarSimulacionDemo(ids));

async function simularTodosLosDocumentosDemo() {
  await conSimulacionExclusiva(async () => {
    showLoadingModal(t('Procesando...'));
    let ids = [];
    try {
      if (!currentChecklist.length) await renderChecklist(); // el botón del portal puede llegar antes de pintar la lista
      ids = await documentosPorSimularDemo();
    } finally { hideLoadingModal(); }
    await ejecutarSimulacionDemo(ids);
  });
}

async function ejecutarSimulacionDemo(ids) {
  if (!ids.length) { toast(t('Todos tus documentos ya están subidos.'), 'info'); return; }
  const progreso = (n) => showLoadingModal(t('Simulando la subida {n} de {total}...', { n: Math.min(n, ids.length), total: ids.length }));
  const errores = [];
  let subidas = 0;
  let iniciadas = 0;
  progreso(1);
  try {
    const archivo = await archivoEjemploDemo();
    const cola = [...ids];
    const trabajador = async () => {
      while (cola.length) {
        const id = cola.shift();
        const meta = currentChecklist.find(d => d.id === id);
        iniciadas += 1;
        progreso(iniciadas);
        try {
          await api.uploadDocument(state.caseId, archivo, {
            faddiDocId: id, faddiCode: meta?.faddiCode || '', faddiDocName: meta?.name || '', faddiStep: meta?.faddiStep || 0,
          });
          state.uploads[id] = { file: archivo, status: 'uploaded' };
          subidas += 1;
        } catch (err) {
          errores.push(`${meta?.faddiCode || id}: ${err.message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(SIMULACIONES_PARALELAS, ids.length) }, trabajador));
    // Repintar detrás del modal de carga; si falla, no es un error de subida (la lista se vuelve a
    // pintar al cambiar de paso o de idioma).
    try {
      await renderChecklist();
      if (state.step === 5) await renderConfirmation();
    } catch (e) { /* informativo */ }
  } catch (err) {
    errores.push(err.message);
  } finally {
    hideLoadingModal();
  }
  if (subidas) toast(t('✅ Simulación lista: {n} documento(s) registrados como subidos.', { n: subidas }));
  if (errores.length) toast(t('❌ No se pudo simular {n} documento(s): {error}', { n: errores.length, error: errores[0] }), 'danger');
}

async function abrirSimulacionDemo(docId) {
  if (!docId) return;
  const meta = currentChecklist.find(d => d.id === docId);
  const ok = await confirmar(
    t('En un trámite real, al pulsar "Subir" se abre el explorador de archivos y eliges el documento desde tu equipo (PDF, JPG, PNG o DOCX, hasta 50 MB). En la cuenta de demostración no hace falta buscar nada: al confirmar, se adjunta por ti un PDF de ejemplo y queda registrado como si lo hubieras subido. Con "Rellenar con datos de ejemplo" se simula la carga de todos los documentos a la vez.'),
    { titulo: t('Simulación de carga: {documento}', { documento: meta ? `${meta.faddiCode} — ${t(meta.name)}` : docId }), tipo: 'info', ok: t('Simular la subida'), cancelar: t('Cancelar') },
  );
  if (ok) await simularSubidasDemo([docId]);
}

// Lo usa rellenarConDatosDemo() en client-dashboard.html: del paso 4 en adelante, "rellenar" es
// simular todos los documentos.
window.__fzWizardDemo = { paso: () => state.step, simularTodos: simularTodosLosDocumentosDemo };

// R13 (TAREA 19): tras cada subida, si el paquete IEA (formula,
// metodo_analisis, cert_analisis, especificaciones, etiquetas — ver
// tracker/data/paquete_iea.js) supera las 150 páginas, se avisa al cliente.
// NUNCA bloquea el flujo — solo un toast informativo.
async function warnIfPaqueteIEAExcedido() {
  try {
    const { excedido, totalPaginas, limite } = await api.getPaqueteIEA(state.caseId);
    if (excedido) {
      toast(t('⚠️ El paquete de documentos para el IEA lleva {paginas} páginas (límite orientativo: {limite}). No bloquea tu solicitud — Farmazed lo revisa contigo.', { paginas: totalPaginas, limite }), 'warning');
    }
  } catch (e) { /* informativo — si falla, no se molesta al cliente */ }
}

// ── Step 5: Confirmación ──────────────────────────────────────────────────────
async function renderConfirmation() {
  const cs = await api.getCase(state.caseId);
  const cl = await api.getChecklist(state.caseId);
  // D11/TAREA 12: los documentos a cargo de Farmazed nunca deben contar como
  // "faltantes" del cliente aquí — antes de este fix, un cliente que subió
  // TODOS sus documentos igual veía "⚠️ Documentos obligatorios faltantes
  // (3)" listando tasa_servicio/recibo_cnf/recibo_iea (tarea interna de
  // Farmazed), como si él se hubiera dejado algo. Mismo criterio que
  // updateNextButtonState() y renderChecklist() ya aplican en este archivo.
  const missing = cl.checklist.filter(d => d.required && !d.uploaded && d.responsable !== 'farmazed');

  $('#confirm-product-name').textContent = cs.product?.nombreComercial || t('(sin nombre)');
  $('#confirm-tramite').textContent      = cs.tramiteType;
  $('#confirm-progress').textContent     = t('{subidos}/{total} documentos', { subidos: cl.progress.uploaded, total: cl.progress.total });

  const missingEl = $('#confirm-missing');
  if (missing.length) {
    missingEl.innerHTML = `<div class="alert alert-warning">
      <strong>${esc(t('⚠️ Documentos obligatorios faltantes ({n}):', { n: missing.length }))}</strong>
      <ul class="mb-0 mt-2">${missing.map(d => `<li>${esc(d.faddiCode)} — ${esc(t(d.name))}</li>`).join('')}</ul>
      <p class="mb-0 mt-2 small">${esc(t('Puedes enviar ahora y subir los documentos faltantes luego, o regresar al Paso 4.'))}</p>
    </div>`;
  } else {
    missingEl.innerHTML = `<div class="alert alert-success">${esc(t('✅ Todos los documentos obligatorios están subidos.'))}</div>`;
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
async function nextStep() {
  const btn = $('#btn-next');
  setLoading(btn, true);

  try {
    if (state.step === 1) {
      if (!state.data.tramiteType) { toast(t('Selecciona el tipo de trámite.'), 'warning'); return; }
      // Guarda 1 — trámite apagado. Cubre el caso de un ?caseId= antiguo cuyo
      // trámite ya no está disponible: la tarjeta no se ve, pero el estado
      // restaurado (init(), resume from URL param) sí la trae.
      const tramite = getTramite(state.data.tramiteType);
      if (!tramite || !tramite.disponible) {
        toast(t('Este trámite no está disponible en el portal. Contáctanos y un especialista de Farmazed te guiará.'), 'warning');
        return;
      }
      // Guarda 2 — trámite visible pero sin flujo propio (opción (b)).
      if (!tramite.flujoPropio) {
        toast(t('Este trámite requiere gestión personalizada. Contáctenos directamente.'), 'warning');
        return;
      }
      // Guarda 3 — vía de medicamentos sin flujo propio (comportamiento actual).
      if (state.data.tramiteType === 'medicamentos' && TIPOS_REGISTRO_SIN_FLUJO.includes(state.data.tipoRegistro)) {
        toast(t('Este tipo de trámite requiere gestión personalizada. Contáctenos directamente.'), 'warning');
        return;
      }
      // Create case in Firestore
      if (!state.caseId) {
        const res = await api.createCase({
          tramiteType:     state.data.tramiteType,
          tipoSolicitud:   state.data.tipoSolicitud,
          tipoRegistro:    state.data.tipoRegistro,
          tipoMedicamento: state.data.tipoMedicamento,
        });
        state.caseId = res.id;
        window.history.replaceState({}, '', `?caseId=${state.caseId}`);
      } else {
        await api.updateCase(state.caseId, {
          tramiteType:     state.data.tramiteType,
          tipoSolicitud:   state.data.tipoSolicitud,
          tipoRegistro:    state.data.tipoRegistro,
          tipoMedicamento: state.data.tipoMedicamento,
        });
      }
    }

    if (state.step === 2) {
      collectStep2();
      await api.updateCase(state.caseId, { product: state.data.product, tipoMedicamento: state.data.tipoMedicamento });
    }

    if (state.step === 3) {
      collectEntities();
      await api.updateCase(state.caseId, { entities: state.data.entities });
    }

    if (state.step === 4) {
      // D11: guard defensivo — el botón ya viene deshabilitado por
      // updateNextButtonState(), esto cubre el caso de que se reactive por
      // fuera (ej. devtools) o quede un estado viejo antes del refresh.
      const missingCliente = currentChecklist.filter(
        d => d.required && d.responsable !== 'farmazed' && !d.uploaded
      );
      if (missingCliente.length) {
        toast(t('Faltan {n} documento(s) obligatorio(s) tuyo(s) por subir.', { n: missingCliente.length }), 'warning');
        return;
      }
    }

    if (state.step === 5) {
      await api.updateCase(state.caseId, { status: 'submitted' });
      toast(t('🎉 Expediente enviado a Farmazed para revisión.'));
      // Bug encontrado en TAREA 12/D16: el modo embebido (showModule existe)
      // solo cambiaba de módulo SIN recargar — el caso recién creado quedaba
      // invisible en "Mis Productos" porque DATA.productos se carga una sola
      // vez al abrir client-dashboard.html, antes de que este caso existiera.
      // El modo standalone SÍ recargaba (y por eso nunca tuvo el bug) — se
      // unifica en ambos casos: una recarga completa siempre trae datos
      // frescos, que es lo único que garantiza ver el caso nuevo.
      setTimeout(() => { window.location.href = '/client-dashboard.html'; }, 2000);
      return;
    }

    showStep(state.step + 1);

    // TAREA 10 (a): bug real, no cosmético — renderStep2() solo se llamaba
    // desde prevStep(), nunca desde el avance normal 1->2. El tipo de
    // medicamento (checkboxes de este paso) define qué checklist recibe el
    // cliente en el Paso 4, así que sin esto el checklist podía no
    // corresponder al subtipo que el cliente cree haber elegido.
    if (state.step === 2) renderStep2();
    if (state.step === 4) await renderChecklist();
    if (state.step === 5) await renderConfirmation();

  } catch (err) {
    toast(t('Error: {error}', { error: err.message }), 'danger');
  } finally {
    setLoading(btn, false);
    // setLoading() siempre re-habilita el botón — updateNextButtonState()
    // es un no-op fuera del Paso 4, y en el Paso 4 vuelve a aplicar el
    // bloqueo si todavía faltan documentos obligatorios del cliente.
    updateNextButtonState();
  }
}

function prevStep() {
  if (state.step > 1) showStep(state.step - 1);
  if (state.step === 2) renderStep2();
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  state.user = await requireLogin();

  // Resume from URL param
  const urlParams = new URLSearchParams(window.location.search);
  const resumeId  = urlParams.get('caseId');
  if (resumeId) {
    state.caseId = resumeId;
    const cs = await api.getCase(resumeId).catch(() => null);
    if (cs) {
      state.data.tramiteType     = cs.tramiteType;
      state.data.tipoSolicitud   = cs.tipoSolicitud;
      state.data.tipoRegistro    = cs.tipoRegistro;
      state.data.tipoMedicamento = cs.tipoMedicamento || [];
      state.data.product         = cs.product || {};
      state.data.entities        = cs.entities || {};
    }
  }

  renderStep1();
  showStep(1);

  $('#btn-next')?.addEventListener('click', nextStep);
  $('#btn-prev')?.addEventListener('click', prevStep);

  // Name in nav
  const nameEl = $('#user-name');
  if (nameEl) nameEl.textContent = state.user.displayName || state.user.email;

  // Cambio de idioma en vivo: se repinta lo que este módulo generó por JS en el paso actual
  // (lo estático con data-i18n lo retraduce la capa sola). Una sola suscripción.
  if (i18n() && !init.i18nSuscrito) {
    init.i18nSuscrito = true;
    i18n().onCambio(() => { repintarPasoActual().catch(() => { /* informativo: el paso ya está pintado en español */ }); });
  }
}

async function repintarPasoActual() {
  const grid = $('#tramite-grid');
  if (grid) pintarTramites(grid);
  const tipoRegSelect = $('#tipoRegistro');
  if (tipoRegSelect) pintarViasRegistro(tipoRegSelect);
  const btn = $('#btn-next');
  if (btn) delete btn.dataset.orig; // el rótulo "Guardando..." se vuelve a tomar en el idioma nuevo
  if (state.step === 2) renderStep2();
  if (state.step === 4) await renderChecklist();
  if (state.step === 5) await renderConfirmation();
}

document.addEventListener('DOMContentLoaded', init);
