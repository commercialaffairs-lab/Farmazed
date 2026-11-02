/**
 * demo_recorrido_textos.js — Textos del recorrido guiado del modo demo en los cuatro idiomas
 * (español, inglés, francés y portugués). UNA sola fuente para:
 *
 *   - el panel "Recorrido demo" (farmazed-web/portal/js/recorrido.js): `GET /api/demo/recorrido?idioma=xx`
 *     devuelve los pasos ya traducidos y los rótulos del panel (ETIQUETAS_PANEL); el front no trae
 *     ninguna tabla de textos;
 *   - el manual de usuario (scripts/generar_manual.js → farmazed-web/manual/{es,en,fr,pt}.html).
 *
 * El español es la referencia (PASOS_CLIENTE / PASOS_REGENTE); los demás idiomas traducen por id de
 * paso. La interfaz también existe en los 4 idiomas (farmazed-web/i18n/, portal/js/i18n.js), así que
 * los rótulos de pantalla que se citan entre comillas ("Solicitar Registro" → "Request Registration",
 * [Reiniciar cuenta demo] → [Reset demo account]…) van en cada idioma con la MISMA traducción que el
 * diccionario de la interfaz: tests/i18n.test.js lo comprueba para que no haya mezclas.
 *
 * tests/manual.test.js comprueba que cada idioma traduce todos los pasos, notas y rótulos.
 */

const IDIOMAS = ['es', 'en', 'fr', 'pt'];
const IDIOMA_POR_DEFECTO = 'es';
const NOMBRES_IDIOMA = { es: 'Español', en: 'English', fr: 'Français', pt: 'Português' };

const PASOS_CLIENTE = [
  { id: 'captacion',  titulo: 'Confirma los datos de tu empresa',
    descripcion: 'Al entrar por primera vez, el portal te pide la captación de información preliminar. Viene precargada con lo que "Laboratorios Ejemplo" dijo al solicitar la cuenta: revísala, responde las tres preguntas y guarda.' },
  { id: 'producto',   titulo: 'Crea tu primer producto',
    descripcion: 'En "Solicitar Registro" inicia una solicitud. El botón "Rellenar con datos de ejemplo" completa el tipo de trámite, el producto y las empresas por ti; avanza con "Siguiente" hasta el paso 4 (Documentos).' },
  { id: 'documento',  titulo: 'Sube un documento de ejemplo',
    descripcion: 'En el paso 4 pulsa "Subir" en cualquier casilla: en la demo no se abre el explorador de archivos, un aviso simula la carga con un PDF de ejemplo. Con "Rellenar con datos de ejemplo" quedan simulados todos los documentos de una vez y puedes seguir al paso 5.' },
  { id: 'cotizacion', titulo: 'Acepta la cotización de Producto Ejemplo 2',
    descripcion: 'Farmazed ya te envió la cotización del "Producto Ejemplo 2". Ábrela en "Cotización", revisa el desglose (honorarios, tasa DNFD, MEF e IEA) y acéptala.' },
  { id: 'pago',       titulo: 'Paga con el proveedor de prueba',
    descripcion: 'Pulsa "Pagar con PayPal". En la demo el cobro lo hace un proveedor de prueba: no se mueve dinero. Al pagar, el expediente avanza solo a la fase 6 (en la vida real lo hace el equipo de Farmazed).' },
  { id: 'mensaje',    titulo: 'Escribe a tu equipo Farmazed',
    descripcion: 'En "Mensajes" elige un producto y envía un mensaje. Así te comunicas con tu regente durante todo el trámite. Luego mira en "Mis Productos" el avance de fases de cada expediente.' },
];

const PASOS_REGENTE = [
  { id: 'documento', titulo: 'Revisa el documento de Producto Ejemplo 3',
    descripcion: 'El cliente subió la fórmula cuali-cuantitativa. Abre el expediente desde "Mi Bandeja", busca el documento 15.5 y apruébalo (✓) o recházalo (✗) con un motivo que el cliente verá en su portal.' },
  { id: 'cotejo',    titulo: 'Confirma el cotejo técnico (fase 8)',
    descripcion: 'El "Producto Ejemplo 3" está en la fase 8, revisión de documentación digital. En la tarjeta "Fase 8 — Confirmaciones" registra tu confirmación técnica/matrices; la legal la pone el abogado.' },
  { id: 'lead',      titulo: 'Atiende el lead "Farmacia Ejemplo"',
    descripcion: 'En "Leads" está la solicitud de "Farmacia Ejemplo" (estado Nuevo). Ábrela, cambia el estado a Contactado o deja una nota: así se trabaja el CRM antes de que el admin invite al cliente a crear su cuenta.' },
];

// Recorrido del cliente para cuentas REALES (Rick, 01-nov-2026: "clients will be from the demo
// version and also from the settings section"). Mismos ids que PASOS_CLIENTE, pero sin referencias a
// los datos de ejemplo ni al proveedor de prueba: habla del trámite de verdad. Se activa desde
// "Mi cuenta" en el portal y el progreso se deduce de los datos de la empresa (services/recorrido_cliente.js).
const PASOS_CLIENTE_REAL = [
  { id: 'captacion',  titulo: 'Confirma los datos de tu empresa',
    descripcion: 'Al entrar por primera vez, el portal te pide la captación de información preliminar: país y laboratorio fabricante, categorías de producto y tres preguntas. Revísala y guarda; después la puedes editar en "Mi Empresa".' },
  { id: 'producto',   titulo: 'Crea tu primer producto',
    descripcion: 'En "Solicitar Registro" inicia una solicitud: tipo de trámite, datos del producto y empresas. Avanza con "Siguiente" hasta el paso 4 (Documentos).' },
  { id: 'documento',  titulo: 'Sube tu documentación',
    descripcion: 'En el paso 4 del asistente sube cada documento en su casilla (PDF, JPG, PNG o DOCX). Cuando estén los obligatorios podrás enviar la solicitud; mientras tanto queda guardada como borrador.' },
  { id: 'cotizacion', titulo: 'Revisa y acepta tu cotización',
    descripcion: 'Cuando Farmazed te envíe la cotización, ábrela en "Cotización", revisa el desglose (honorarios, tasa DNFD, MEF e IEA) y acéptala para seguir.' },
  { id: 'pago',       titulo: 'Paga los costos del trámite',
    descripcion: 'Pulsa "Pagar con PayPal" o usa el enlace de pago que te envíe Farmazed. Con el pago confirmado, tu expediente pasa a la fase de apertura y el equipo empieza a trabajar.' },
  { id: 'mensaje',    titulo: 'Escribe a tu equipo Farmazed',
    descripcion: 'En "Mensajes" elige un producto y escribe: así te comunicas con tu regente durante todo el trámite. En "Mis Productos" sigues el avance de fases de cada expediente.' },
];

// Traducciones por id de paso (el español está arriba).
const TRADUCCIONES = {
  en: {
    clienteReal: {
      captacion:  { titulo: "Confirm your company's details", descripcion: 'The first time you sign in, the portal asks you for the preliminary information intake: country and manufacturing laboratory, product categories and three questions. Review it and save; you can edit it later under "My Company".' },
      producto:   { titulo: 'Create your first product', descripcion: 'Under "Request Registration" start a request: procedure type, product details and companies. Move on with "Next" to step 4 (Documents).' },
      documento:  { titulo: 'Upload your documentation', descripcion: 'In step 4 of the wizard upload each document into its slot (PDF, JPG, PNG or DOCX). Once the mandatory ones are in you can submit the request; until then it is saved as a draft.' },
      cotizacion: { titulo: 'Review and accept your quote', descripcion: 'When Farmazed sends you the quote, open it under "Quote", review the breakdown (fees, DNFD fee, MEF and IEA) and accept it to continue.' },
      pago:       { titulo: 'Pay the procedure costs', descripcion: 'Click "Pay with PayPal" or use the payment link Farmazed sends you. Once the payment is confirmed, your file moves to the opening phase and the team starts working.' },
      mensaje:    { titulo: 'Write to your Farmazed team', descripcion: 'Under "Messages" pick a product and write: this is how you talk to your regent throughout the procedure. Under "My Products" you follow each file\'s progress through the phases.' },
    },
    cliente: {
      captacion:  { titulo: "Confirm your company's details", descripcion: 'The first time you sign in, the portal asks you for the preliminary information intake. It comes pre-filled with what "Laboratorios Ejemplo" said when requesting the account: review it, answer the three questions and save.' },
      producto:   { titulo: 'Create your first product', descripcion: 'Under "Request Registration" start a request. The "Fill in with sample data" button fills in the procedure type, the product and the companies for you; move on with "Next" to step 4 (Documents).' },
      documento:  { titulo: 'Upload a sample document', descripcion: 'In step 4 click "Upload" in any slot: in the demo the file browser does not open, a notice simulates the upload with a sample PDF. "Fill in with sample data" simulates every document at once so you can move on to step 5.' },
      cotizacion: { titulo: 'Accept the quote for Producto Ejemplo 2', descripcion: 'Farmazed has already sent you the quote for "Producto Ejemplo 2". Open it under "Quote", review the breakdown (fees, DNFD fee, MEF and IEA) and accept it.' },
      pago:       { titulo: 'Pay with the test provider', descripcion: 'Click "Pay with PayPal". In the demo the charge is handled by a test provider: no money moves. Once paid, the file moves on its own to phase 6 (in real life the Farmazed team does this).' },
      mensaje:    { titulo: 'Write to your Farmazed team', descripcion: 'Under "Messages" pick a product and send a message. This is how you talk to your regent throughout the procedure. Then open "My Products" to see each file\'s progress through the phases.' },
    },
    regente: {
      documento: { titulo: 'Review the document for Producto Ejemplo 3', descripcion: 'The client uploaded the qualitative-quantitative formula. Open the file from "My Inbox", find document 15.5 and approve it (✓) or reject it (✗) with a reason the client will see in their portal.' },
      cotejo:    { titulo: 'Confirm the technical check (phase 8)', descripcion: '"Producto Ejemplo 3" is in phase 8, review of digital documentation. In the "Phase 8 — Confirmations" card record your technical/matrices confirmation; the legal one is entered by the lawyer.' },
      lead:      { titulo: 'Handle the "Farmacia Ejemplo" lead', descripcion: 'Under "Leads" you will find the request from "Farmacia Ejemplo" (status New). Open it, change the status to Contacted or leave a note: this is how the CRM is worked before the admin invites the client to create their account.' },
    },
  },
  fr: {
    clienteReal: {
      captacion:  { titulo: 'Confirmez les données de votre entreprise', descripcion: 'À la première connexion, le portail vous demande la collecte d\'informations préliminaires : pays et laboratoire fabricant, catégories de produits et trois questions. Relisez-la et enregistrez ; vous pourrez la modifier ensuite dans « Mon entreprise ».' },
      producto:   { titulo: 'Créez votre premier produit', descripcion: 'Dans « Demander l\'enregistrement », lancez une demande : type de procédure, données du produit et entreprises. Avancez avec « Suivant » jusqu\'à l\'étape 4 (Documents).' },
      documento:  { titulo: 'Téléversez votre documentation', descripcion: 'À l\'étape 4 de l\'assistant, déposez chaque document dans sa case (PDF, JPG, PNG ou DOCX). Une fois les documents obligatoires réunis, vous pourrez envoyer la demande ; en attendant, elle reste enregistrée comme brouillon.' },
      cotizacion: { titulo: 'Vérifiez et acceptez votre devis', descripcion: 'Quand Farmazed vous envoie le devis, ouvrez-le dans « Devis », vérifiez le détail (honoraires, taxe DNFD, MEF et IEA) et acceptez-le pour continuer.' },
      pago:       { titulo: 'Payez les frais de la procédure', descripcion: 'Cliquez sur « Payer avec PayPal » ou utilisez le lien de paiement envoyé par Farmazed. Une fois le paiement confirmé, votre dossier passe à la phase d\'ouverture et l\'équipe se met au travail.' },
      mensaje:    { titulo: 'Écrivez à votre équipe Farmazed', descripcion: 'Dans « Messages », choisissez un produit et écrivez : c\'est ainsi que vous communiquez avec votre régent tout au long de la procédure. Dans « Mes produits », vous suivez l\'avancement de chaque dossier à travers les phases.' },
    },
    cliente: {
      captacion:  { titulo: 'Confirmez les données de votre entreprise', descripcion: 'À la première connexion, le portail vous demande la collecte d\'informations préliminaires. Elle est préremplie avec ce que « Laboratorios Ejemplo » a déclaré en demandant le compte : relisez-la, répondez aux trois questions et enregistrez.' },
      producto:   { titulo: 'Créez votre premier produit', descripcion: 'Dans « Demander l\'enregistrement », lancez une demande. Le bouton « Remplir avec des données d\'exemple » remplit pour vous le type de procédure, le produit et les entreprises ; avancez avec « Suivant » jusqu\'à l\'étape 4 (Documents).' },
      documento:  { titulo: 'Téléversez un document d\'exemple', descripcion: 'À l\'étape 4, cliquez sur « Téléverser » dans n\'importe quelle case : dans la démo, l\'explorateur de fichiers ne s\'ouvre pas, un message simule le téléversement avec un PDF d\'exemple. « Remplir avec des données d\'exemple » simule tous les documents d\'un coup pour passer à l\'étape 5.' },
      cotizacion: { titulo: 'Acceptez le devis du Producto Ejemplo 2', descripcion: 'Farmazed vous a déjà envoyé le devis du « Producto Ejemplo 2 ». Ouvrez-le dans « Devis », vérifiez le détail (honoraires, taxe DNFD, MEF et IEA) et acceptez-le.' },
      pago:       { titulo: 'Payez avec le prestataire de test', descripcion: 'Cliquez sur « Payer avec PayPal ». Dans la démo, l\'encaissement est fait par un prestataire de test : aucun argent ne circule. Une fois payé, le dossier passe tout seul à la phase 6 (en réalité, c\'est l\'équipe Farmazed qui le fait).' },
      mensaje:    { titulo: 'Écrivez à votre équipe Farmazed', descripcion: 'Dans « Messages », choisissez un produit et envoyez un message. C\'est ainsi que vous communiquez avec votre régent tout au long de la procédure. Regardez ensuite dans « Mes produits » l\'avancement de chaque dossier à travers les phases.' },
    },
    regente: {
      documento: { titulo: 'Examinez le document du Producto Ejemplo 3', descripcion: 'Le client a téléversé la formule quali-quantitative. Ouvrez le dossier depuis « Ma corbeille », trouvez le document 15.5 et approuvez-le (✓) ou refusez-le (✗) avec un motif que le client verra dans son portail.' },
      cotejo:    { titulo: 'Confirmez la vérification technique (phase 8)', descripcion: 'Le « Producto Ejemplo 3 » est en phase 8, examen de la documentation numérique. Dans la carte « Phase 8 — Confirmations », enregistrez votre confirmation technique/matrices ; la confirmation juridique est saisie par l\'avocat.' },
      lead:      { titulo: 'Traitez le lead « Farmacia Ejemplo »', descripcion: 'Dans « Leads » se trouve la demande de « Farmacia Ejemplo » (statut Nouveau). Ouvrez-la, passez le statut à Contacté ou laissez une note : c\'est ainsi que l\'on travaille le CRM avant que l\'admin n\'invite le client à créer son compte.' },
    },
  },
  pt: {
    clienteReal: {
      captacion:  { titulo: 'Confirme os dados da sua empresa', descripcion: 'Ao entrar pela primeira vez, o portal pede-lhe a recolha de informação preliminar: país e laboratório fabricante, categorias de produto e três perguntas. Reveja-a e guarde; depois pode editá-la em "A minha empresa".' },
      producto:   { titulo: 'Crie o seu primeiro produto', descripcion: 'Em "Pedir registo" inicie um pedido: tipo de processo, dados do produto e empresas. Avance com "Seguinte" até ao passo 4 (Documentos).' },
      documento:  { titulo: 'Carregue a sua documentação', descripcion: 'No passo 4 do assistente carregue cada documento na sua casa (PDF, JPG, PNG ou DOCX). Quando os obrigatórios estiverem carregados poderá enviar o pedido; até lá fica guardado como rascunho.' },
      cotizacion: { titulo: 'Reveja e aceite o seu orçamento', descripcion: 'Quando a Farmazed lhe enviar o orçamento, abra-o em "Orçamento", reveja a discriminação (honorários, taxa DNFD, MEF e IEA) e aceite-o para continuar.' },
      pago:       { titulo: 'Pague os custos do processo', descripcion: 'Carregue em "Pagar com PayPal" ou use a ligação de pagamento que a Farmazed lhe enviar. Com o pagamento confirmado, o seu processo passa à fase de abertura e a equipa começa a trabalhar.' },
      mensaje:    { titulo: 'Escreva à sua equipa Farmazed', descripcion: 'Em "Mensagens" escolha um produto e escreva: é assim que comunica com o seu regente durante todo o processo. Em "Os meus produtos" acompanha o avanço de fases de cada processo.' },
    },
    cliente: {
      captacion:  { titulo: 'Confirme os dados da sua empresa', descripcion: 'Ao entrar pela primeira vez, o portal pede-lhe a recolha de informação preliminar. Vem pré-preenchida com o que a "Laboratorios Ejemplo" declarou ao pedir a conta: reveja-a, responda às três perguntas e guarde.' },
      producto:   { titulo: 'Crie o seu primeiro produto', descripcion: 'Em "Pedir registo" inicie um pedido. O botão "Preencher com dados de exemplo" preenche por si o tipo de processo, o produto e as empresas; avance com "Seguinte" até ao passo 4 (Documentos).' },
      documento:  { titulo: 'Carregue um documento de exemplo', descripcion: 'No passo 4 carregue em "Carregar" em qualquer casa: na demo o explorador de ficheiros não abre, um aviso simula o carregamento com um PDF de exemplo. "Preencher com dados de exemplo" simula todos os documentos de uma vez para seguir ao passo 5.' },
      cotizacion: { titulo: 'Aceite o orçamento do Producto Ejemplo 2', descripcion: 'A Farmazed já lhe enviou o orçamento do "Producto Ejemplo 2". Abra-o em "Orçamento", reveja a discriminação (honorários, taxa DNFD, MEF e IEA) e aceite-o.' },
      pago:       { titulo: 'Pague com o fornecedor de teste', descripcion: 'Carregue em "Pagar com PayPal". Na demo a cobrança é feita por um fornecedor de teste: não se movimenta dinheiro. Ao pagar, o processo avança sozinho para a fase 6 (na vida real fá-lo a equipa da Farmazed).' },
      mensaje:    { titulo: 'Escreva à sua equipa Farmazed', descripcion: 'Em "Mensagens" escolha um produto e envie uma mensagem. É assim que comunica com o seu regente durante todo o processo. Depois veja em "Os meus produtos" o avanço de fases de cada processo.' },
    },
    regente: {
      documento: { titulo: 'Reveja o documento do Producto Ejemplo 3', descripcion: 'O cliente carregou a fórmula quali-quantitativa. Abra o processo a partir de "A minha caixa", procure o documento 15.5 e aprove-o (✓) ou rejeite-o (✗) com um motivo que o cliente verá no seu portal.' },
      cotejo:    { titulo: 'Confirme a verificação técnica (fase 8)', descripcion: 'O "Producto Ejemplo 3" está na fase 8, revisão da documentação digital. No cartão "Fase 8 — Confirmações" registe a sua confirmação técnica/matrizes; a jurídica é introduzida pelo advogado.' },
      lead:      { titulo: 'Atenda o lead "Farmacia Ejemplo"', descripcion: 'Em "Leads" está o pedido da "Farmacia Ejemplo" (estado Novo). Abra-o, mude o estado para Contactado ou deixe uma nota: é assim que se trabalha o CRM antes de o admin convidar o cliente a criar a sua conta.' },
    },
  },
};

// Avisos que el tracker añade a un paso según los datos (por id de aviso).
const NOTAS = {
  es: { rechazada: 'Rechazaste la cotización. Para seguir el recorrido pulsa [Reiniciar cuenta demo] y vuelve a entrar.' },
  en: { rechazada: 'You rejected the quote. To continue the tour click [Reset demo account] and sign in again.' },
  fr: { rechazada: 'Vous avez refusé le devis. Pour poursuivre le parcours, cliquez sur [Réinitialiser le compte démo] et reconnectez-vous.' },
  pt: { rechazada: 'Recusou o orçamento. Para continuar o percurso carregue em [Reiniciar conta demo] e volte a entrar.' },
};

// Rótulos del panel "Recorrido demo". `{n}` y `{total}` se sustituyen en el front.
const ETIQUETAS_PANEL = {
  es: {
    titulo: 'Recorrido demo', paso: 'Paso {n}', contador: '{n} de {total}', pildora: 'Recorrido demo · paso {n} de {total}',
    ir: 'Ir al paso', pdf: 'Descargar PDF de ejemplo', actualizar: 'Actualizar', actualizarTitulo: 'Volver a comprobar qué pasos ya están hechos',
    minimizar: 'Minimizar', minimizarAria: 'Minimizar el recorrido', abrirAria: 'Abrir el recorrido demo', idioma: 'Idioma del recorrido',
    completoTitulo: '¡Recorrido completo!', completoPildora: 'Recorrido completo',
    completoTexto: 'Ya viste lo principal de la plataforma. Puedes seguir explorando con libertad o pulsar [Reiniciar cuenta demo] arriba para empezar otra vez desde el paso 1.',
    error: 'No se pudo cargar el recorrido demo',
    // Variante para clientes reales (sin cuenta demo que reiniciar).
    tituloCliente: 'Recorrido guiado', pildoraCliente: 'Recorrido guiado · paso {n} de {total}',
    completoTextoCliente: 'Ya conoces lo esencial del portal. Puedes ocultar este recorrido cuando quieras desde "Mi cuenta".',
    ocultar: 'Ocultar el recorrido', ocultarAria: 'Ocultar el recorrido guiado (se puede volver a activar en Mi cuenta)',
    errorCliente: 'No se pudo cargar el recorrido guiado',
  },
  en: {
    titulo: 'Demo tour', paso: 'Step {n}', contador: '{n} of {total}', pildora: 'Demo tour · step {n} of {total}',
    ir: 'Go to this step', pdf: 'Download the sample PDF', actualizar: 'Refresh', actualizarTitulo: 'Check again which steps are already done',
    minimizar: 'Minimize', minimizarAria: 'Minimize the tour', abrirAria: 'Open the demo tour', idioma: 'Tour language',
    completoTitulo: 'Tour complete!', completoPildora: 'Tour complete',
    completoTexto: 'You have seen the essentials of the platform. Keep exploring freely, or click [Reset demo account] at the top to start again from step 1.',
    error: 'The demo tour could not be loaded',
    tituloCliente: 'Guided tour', pildoraCliente: 'Guided tour · step {n} of {total}',
    completoTextoCliente: 'You now know the essentials of the portal. You can hide this tour whenever you like under "My Account".',
    ocultar: 'Hide the tour', ocultarAria: 'Hide the guided tour (you can turn it back on under My Account)',
    errorCliente: 'The guided tour could not be loaded',
  },
  fr: {
    titulo: 'Parcours démo', paso: 'Étape {n}', contador: '{n} sur {total}', pildora: 'Parcours démo · étape {n} sur {total}',
    ir: 'Aller à cette étape', pdf: 'Télécharger le PDF d\'exemple', actualizar: 'Actualiser', actualizarTitulo: 'Revérifier quelles étapes sont déjà faites',
    minimizar: 'Réduire', minimizarAria: 'Réduire le parcours', abrirAria: 'Ouvrir le parcours démo', idioma: 'Langue du parcours',
    completoTitulo: 'Parcours terminé !', completoPildora: 'Parcours terminé',
    completoTexto: 'Vous avez vu l\'essentiel de la plateforme. Continuez à explorer librement, ou cliquez sur [Réinitialiser le compte démo] en haut pour recommencer à l\'étape 1.',
    error: 'Impossible de charger le parcours démo',
    tituloCliente: 'Parcours guidé', pildoraCliente: 'Parcours guidé · étape {n} sur {total}',
    completoTextoCliente: 'Vous connaissez maintenant l\'essentiel du portail. Vous pouvez masquer ce parcours quand vous voulez dans « Mon compte ».',
    ocultar: 'Masquer le parcours', ocultarAria: 'Masquer le parcours guidé (réactivable dans Mon compte)',
    errorCliente: 'Impossible de charger le parcours guidé',
  },
  pt: {
    titulo: 'Percurso demo', paso: 'Passo {n}', contador: '{n} de {total}', pildora: 'Percurso demo · passo {n} de {total}',
    ir: 'Ir para o passo', pdf: 'Descarregar o PDF de exemplo', actualizar: 'Atualizar', actualizarTitulo: 'Voltar a verificar que passos já estão feitos',
    minimizar: 'Minimizar', minimizarAria: 'Minimizar o percurso', abrirAria: 'Abrir o percurso demo', idioma: 'Idioma do percurso',
    completoTitulo: 'Percurso concluído!', completoPildora: 'Percurso concluído',
    completoTexto: 'Já viu o essencial da plataforma. Continue a explorar à vontade ou carregue em [Reiniciar conta demo] em cima para recomeçar no passo 1.',
    error: 'Não foi possível carregar o percurso demo',
    tituloCliente: 'Percurso guiado', pildoraCliente: 'Percurso guiado · passo {n} de {total}',
    completoTextoCliente: 'Já conhece o essencial do portal. Pode ocultar este percurso quando quiser em "A minha conta".',
    ocultar: 'Ocultar o percurso', ocultarAria: 'Ocultar o percurso guiado (pode voltar a ativá-lo em A minha conta)',
    errorCliente: 'Não foi possível carregar o percurso guiado',
  },
};

/** Idioma válido o el español. Acepta 'en-US' → 'en'. */
function normalizarIdioma(valor) {
  const base = String(valor || '').toLowerCase().slice(0, 2);
  return IDIOMAS.includes(base) ? base : IDIOMA_POR_DEFECTO;
}

const LISTAS = { cliente: PASOS_CLIENTE, clienteReal: PASOS_CLIENTE_REAL, regente: PASOS_REGENTE };

/**
 * Pasos de una variante en el idioma pedido (nuevos objetos; el español es la lista de referencia).
 * `variante`: 'cliente' (cuenta demo), 'clienteReal' (cliente de verdad, desde "Mi cuenta') o 'regente'.
 */
function pasosEnIdioma(variante, idioma) {
  const base = LISTAS[variante] || PASOS_CLIENTE;
  const trad = TRADUCCIONES[normalizarIdioma(idioma)]?.[variante];
  return base.map(p => (trad?.[p.id] ? { ...p, ...trad[p.id] } : { ...p }));
}

module.exports = {
  IDIOMAS, IDIOMA_POR_DEFECTO, NOMBRES_IDIOMA,
  PASOS_CLIENTE, PASOS_CLIENTE_REAL, PASOS_REGENTE, TRADUCCIONES, NOTAS, ETIQUETAS_PANEL,
  normalizarIdioma, pasosEnIdioma,
};
