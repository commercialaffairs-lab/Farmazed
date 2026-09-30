/**
 * paquete_iea.js — R13 (organizacion/04_ROADMAP.md E3; TAREA 19, PM_COMMENTS
 * Parte 0 "R13 | Límite 150 páginas IEA | Cuenta y advierte, no bloquea").
 *
 * Límite: 150 páginas. Fuente — dos documentos DISTINTOS de
 * _Zelky-Drive-2026-09-25, cada uno de forma independiente:
 *   - "F08-IEA-guia para usuarios IEA word listo.docx": "...al final del
 *     formulario de solicitud: No exceder en la documentación de 150
 *     páginas".
 *   - "F10-Fase 10 Se verifica la documentación con nuestras matrices
 *     guias.docx": "OBSERVACION al final del formulario de IEA, procure No
 *     exceder en la documentación de 150 páginas".
 * Ningún otro documento F08-IEA-* menciona un número de páginas distinto ni
 * un límite por documento individual — el límite es sobre EL PAQUETE
 * completo, no por archivo. No hace falta dejarlo en null/por confirmar: el
 * número aparece explícito y dos veces.
 *
 * Qué documentos "van al IEA" — fuente: "F08-IEA-Matriz requisitos IEA
 * enviar.docx", Sección 4 "DOCUMENTOS TÉCNICOS REQUERIDOS" (nota: esa
 * sección también dice que IEA recibe todo consolidado en UN solo PDF por
 * correo — este tracker no arma ese consolidado, solo suma las páginas de
 * lo que el cliente ya subió por separado, que es la aproximación más fiel
 * posible sin ese paso de consolidación). Lista 7 documentos:
 *   1. Fórmula Cualitativa-Cuantitativa       -> id 'formula'
 *   2. Metodología Analítica                  -> id 'metodo_analisis'
 *   3. Certificado de Análisis de Prod. Term. -> id 'cert_analisis'
 *   4. Especificaciones de Producto Terminado -> id 'especificaciones'
 *   5. Espectros / Cromatogramas              -> SIN id propio hoy (gap)
 *   6. Proyecto de Etiqueta                   -> id 'etiquetas'
 *   7. Validación Analítica                   -> SIN id propio hoy (gap)
 *
 * Los ítems 5 y 7 no tienen un documento propio en el checklist
 * (faddi_checklists.js) — no se inventa un id nuevo ni se asume que viajan
 * dentro de otro upload (podrían ir sueltos dentro de 'metodo_analisis' o
 * 'cert_analisis', o no subirse nunca por separado; no hay forma de saberlo
 * sin que Farmazed lo confirme). Quedan FUERA del conteo — el total de
 * páginas de este tracker es un PISO (mínimo), nunca cuenta de más.
 */

const LIMITE_PAGINAS = 150;

const IEA_DOC_IDS = ['formula', 'metodo_analisis', 'cert_analisis', 'especificaciones', 'etiquetas'];

module.exports = { LIMITE_PAGINAS, IEA_DOC_IDS };
