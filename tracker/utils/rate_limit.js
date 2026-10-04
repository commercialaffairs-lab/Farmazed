/**
 * rate_limit.js — TAREA 39 (H3/H8). UN solo limitador por IP, en memoria, para
 * los endpoints públicos (register, contact-leads, /qr). Reemplaza tres copias
 * casi idénticas que además leían `x-forwarded-for` a mano (primer valor =
 * lo controla el cliente: rotándolo se evadía el límite) y nunca purgaban su
 * Map (crecía sin tope con IPs falsas).
 *
 * La IP sale de `req.ip`; con `app.set('trust proxy', 1)` (tracker/index.js)
 * Express toma la que agregó el balanceador de Cloud Run (el ÚLTIMO valor de
 * x-forwarded-for), no lo que el cliente haya mandado antes.
 *
 * No sobrevive un restart ni se comparte entre instancias de Cloud Run: frena
 * un loop desde una IP, no un ataque distribuido (fuera de alcance).
 */
const MAX_IPS = 50_000;

function crearLimitador({ ventanaMs = 10 * 60 * 1000, max = 5 } = {}) {
  const intentos = new Map(); // ip -> [timestamps dentro de la ventana]
  let ultimaPurga = Date.now();

  // Barrido de IPs cuya última visita ya salió de la ventana — como mucho una
  // vez por ventana, así el costo no pesa en cada request.
  function purgar(ahora) {
    if (ahora - ultimaPurga < ventanaMs) return;
    ultimaPurga = ahora;
    for (const [ip, marcas] of intentos) {
      if (ahora - marcas[marcas.length - 1] >= ventanaMs) intentos.delete(ip);
    }
  }

  function estaLimitado(ipCruda) {
    // IPv6: un solo atacante tiene un bloque /64 entero de direcciones — se
    // cuenta por /64 (primeros 4 grupos), no por dirección.
    const ip = ipCruda.includes(':') && !ipCruda.includes('.') ? ipCruda.split(':').slice(0, 4).join(':') : ipCruda;
    const ahora = Date.now();
    purgar(ahora);
    if (intentos.size > MAX_IPS) intentos.clear(); // válvula de seguridad: la memoria no crece sin tope
    const previos = (intentos.get(ip) || []).filter(t => ahora - t < ventanaMs);
    previos.push(ahora);
    if (previos.length > max + 1) previos.splice(0, previos.length - (max + 1)); // no crece sin tope bajo un flood
    intentos.set(ip, previos);
    return previos.length > max;
  }

  return {
    estaLimitado,
    /** Para pruebas en proceso: vacía los contadores. */
    reset() { intentos.clear(); ultimaPurga = Date.now(); },
    /** Cuántas IPs lleva en memoria (pruebas de la purga). */
    get tamano() { return intentos.size; },
  };
}

module.exports = { crearLimitador };
