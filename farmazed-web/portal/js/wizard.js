/**
 * Farmazed — New Case Wizard (5 steps)
 * Handles step navigation, checklist rendering, and file upload (native fetch).
 */
import { requireLogin } from './auth.js';
import api from './api.js';

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
    ? '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...'
    : btn.dataset.orig;
}

function showLoadingModal(msg = 'Procesando...') {
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
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.toast').remove()"></button></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ── Step 1: Tipo de trámite ───────────────────────────────────────────────────
function renderStep1() {
  const grid = $('#tramite-grid');
  grid.innerHTML = tramitesVisibles().map(t => `
    <div class="col-md-4 col-sm-6">
      <label class="tramite-card ${state.data.tramiteType === t.id ? 'selected' : ''}" data-id="${t.id}">
        <input type="radio" name="tramiteType" value="${t.id}" class="d-none" ${state.data.tramiteType === t.id ? 'checked' : ''}>
        <div class="tramite-icon">${t.icon}</div>
        <div class="tramite-label">${t.label}</div>
        <div class="tramite-desc text-muted small">${t.desc}</div>
      </label>
    </div>`).join('');

  // Sync visibility for a resumed case (state.data.tramiteType already set before first render)
  $('#med-extra')?.classList.toggle('d-none', state.data.tramiteType !== 'medicamentos');
  $('#excepcion-disclaimer')?.classList.toggle('d-none', state.data.tramiteType !== 'excepcion');

  // Tipo de solicitud / registro (only for medicamentos)
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
    tipoRegSelect.innerHTML = TIPOS_REGISTRO.map(t => `<option value="${t}">${t}</option>`).join('');
    tipoRegSelect.value = state.data.tipoRegistro;
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
  const container = $('#tipo-med-checks');
  if (container && isMed) {
    container.innerHTML = TIPOS_MED.map(t => `
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" value="${t}" id="tm-${t.replace(/\s/g,'-')}"
          ${state.data.tipoMedicamento.includes(t) ? 'checked' : ''}>
        <label class="form-check-label" for="tm-${t.replace(/\s/g,'-')}">${t}</label>
      </div>`).join('');
    container.addEventListener('change', () => {
      state.data.tipoMedicamento = $$('input[type=checkbox]:checked', container).map(cb => cb.value);
    });
  }

  // Tipo publicidad checkboxes
  const pubContainer = $('#tipo-pub-checks');
  if (pubContainer && isPub) {
    const selected = state.data.product.tipoPublicidad || [];
    pubContainer.innerHTML = TIPOS_PUBLICIDAD.map(t => `
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" value="${t}" id="tp-${t.replace(/\s/g,'-')}"
          ${selected.includes(t) ? 'checked' : ''}>
        <label class="form-check-label" for="tp-${t.replace(/\s/g,'-')}">${t}</label>
      </div>`).join('');
  }

  // Condición de venta
  const condSelect = $('#condicionVenta');
  if (condSelect) {
    condSelect.innerHTML = CONDICION_VENTA.map(c => `<option>${c}</option>`).join('');
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
      ${renderDocGroup('Documentos que subes tú', clienteDocs)}
      ${farmazedDocs.length ? renderDocGroup('Documentos que aporta Farmazed', farmazedDocs) : ''}`;

    // Attach upload handler once — innerHTML above replaces children but not
    // the container node itself, so re-adding here on every refresh would
    // stack duplicate listeners and cause repeated uploads.
    if (!container.dataset.wired) {
      container.dataset.wired = '1';
      container.addEventListener('change', e => {
        if (e.target.type === 'file' && e.target.files[0]) {
          const docId = e.target.dataset.docid;
          const file  = e.target.files[0];
          if (file.size > 52 * 1024 * 1024) {
            toast('El archivo supera los 50 MB.', 'danger');
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
    container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
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
    ? `Faltan ${missingCliente.length} documento(s) obligatorio(s) tuyo(s) por subir`
    : '';
}

function renderProgressBar({ uploaded, total, percent }) {
  const bar = $('#upload-progress');
  if (!bar) return;
  bar.innerHTML = `
    <div class="d-flex justify-content-between mb-1">
      <small><strong>${uploaded}</strong> de <strong>${total}</strong> documentos subidos</small>
      <small>${percent}%</small>
    </div>
    <div class="progress" style="height:8px">
      <div class="progress-bar bg-success" style="width:${percent}%"></div>
    </div>`;
}

function renderDocGroup(title, docs, collapsed = false) {
  return `
    <div class="doc-group mb-4">
      <h6 class="text-muted fw-bold mb-3 text-uppercase small">${title}</h6>
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
    <div class="doc-card card mb-2 border-0 shadow-sm" id="doc-${doc.id}">
      <div class="card-body py-2 px-3 d-flex align-items-start gap-3">
        <div class="doc-status-icon fs-5 mt-1">${isPhysicalOnly ? '📍' : (icons[status] || '⬜')}</div>
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="fw-semibold small">${doc.faddiCode} — ${doc.name}</span>
            ${doc.required ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle small">Obligatorio</span>' : '<span class="badge bg-secondary-subtle text-secondary border small">Opcional</span>'}
            ${!isPhysicalOnly ? `<span class="badge bg-${badge[status] || 'secondary'} small">${status}</span>` : ''}
          </div>
          <div class="text-muted small mt-1">${doc.description}</div>
          ${up?.file ? `<div class="small text-success mt-1">📎 ${up.file.name}</div>` : ''}
          ${doc.condition ? `<div class="small text-warning-emphasis mt-1">⚡ ${doc.condition}</div>` : ''}
          ${isPhysicalOnly ? `<div class="small text-info mt-1">📍 Este documento se presenta físicamente en DNFD, no se carga en FADDI. Farmazed coordinará la entrega.</div>` : ''}
          ${isFarmazedDoc ? `<div class="small text-primary mt-1">🏢 Este documento lo aporta Farmazed — no necesitas subirlo tú, y no bloquea tu avance.</div>` : ''}
        </div>
        <div class="doc-upload-action" style="min-width:120px">
          ${isFarmazedDoc
            ? '<span class="badge bg-primary-subtle text-primary border border-primary-subtle small">A cargo de Farmazed</span>'
            : isPhysicalOnly
            ? '<span class="badge bg-info-subtle text-info border border-info-subtle small">Presencial</span>'
            : status === 'uploaded' || status === 'approved'
            ? '<span class="text-success small">✓ Subido</span>'
            : `<label class="btn btn-sm btn-outline-primary" style="cursor:pointer">
                 <input type="file" class="d-none" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" data-docid="${doc.id}">
                 ${status === 'pending_upload' ? '<span class="spinner-border spinner-border-sm"></span>' : '📎 Subir'}
               </label>`}
        </div>
      </div>
    </div>`;
}

async function uploadDoc(faddiDocId, file, docMeta) {
  const card = $(`#doc-${faddiDocId}`);
  if (card) card.querySelector('.doc-upload-action').innerHTML = '<span class="spinner-border spinner-border-sm text-primary"></span>';
  showLoadingModal('Subiendo documento...');

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
    toast(`✅ ${docMeta?.name || faddiDocId} subido correctamente.`);
    await warnIfPaqueteIEAExcedido();
  } catch (err) {
    state.uploads[faddiDocId] = { file, status: 'error' };
    toast(`❌ Error al subir ${docMeta?.name}: ${err.message}`, 'danger');
    if (card) card.querySelector('.doc-upload-action').innerHTML =
      `<label class="btn btn-sm btn-outline-danger" style="cursor:pointer">
         <input type="file" class="d-none" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" data-docid="${faddiDocId}">
         Reintentar
       </label>`;
  } finally {
    hideLoadingModal();
  }
}

// R13 (TAREA 19): tras cada subida, si el paquete IEA (formula,
// metodo_analisis, cert_analisis, especificaciones, etiquetas — ver
// tracker/data/paquete_iea.js) supera las 150 páginas, se avisa al cliente.
// NUNCA bloquea el flujo — solo un toast informativo.
async function warnIfPaqueteIEAExcedido() {
  try {
    const { excedido, totalPaginas, limite } = await api.getPaqueteIEA(state.caseId);
    if (excedido) {
      toast(`⚠️ El paquete de documentos para el IEA lleva ${totalPaginas} páginas (límite orientativo: ${limite}). No bloquea tu solicitud — Farmazed lo revisa contigo.`, 'warning');
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

  $('#confirm-product-name').textContent = cs.product?.nombreComercial || '(sin nombre)';
  $('#confirm-tramite').textContent      = cs.tramiteType;
  $('#confirm-progress').textContent     = `${cl.progress.uploaded}/${cl.progress.total} documentos`;

  const missingEl = $('#confirm-missing');
  if (missing.length) {
    missingEl.innerHTML = `<div class="alert alert-warning">
      <strong>⚠️ Documentos obligatorios faltantes (${missing.length}):</strong>
      <ul class="mb-0 mt-2">${missing.map(d => `<li>${d.faddiCode} — ${d.name}</li>`).join('')}</ul>
      <p class="mb-0 mt-2 small">Puedes enviar ahora y subir los documentos faltantes luego, o regresar al Paso 4.</p>
    </div>`;
  } else {
    missingEl.innerHTML = '<div class="alert alert-success">✅ Todos los documentos obligatorios están subidos.</div>';
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
async function nextStep() {
  const btn = $('#btn-next');
  setLoading(btn, true);

  try {
    if (state.step === 1) {
      if (!state.data.tramiteType) { toast('Selecciona el tipo de trámite.', 'warning'); return; }
      // Guarda 1 — trámite apagado. Cubre el caso de un ?caseId= antiguo cuyo
      // trámite ya no está disponible: la tarjeta no se ve, pero el estado
      // restaurado (init(), resume from URL param) sí la trae.
      const tramite = getTramite(state.data.tramiteType);
      if (!tramite || !tramite.disponible) {
        toast('Este trámite no está disponible en el portal. Contáctanos y un especialista de Farmazed te guiará.', 'warning');
        return;
      }
      // Guarda 2 — trámite visible pero sin flujo propio (opción (b)).
      if (!tramite.flujoPropio) {
        toast('Este trámite requiere gestión personalizada. Contáctenos directamente.', 'warning');
        return;
      }
      // Guarda 3 — vía de medicamentos sin flujo propio (comportamiento actual).
      if (state.data.tramiteType === 'medicamentos' && TIPOS_REGISTRO_SIN_FLUJO.includes(state.data.tipoRegistro)) {
        toast('Este tipo de trámite requiere gestión personalizada. Contáctenos directamente.', 'warning');
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
        toast(`Faltan ${missingCliente.length} documento(s) obligatorio(s) tuyo(s) por subir.`, 'warning');
        return;
      }
    }

    if (state.step === 5) {
      await api.updateCase(state.caseId, { status: 'submitted' });
      toast('🎉 Expediente enviado a Farmazed para revisión.');
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
    toast(`Error: ${err.message}`, 'danger');
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
}

document.addEventListener('DOMContentLoaded', init);
