// Países con código telefónico para los desplegables públicos (solicitar-cuenta.html).
// América completa primero (el mercado de Farmazed), luego los demás por orden alfabético.
export const PAISES = [
  { iso: 'PA', nombre: 'Panamá', codigo: '+507' },
  { iso: 'AR', nombre: 'Argentina', codigo: '+54' },
  { iso: 'BZ', nombre: 'Belice', codigo: '+501' },
  { iso: 'BO', nombre: 'Bolivia', codigo: '+591' },
  { iso: 'BR', nombre: 'Brasil', codigo: '+55' },
  { iso: 'CA', nombre: 'Canadá', codigo: '+1' },
  { iso: 'CL', nombre: 'Chile', codigo: '+56' },
  { iso: 'CO', nombre: 'Colombia', codigo: '+57' },
  { iso: 'CR', nombre: 'Costa Rica', codigo: '+506' },
  { iso: 'CU', nombre: 'Cuba', codigo: '+53' },
  { iso: 'EC', nombre: 'Ecuador', codigo: '+593' },
  { iso: 'SV', nombre: 'El Salvador', codigo: '+503' },
  { iso: 'US', nombre: 'Estados Unidos', codigo: '+1' },
  { iso: 'GT', nombre: 'Guatemala', codigo: '+502' },
  { iso: 'HT', nombre: 'Haití', codigo: '+509' },
  { iso: 'HN', nombre: 'Honduras', codigo: '+504' },
  { iso: 'JM', nombre: 'Jamaica', codigo: '+1876' },
  { iso: 'MX', nombre: 'México', codigo: '+52' },
  { iso: 'NI', nombre: 'Nicaragua', codigo: '+505' },
  { iso: 'PY', nombre: 'Paraguay', codigo: '+595' },
  { iso: 'PE', nombre: 'Perú', codigo: '+51' },
  { iso: 'PR', nombre: 'Puerto Rico', codigo: '+1787' },
  { iso: 'DO', nombre: 'República Dominicana', codigo: '+1809' },
  { iso: 'TT', nombre: 'Trinidad y Tobago', codigo: '+1868' },
  { iso: 'UY', nombre: 'Uruguay', codigo: '+598' },
  { iso: 'VE', nombre: 'Venezuela', codigo: '+58' },
  { iso: 'DE', nombre: 'Alemania', codigo: '+49' },
  { iso: 'AU', nombre: 'Australia', codigo: '+61' },
  { iso: 'AT', nombre: 'Austria', codigo: '+43' },
  { iso: 'BE', nombre: 'Bélgica', codigo: '+32' },
  { iso: 'CN', nombre: 'China', codigo: '+86' },
  { iso: 'KR', nombre: 'Corea del Sur', codigo: '+82' },
  { iso: 'DK', nombre: 'Dinamarca', codigo: '+45' },
  { iso: 'EG', nombre: 'Egipto', codigo: '+20' },
  { iso: 'AE', nombre: 'Emiratos Árabes Unidos', codigo: '+971' },
  { iso: 'ES', nombre: 'España', codigo: '+34' },
  { iso: 'FI', nombre: 'Finlandia', codigo: '+358' },
  { iso: 'FR', nombre: 'Francia', codigo: '+33' },
  { iso: 'GR', nombre: 'Grecia', codigo: '+30' },
  { iso: 'HU', nombre: 'Hungría', codigo: '+36' },
  { iso: 'IN', nombre: 'India', codigo: '+91' },
  { iso: 'ID', nombre: 'Indonesia', codigo: '+62' },
  { iso: 'IE', nombre: 'Irlanda', codigo: '+353' },
  { iso: 'IL', nombre: 'Israel', codigo: '+972' },
  { iso: 'IT', nombre: 'Italia', codigo: '+39' },
  { iso: 'JP', nombre: 'Japón', codigo: '+81' },
  { iso: 'MY', nombre: 'Malasia', codigo: '+60' },
  { iso: 'MA', nombre: 'Marruecos', codigo: '+212' },
  { iso: 'NO', nombre: 'Noruega', codigo: '+47' },
  { iso: 'NZ', nombre: 'Nueva Zelanda', codigo: '+64' },
  { iso: 'NL', nombre: 'Países Bajos', codigo: '+31' },
  { iso: 'PK', nombre: 'Pakistán', codigo: '+92' },
  { iso: 'PL', nombre: 'Polonia', codigo: '+48' },
  { iso: 'PT', nombre: 'Portugal', codigo: '+351' },
  { iso: 'GB', nombre: 'Reino Unido', codigo: '+44' },
  { iso: 'CZ', nombre: 'República Checa', codigo: '+420' },
  { iso: 'RU', nombre: 'Rusia', codigo: '+7' },
  { iso: 'SG', nombre: 'Singapur', codigo: '+65' },
  { iso: 'ZA', nombre: 'Sudáfrica', codigo: '+27' },
  { iso: 'SE', nombre: 'Suecia', codigo: '+46' },
  { iso: 'CH', nombre: 'Suiza', codigo: '+41' },
  { iso: 'TH', nombre: 'Tailandia', codigo: '+66' },
  { iso: 'TW', nombre: 'Taiwán', codigo: '+886' },
  { iso: 'TR', nombre: 'Turquía', codigo: '+90' },
  { iso: 'VN', nombre: 'Vietnam', codigo: '+84' },
];

export function opcionesPaises({ seleccionado = null, placeholder = 'Elige un país…' } = {}) {
  const conocido = PAISES.some(p => p.nombre === seleccionado);
  return `<option value="" ${seleccionado ? '' : 'selected'} disabled>${placeholder}</option>`
    + (seleccionado && !conocido ? `<option value="${seleccionado}" selected>${seleccionado}</option>` : '')
    + PAISES.map(p => `<option value="${p.nombre}" ${p.nombre === seleccionado ? 'selected' : ''}>${p.nombre}</option>`).join('');
}

export function llenarPaises(select, opciones) {
  select.innerHTML = opcionesPaises(opciones);
}

export function llenarCodigos(select, { seleccionado = 'PA' } = {}) {
  select.innerHTML = PAISES.map(p => `<option value="${p.codigo}" ${p.iso === seleccionado ? 'selected' : ''}>${p.iso} ${p.codigo}</option>`).join('');
}
