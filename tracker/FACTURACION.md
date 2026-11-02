# Facturación electrónica (DGI Panamá vía PAC EBI-PAC)

Decisión de Rick (01-nov-2026): cada pago confirmado del cliente termina en una factura electrónica
enviada por correo, se dispare por webhook o por una acción del admin, con un workflow definido por
método de pago. El código del PAC se portó del módulo `api/src/services/ebi-pac.js` del repo
`PBS-Panama/PBS-Agentic-Website` (que ya emitió facturas reales contra el entorno demo de EBI-PAC).

## Flujo

```
pago confirmado ──► factura `pendiente` ──► `emitida` (CUFE de la DGI) ──► `enviada` (correo + PDF fiscal)
                           │                      │                              │
                           └── error_emision ◄────┘        error_envio ◄─────────┘    ("Reintentar" en Finanzas)
                                                                                      `anulada` (desde Finanzas, con motivo)
```

| Método de pago | Disparador | Workflow por defecto | Dónde se engancha |
|---|---|---|---|
| PayPal | el cliente captura la orden; o llega el webhook `PAYMENT.CAPTURE.COMPLETED` y concilia una captura sin factura | automático: emite y envía | `routes/quotes.js` (capturar), `services/paypal_webhook.js` |
| Rapid PayPro | el admin confirma el pago del enlace | automático | `routes/pago_externo.js` (confirmar) |
| Manual (cheque/transferencia con comprobante) | el admin registra el pago | queda `pendiente`; el admin pulsa **Emitir y enviar** en Finanzas | `routes/payments.js` (POST) |

Los tres llaman a `registrarPagoConfirmado()` (`services/facturacion/facturas.js`) sin esperar el
resultado: un fallo de facturación nunca altera el pago; queda en el log y en Finanzas.

Una factura por evento de pago, con id determinista (`fac_pp_<orderId>`, `fac_rpp_<quoteId>_<caseId>`,
`fac_man_<caseId>_<paymentId>`): repetir el disparador (capturar dos veces, webhook duplicado) no
duplica. Los pagos facturados llevan `facturaId`; los que no, aparecen en **Finanzas → Pagos sin
factura** para facturarlos a mano (`POST /api/facturas/desde-pagos`).

## Contenido de la factura

- **Receptor**: la entidad *solicitante* del expediente (RUC, DV, razón social, correo, teléfono,
  dirección); si falta, la empresa (`orgs/{orgId}`) y el correo del cliente. RUC jurídico →
  `tipoClienteFE 01`; cédula → persona natural `02`; sin RUC → consumidor final.
- **Ítems**: uno por concepto cobrado (honorarios, tasa DNFD, MEF, IEA, saldo), con el nombre del
  producto y el código del expediente. **ITBMS por concepto** (config): honorarios 7 % (`01`), tasas
  oficiales exentas (`00`) como gasto reembolsable. **El total de la factura es exactamente lo que el
  cliente pagó**: por defecto el ITBMS va incluido en el monto cobrado (`itbmsIncluidoEnMonto: true`,
  neto = monto / 1.07, en centavos, sin flotantes); si Farmazed decide cobrar el impuesto aparte, se
  apaga el flag (y hay que subir los precios del tarifario, porque hoy el cliente paga el monto exacto
  de la cotización). *Decisión fiscal de Farmazed: revisarla con el contador antes de producción.*
- **Numeración demo**: las facturas de cuentas demo o del PAC simulado numeran `DEMO-000001…` con su
  propio contador; la secuencia fiscal (`FZ-`) solo la consumen emisiones reales en EBI-PAC.
- **Sin duplicados**: además del id determinista, la transacción que crea la factura verifica que ningún
  pago tenga ya `facturaId`; y un pago de PayPal facturado a mano usa `fac_pp_<orderId>`, el mismo id
  que la captura y el webhook.
- **Forma de pago** (código DGI, config): PayPal y Rapid PayPro `03` tarjeta de crédito, manual `05`
  transferencia. Ajustable.
- **Numeración**: `FZ-000001` … (prefijo configurable) y `numeroDocumentoFiscal` de 10 dígitos,
  reservados en una transacción al emitir (no al crear).
- **PDF fiscal (CAFE)**: lo genera el PAC (`/api/Descarga`); se guarda en Storage bajo el expediente
  (`cases/<caseId>/factura-<id>.pdf`) y se sirve desde ahí.
- **Correo**: plantilla `emails/factura.html` con número, fecha, total y CUFE; PDF adjunto. Sin SMTP
  fuera de producción se marca `correo.simulado` y la factura igual queda `enviada`; en producción sin
  SMTP queda `error_envio` para mandarla a mano. Las cuentas demo nunca reciben correo.

## Configuración (Finanzas → Configuración, `config/facturacion`)

`emisor` (RUC, DV, razón social, `codigoSucursal` 0000, `puntoFacturacion` 001, `codigoUbicacion`
8-8-7, contacto), `conceptos` (descripción + ITBMS por concepto), `formasPago` por método,
`workflows` (`auto` por método), `prefijo`. Solo el admin (`facturas.manage`).

## Entorno

| Variable | Uso |
|---|---|
| `EBI_TOKEN_USUARIO`, `EBI_TOKEN_PASSWORD` | credenciales del PAC (Secret Manager en prod; nunca en el repo) |
| `EBI_BASE_URL` | `https://integraciondemo.ebi-pac.com` (pruebas) / `https://integracion.ebi-pac.com` (producción) |
| `FACTURACION_PROVIDER` | `mock` fuerza el PAC simulado (prohibido en producción); `ebi_pac` exige credenciales |

Regla (`config.js resolverProveedorFacturacion`): con credenciales → EBI-PAC; sin ellas en el
emulador → simulado; sin ellas en producción → facturación desactivada (los pagos siguen igual y las
facturas quedan `error_emision` con el motivo).

## API (`routes/facturas.js`)

Admin: `GET /api/facturas`, `GET|PUT /config`, `GET /sin-factura`, `POST /desde-pagos`,
`POST /procesar-pendientes`, `POST /:id/emitir|enviar|reintentar|anular`, `GET /:id/estado-pac`.
Cliente (su empresa): `GET /api/facturas/mias`, `GET /:id`, `GET /:id/pdf`, solo facturas con CUFE y
con una proyección sin campos internos (`vistaCliente`).

## Concurrencia y trabajo en segundo plano

- Los pasos reclaman la transición en una transacción (`pendiente|error_emision → emitiendo`,
  `emitida|error_envio → enviando`, con marca de tiempo; un paso en curso de más de 5 min se considera
  muerto y se retoma). Dos "Reintentar" a la vez no emiten ni envían dos veces; con CUFE asignado no se
  vuelve a llamar al PAC.
- El workflow automático corre tras responder al cliente. En Cloud Run ese trabajo puede congelarse:
  **programar Cloud Scheduler** → `POST /api/facturas/procesar-pendientes?minutos=2` (token de admin)
  cada pocos minutos; retoma lo que quedó a medias en workflows automáticos. El botón equivalente está
  en Finanzas.

## Pruebas

`tests/facturacion.test.js` (emuladores, PAC simulado): configuración, los tres workflows, webhook como
segundo disparador, idempotencia, permisos, PDF, anulación, pagos sin factura. Sin red:
`services/facturacion/pac/ebi_pac.js` expone `construirDocumento()` para validar el cuerpo exacto que
se mandaría a `/api/Enviar`.

## Antes de facturar de verdad

1. Credenciales del PAC (EBI-PAC) para Farmazed y alta del RUC emisor en la DGI; cargar `emisor` en
   Finanzas.
2. Confirmar con el contador el tratamiento del ITBMS por concepto y los códigos de forma de pago.
3. Probar contra `integraciondemo.ebi-pac.com` en horario de Panamá (PBS anotó que la DGI de pruebas
   atiende 8 am–6 pm) con `FACTURACION_PROVIDER=ebi_pac` en un entorno local.
4. Revisar la factura emitida en el portal de la DGI con el CUFE y cambiar `EBI_BASE_URL` a producción.
5. Desplegar `firestore.indexes.json` (índice de grupo de colección `payments.tipo` para "Pagos sin
   factura").
