/**
 * manual_textos.js — Prosa de los dos manuales de usuario (Rick, 01-nov-2026: recorrido del cliente
 * separado del recorrido del regente).
 *
 *   - `cliente`: manual del portal del cliente (farmazed-web/manual/cliente/{es,en,fr,pt}.html). Sirve a
 *     un cliente real (activa el recorrido en "Mi cuenta") y a quien prueba la cuenta de demostración
 *     (apartado "Cuenta de demostración").
 *   - `regente`: manual del recorrido del regente, que solo existe en la demo
 *     (farmazed-web/manual/regente/{es,en,fr,pt}.html).
 *
 * Lo consume scripts/generar_manual.js. Los títulos y descripciones de los pasos y los rótulos del
 * panel NO están aquí: son los de services/demo_recorrido_textos.js (la misma fuente que usa el
 * panel de la aplicación). Las pantallas reproducidas se traducen con el diccionario de la interfaz
 * (farmazed-web/i18n/). Aquí vive el resto de la prosa.
 */

const IDIOMAS = ['es', 'en', 'fr', 'pt'];
const NOMBRES = { es: 'Español', en: 'English', fr: 'Français', pt: 'Português' };

// Fases (tracker/data/case_status.js) en las que interviene cada recorrido.
const FASES_RECORRIDO = { cliente: [4, 5, 6], regente: [8] };

const es = {
  comunes: {
    indice: 'Contenido',
    etiquetas: {
      paso: 'Paso', siguiente: 'Siguiente paso', pantalla: 'Así se ve en la aplicación', fin: 'Recorrido completado: ya viste lo esencial.',
      imprimir: 'Imprimir o guardar como PDF', idiomas: 'Idioma', volverPortal: 'Ir al portal', volverBackoffice: 'Ir al back-office', entrar: 'Iniciar sesión',
      fase: 'Fase', enRecorrido: 'en el recorrido', actualizado: 'Manual generado el',
    },
    fases: ['Primer contacto', 'Captación de información preliminar', 'Tipo de registro sanitario y ruta de registro', 'Elaboración y envío de cotización', 'Pago de costos del trámite', 'Apertura de expediente interno (CRM)', 'Instrucción al cliente: documentación requerida', 'Recepción y revisión de documentación digital (punto de control)', 'Solicitud y envío de documentos originales', 'Recepción y verificación de originales (punto de control)', 'Confección de dossiers DNFD e IEA', 'Ingreso ante DNFD e IEA', 'Seguimiento y gestión post-ingreso'],
  },
  cliente: {
    titulo: 'Manual del portal del cliente',
    subtitulo: 'Cómo llevar el registro sanitario de tu producto con Farmazed, paso a paso',
    intro: [
      'El portal del cliente de Farmazed te acompaña en el registro sanitario de un medicamento, cosmético o producto similar en Panamá: desde los datos de tu empresa hasta el pago y el seguimiento de cada expediente.',
      'Este manual sigue los seis pasos del recorrido guiado que puedes activar dentro del portal. Cada paso reproduce la pantalla real y te dice qué hacer y qué viene después.',
    ],
    secciones: {
      empezar: { titulo: 'Antes de empezar', parrafos: [
        'Entra en la página de inicio de sesión con el correo y la clave que te dio Farmazed. Si tu empresa aún no tiene cuenta, pide una desde "Solicitar cuenta" en esa misma página.',
        'Arriba, en la barra, está el selector de idioma (ES · EN · FR · PT): toda la aplicación y el enlace "Ayuda" (que abre este manual) cambian al idioma que elijas.',
      ] },
      panel: { titulo: 'El recorrido guiado', parrafos: [
        'En "Mi cuenta" (menú de tu avatar, arriba a la derecha) enciende "Mostrar el recorrido guiado". Abajo a la derecha aparece una tarjeta con los seis pasos: marca lo que ya hiciste, resalta el paso en que vas y el botón "Ir al paso" te lleva a la pantalla correcta.',
        'El progreso se deduce de los datos de tu empresa: no hay nada que guardar. Puedes minimizar la tarjeta o cerrarla con la ✕ y volver a activarla cuando quieras desde "Mi cuenta".',
      ] },
      pasos: { titulo: 'Los seis pasos', intro: 'En el orden del recorrido. Unos diez minutos la primera vez.' },
      demo: { titulo: 'Si usas la cuenta de demostración', parrafos: [
        'Farmazed entrega a los prospectos una cuenta de demostración ("Laboratorios Ejemplo S.A.") con datos de ejemplo. En ella el recorrido está siempre activo y los pasos hablan de esos datos: una cotización ya enviada para el "Producto Ejemplo 2", un botón "Rellenar con datos de ejemplo" en el asistente y una carga de documentos simulada (los botones "Subir" muestran un aviso en lugar de abrir el explorador de archivos).',
        'Nada de lo que hagas en la demo toca datos reales ni envía correos, y el pago lo hace un proveedor de prueba aunque el botón diga "Pagar con PayPal". El botón "Reiniciar cuenta demo", arriba en la barra, borra lo que hiciste y deja todo como al principio; tendrás que volver a iniciar sesión.',
        'Invitar miembros y cambiar de plan están ocultos en la demo; el resto del portal funciona igual que en producción.',
      ] },
      fases: { titulo: 'Las 13 fases de un expediente', intro: 'Cada producto avanza por estas fases; en "Mis Productos" ves en cuál va el tuyo. Las marcadas son las que tocas en el recorrido.' },
      notas: { titulo: 'Bueno saber', items: [
        'El asistente exige los documentos obligatorios de tu tipo de trámite para enviar la solicitud; mientras no estén, el producto queda guardado como borrador y puedes retomarlo.',
        'La cotización agrupa tus trámites en curso con el desglose de honorarios Farmazed y tasas oficiales (DNFD, MEF, IEA). Si tienes dudas, escribe a tu equipo desde "Mensajes" antes de aceptarla.',
        'Los mensajes quedan asociados a cada producto: tu regente los ve en el expediente y te responde por la misma vía.',
        'La aplicación y este manual existen en español, inglés, francés y portugués; elige el idioma en la barra superior. Los nombres de productos y empresas no se traducen.',
      ] },
    },
  },
  regente: {
    titulo: 'Manual del regente (cuenta de demostración)',
    subtitulo: 'El back-office de Farmazed visto por un regente, paso a paso',
    intro: [
      'La cuenta de demostración del regente te deja trabajar un expediente de ejemplo como lo hace el equipo de Farmazed: revisar documentos, confirmar el cotejo técnico y atender un lead del CRM, con datos de ejemplo y sin tocar nada real.',
      'Este manual sigue el panel "Recorrido demo" que verás dentro del back-office. Cada paso reproduce la pantalla real y te dice qué hacer y qué viene después.',
    ],
    secciones: {
      empezar: { titulo: 'Antes de empezar', parrafos: [
        'Entra en la página de inicio de sesión con el correo del regente de demostración y la clave que te dieron; las claves no aparecen en este manual. El recorrido del regente solo existe en la cuenta de demostración.',
        'Arriba, en la barra, está el selector de idioma (ES · EN · FR · PT): todo el back-office y el enlace "Ayuda" (que abre este manual) cambian al idioma que elijas.',
      ] },
      panel: { titulo: 'El panel "Recorrido demo"', parrafos: [
        'Abajo a la derecha verás una tarjeta con los tres pasos del recorrido. Marca lo que ya hiciste, resalta el paso en que vas y el botón "Ir al paso" te lleva a la pantalla correcta. El progreso se deduce de los datos: no hay nada que guardar.',
        'El botón "Reiniciar cuenta demo", arriba en la barra, borra lo que hiciste (también lo del cliente demo) y deja todo como al principio. Tendrás que volver a iniciar sesión.',
      ] },
      pasos: { titulo: 'Los tres pasos', intro: 'Sobre el "Producto Ejemplo 3" (fase 8) y el lead "Farmacia Ejemplo".' },
      fases: { titulo: 'Las 13 fases de un expediente', intro: 'Cada expediente avanza por estas fases; en "Mi Bandeja" ves en cuál va cada uno de los tuyos. La marcada es la que tocas en el recorrido.' },
      notas: { titulo: 'Bueno saber', items: [
        'Al rechazar un documento, el motivo que escribas lo ve el cliente en su portal: sé concreto sobre qué debe corregir.',
        'La fase 8 exige dos confirmaciones: la técnica/matrices (tuya) y la legal (del abogado). Hasta que estén las dos, el expediente no avanza.',
        'Los leads son solicitudes del formulario público del sitio; cambiar su estado o dejar notas es la forma de trabajarlos antes de que el admin invite a la empresa a crear su cuenta.',
        'La aplicación y este manual existen en español, inglés, francés y portugués; elige el idioma en la barra superior.',
      ] },
    },
  },
};

const en = {
  comunes: {
    indice: 'Contents',
    etiquetas: {
      paso: 'Step', siguiente: 'Next step', pantalla: 'What it looks like in the application', fin: 'Tour complete: you have seen the essentials.',
      imprimir: 'Print or save as PDF', idiomas: 'Language', volverPortal: 'Go to the portal', volverBackoffice: 'Go to the back office', entrar: 'Sign in',
      fase: 'Phase', enRecorrido: 'in the tour', actualizado: 'Guide generated on',
    },
    fases: ['First contact', 'Preliminary information intake', 'Type of sanitary registration and registration route', 'Preparing and sending the quote', 'Payment of procedure costs', 'Opening of the internal file (CRM)', 'Instructions to the client: required documentation', 'Receipt and review of digital documentation (control point)', 'Request and shipment of original documents', 'Receipt and verification of originals (control point)', 'Preparation of DNFD and IEA dossiers', 'Filing with DNFD and IEA', 'Post-filing follow-up and management'],
  },
  cliente: {
    titulo: 'Client portal guide',
    subtitulo: 'How to manage the sanitary registration of your product with Farmazed, step by step',
    intro: [
      'The Farmazed client portal walks you through the sanitary registration of a medicine, cosmetic or similar product in Panama: from your company details to payment and the follow-up of each file.',
      'This guide follows the six steps of the guided tour you can turn on inside the portal. Each step reproduces the real screen and tells you what to do and what comes next.',
    ],
    secciones: {
      empezar: { titulo: 'Before you start', parrafos: [
        'Sign in on the login page with the e-mail and password Farmazed gave you. If your company does not have an account yet, request one from "Request an account" on that same page.',
        'The language switch (ES · EN · FR · PT) is in the top bar: the whole application and the "Help" link (which opens this guide) change to the language you pick.',
      ] },
      panel: { titulo: 'The guided tour', parrafos: [
        'Under "My Account" (your avatar menu, top right) turn on "Show the guided tour". A card with the six steps appears at the bottom right: it ticks off what you have done, highlights the step you are on, and the "Go to this step" button takes you to the right screen.',
        'Progress is derived from your company\'s data: there is nothing to save. You can minimize the card or close it with the ✕ and turn it back on whenever you like under "My Account".',
      ] },
      pasos: { titulo: 'The six steps', intro: 'In tour order. About ten minutes the first time.' },
      demo: { titulo: 'If you are using the demo account', parrafos: [
        'Farmazed gives prospects a demo account ("Laboratorios Ejemplo S.A.") with sample data. There the tour is always on and the steps talk about that data: a quote already sent for "Producto Ejemplo 2", a "Fill in with sample data" button in the wizard and simulated document uploads (the "Upload" buttons show a notice instead of opening the file browser).',
        'Nothing you do in the demo touches real data or sends e-mails, and payment is handled by a test provider even though the button says "Pay with PayPal". The "Reset demo account" button in the top bar wipes what you did and puts everything back to the start; you will have to sign in again.',
        'Inviting members and changing plans are hidden in the demo; the rest of the portal works exactly as in production.',
      ] },
      fases: { titulo: 'The 13 phases of a file', intro: 'Every product moves through these phases; "My Products" shows where yours is. The highlighted ones are the ones you touch during the tour.' },
      notas: { titulo: 'Good to know', items: [
        'The wizard requires the mandatory documents for your procedure type before you can submit the request; until then the product is saved as a draft you can resume.',
        'The quote groups your ongoing procedures with the breakdown of Farmazed fees and official fees (DNFD, MEF, IEA). If in doubt, write to your team under "Messages" before accepting it.',
        'Messages are attached to each product: your regent sees them in the file and replies the same way.',
        'The application and this guide exist in Spanish, English, French and Portuguese; pick the language in the top bar. Product and company names are not translated.',
      ] },
    },
  },
  regente: {
    titulo: 'Regent guide (demo account)',
    subtitulo: 'The Farmazed back office as a regent sees it, step by step',
    intro: [
      'The regent demo account lets you work a sample file the way the Farmazed team does: review documents, confirm the technical check and handle a CRM lead, with sample data and without touching anything real.',
      'This guide follows the "Demo tour" panel you will see inside the back office. Each step reproduces the real screen and tells you what to do and what comes next.',
    ],
    secciones: {
      empezar: { titulo: 'Before you start', parrafos: [
        'Sign in on the login page with the demo regent\'s e-mail and the password you were given; passwords are not printed in this guide. The regent tour only exists in the demo account.',
        'The language switch (ES · EN · FR · PT) is in the top bar: the whole back office and the "Help" link (which opens this guide) change to the language you pick.',
      ] },
      panel: { titulo: 'The "Demo tour" panel', parrafos: [
        'At the bottom right you will see a card with the three steps of the tour. It ticks off what you have done, highlights the step you are on, and the "Go to this step" button takes you to the right screen. Progress is derived from the data: there is nothing to save.',
        'The "Reset demo account" button in the top bar wipes what you did (including the demo client\'s work) and puts everything back to the start. You will have to sign in again.',
      ] },
      pasos: { titulo: 'The three steps', intro: 'Around "Producto Ejemplo 3" (phase 8) and the "Farmacia Ejemplo" lead.' },
      fases: { titulo: 'The 13 phases of a file', intro: 'Every file moves through these phases; "My Inbox" shows where each of yours is. The highlighted one is the one you touch during the tour.' },
      notas: { titulo: 'Good to know', items: [
        'When you reject a document, the reason you write is shown to the client in their portal: be specific about what must be corrected.',
        'Phase 8 requires two confirmations: technical/matrices (yours) and legal (the lawyer\'s). The file does not move on until both are in.',
        'Leads are requests from the public website form; changing their status or leaving notes is how they are worked before the admin invites the company to create its account.',
        'The application and this guide exist in Spanish, English, French and Portuguese; pick the language in the top bar.',
      ] },
    },
  },
};

const fr = {
  comunes: {
    indice: 'Sommaire',
    etiquetas: {
      paso: 'Étape', siguiente: 'Étape suivante', pantalla: 'Ce que vous verrez dans l\'application', fin: 'Parcours terminé : vous avez vu l\'essentiel.',
      imprimir: 'Imprimer ou enregistrer en PDF', idiomas: 'Langue', volverPortal: 'Aller au portail', volverBackoffice: 'Aller au back-office', entrar: 'Se connecter',
      fase: 'Phase', enRecorrido: 'dans le parcours', actualizado: 'Guide généré le', pdfEjemplo: 'Télécharger le PDF d\'exemple',
    },
    fases: ['Premier contact', 'Collecte des informations préliminaires', 'Type d\'enregistrement sanitaire et voie d\'enregistrement', 'Préparation et envoi du devis', 'Paiement des frais de la procédure', 'Ouverture du dossier interne (CRM)', 'Instructions au client : documentation requise', 'Réception et examen de la documentation numérique (point de contrôle)', 'Demande et envoi des documents originaux', 'Réception et vérification des originaux (point de contrôle)', 'Constitution des dossiers DNFD et IEA', 'Dépôt auprès de la DNFD et de l\'IEA', 'Suivi et gestion après dépôt'],
  },
  cliente: {
    titulo: 'Guide du portail client',
    subtitulo: 'Comment mener l\'enregistrement sanitaire de votre produit avec Farmazed, pas à pas',
    intro: [
      'Le portail client de Farmazed vous accompagne dans l\'enregistrement sanitaire d\'un médicament, d\'un cosmétique ou d\'un produit similaire au Panama : des données de votre entreprise jusqu\'au paiement et au suivi de chaque dossier.',
      'Ce guide suit les six étapes du parcours guidé que vous pouvez activer dans le portail. Chaque étape reproduit l\'écran réel, vous dit quoi faire et ce qui vient ensuite.',
    ],
    secciones: {
      empezar: { titulo: 'Avant de commencer', parrafos: [
        'Connectez-vous sur la page de connexion avec le courriel et le mot de passe fournis par Farmazed. Si votre entreprise n\'a pas encore de compte, demandez-en un via « Demander un compte » sur cette même page.',
        'Le sélecteur de langue (ES · EN · FR · PT) est dans la barre du haut : toute l\'application et le lien « Aide » (qui ouvre ce guide) passent dans la langue choisie.',
      ] },
      panel: { titulo: 'Le parcours guidé', parrafos: [
        'Dans « Mon compte » (menu de votre avatar, en haut à droite), activez « Afficher le parcours guidé ». Une carte avec les six étapes apparaît en bas à droite : elle coche ce que vous avez déjà fait, met en évidence l\'étape en cours, et le bouton « Aller à cette étape » vous amène au bon écran.',
        'La progression se déduit des données de votre entreprise : rien à enregistrer. Vous pouvez réduire la carte ou la fermer avec la ✕, et la réactiver quand vous voulez dans « Mon compte ».',
      ] },
      pasos: { titulo: 'Les six étapes', intro: 'Dans l\'ordre du parcours. Une dizaine de minutes la première fois.' },
      demo: { titulo: 'Si vous utilisez le compte de démonstration', parrafos: [
        'Farmazed remet aux prospects un compte de démonstration (« Laboratorios Ejemplo S.A. ») avec des données d\'exemple. Le parcours y est toujours actif et les étapes parlent de ces données : un devis déjà envoyé pour le « Producto Ejemplo 2 », un bouton « Remplir avec des données d\'exemple » dans l\'assistant et un téléversement de documents simulé (les boutons « Téléverser » affichent un message au lieu d\'ouvrir l\'explorateur de fichiers).',
        'Rien de ce que vous faites dans la démo ne touche des données réelles ni n\'envoie de courriel, et le paiement passe par un prestataire de test même si le bouton indique « Payer avec PayPal ». Le bouton « Réinitialiser le compte démo », dans la barre du haut, efface ce que vous avez fait et remet tout à l\'état initial ; il faudra vous reconnecter.',
        'Inviter des membres et changer de forfait sont masqués dans la démo ; le reste du portail fonctionne comme en production.',
      ] },
      fases: { titulo: 'Les 13 phases d\'un dossier', intro: 'Chaque produit avance à travers ces phases ; « Mes produits » indique où en est le vôtre. Les phases surlignées sont celles que vous touchez pendant le parcours.' },
      notas: { titulo: 'Bon à savoir', items: [
        'L\'assistant exige les documents obligatoires de votre type de procédure pour envoyer la demande ; tant qu\'ils manquent, le produit reste enregistré comme brouillon et vous pouvez le reprendre.',
        'Le devis regroupe vos procédures en cours avec le détail des honoraires Farmazed et des taxes officielles (DNFD, MEF, IEA). En cas de doute, écrivez à votre équipe dans « Messages » avant de l\'accepter.',
        'Les messages sont rattachés à chaque produit : votre régent les voit dans le dossier et vous répond par la même voie.',
        'L\'application et ce guide existent en espagnol, anglais, français et portugais ; choisissez la langue dans la barre du haut. Les noms de produits et d\'entreprises ne sont pas traduits.',
      ] },
    },
  },
  regente: {
    titulo: 'Guide du régent (compte de démonstration)',
    subtitulo: 'Le back-office Farmazed vu par un régent, pas à pas',
    intro: [
      'Le compte de démonstration du régent vous permet de traiter un dossier d\'exemple comme le fait l\'équipe Farmazed : examiner des documents, confirmer la vérification technique et traiter un lead du CRM, avec des données d\'exemple et sans rien toucher de réel.',
      'Ce guide suit le panneau « Parcours démo » que vous verrez dans le back-office. Chaque étape reproduit l\'écran réel, vous dit quoi faire et ce qui vient ensuite.',
    ],
    secciones: {
      empezar: { titulo: 'Avant de commencer', parrafos: [
        'Connectez-vous sur la page de connexion avec le courriel du régent de démonstration et le mot de passe reçu ; les mots de passe ne figurent pas dans ce guide. Le parcours du régent n\'existe que dans le compte de démonstration.',
        'Le sélecteur de langue (ES · EN · FR · PT) est dans la barre du haut : tout le back-office et le lien « Aide » (qui ouvre ce guide) passent dans la langue choisie.',
      ] },
      panel: { titulo: 'Le panneau « Parcours démo »', parrafos: [
        'En bas à droite, une carte liste les trois étapes du parcours. Elle coche ce que vous avez déjà fait, met en évidence l\'étape en cours, et le bouton « Aller à cette étape » vous amène au bon écran. La progression se déduit des données : rien à enregistrer.',
        'Le bouton « Réinitialiser le compte démo », dans la barre du haut, efface ce que vous avez fait (y compris le travail du client démo) et remet tout à l\'état initial. Il faudra vous reconnecter.',
      ] },
      pasos: { titulo: 'Les trois étapes', intro: 'Autour du « Producto Ejemplo 3 » (phase 8) et du lead « Farmacia Ejemplo ».' },
      fases: { titulo: 'Les 13 phases d\'un dossier', intro: 'Chaque dossier avance à travers ces phases ; « Ma corbeille » indique où en est chacun des vôtres. La phase surlignée est celle que vous touchez pendant le parcours.' },
      notas: { titulo: 'Bon à savoir', items: [
        'Quand vous refusez un document, le motif que vous écrivez est visible par le client dans son portail : soyez précis sur ce qu\'il doit corriger.',
        'La phase 8 exige deux confirmations : technique/matrices (la vôtre) et juridique (celle de l\'avocat). Tant que les deux ne sont pas là, le dossier n\'avance pas.',
        'Les leads sont des demandes du formulaire public du site ; changer leur statut ou laisser des notes est la façon de les travailler avant que l\'admin n\'invite l\'entreprise à créer son compte.',
        'L\'application et ce guide existent en espagnol, anglais, français et portugais ; choisissez la langue dans la barre du haut.',
      ] },
    },
  },
};

const pt = {
  comunes: {
    indice: 'Conteúdo',
    etiquetas: {
      paso: 'Passo', siguiente: 'Próximo passo', pantalla: 'Assim se vê na aplicação', fin: 'Percurso concluído: já viu o essencial.',
      imprimir: 'Imprimir ou guardar como PDF', idiomas: 'Idioma', volverPortal: 'Ir para o portal', volverBackoffice: 'Ir para o back-office', entrar: 'Iniciar sessão',
      fase: 'Fase', enRecorrido: 'no percurso', actualizado: 'Manual gerado em',
    },
    fases: ['Primeiro contacto', 'Recolha de informação preliminar', 'Tipo de registo sanitário e via de registo', 'Elaboração e envio do orçamento', 'Pagamento dos custos do processo', 'Abertura do processo interno (CRM)', 'Instruções ao cliente: documentação necessária', 'Receção e revisão da documentação digital (ponto de controlo)', 'Pedido e envio dos documentos originais', 'Receção e verificação dos originais (ponto de controlo)', 'Preparação dos dossiers DNFD e IEA', 'Entrada na DNFD e no IEA', 'Acompanhamento e gestão após a entrada'],
  },
  cliente: {
    titulo: 'Manual do portal do cliente',
    subtitulo: 'Como conduzir o registo sanitário do seu produto com a Farmazed, passo a passo',
    intro: [
      'O portal do cliente da Farmazed acompanha-o no registo sanitário de um medicamento, cosmético ou produto semelhante no Panamá: desde os dados da sua empresa até ao pagamento e ao acompanhamento de cada processo.',
      'Este manual segue os seis passos do percurso guiado que pode ativar dentro do portal. Cada passo reproduz o ecrã real e diz-lhe o que fazer e o que vem a seguir.',
    ],
    secciones: {
      empezar: { titulo: 'Antes de começar', parrafos: [
        'Entre na página de início de sessão com o e-mail e a palavra-passe que a Farmazed lhe deu. Se a sua empresa ainda não tem conta, peça uma em "Pedir conta" nessa mesma página.',
        'O seletor de idioma (ES · EN · FR · PT) está na barra superior: toda a aplicação e a ligação "Ajuda" (que abre este manual) mudam para o idioma que escolher.',
      ] },
      panel: { titulo: 'O percurso guiado', parrafos: [
        'Em "A minha conta" (menu do seu avatar, em cima à direita) ligue "Mostrar o percurso guiado". Em baixo à direita aparece um cartão com os seis passos: assinala o que já fez, destaca o passo em que está e o botão "Ir para o passo" leva-o ao ecrã certo.',
        'O progresso deduz-se dos dados da sua empresa: não há nada para guardar. Pode minimizar o cartão ou fechá-lo com o ✕ e voltar a ativá-lo quando quiser em "A minha conta".',
      ] },
      pasos: { titulo: 'Os seis passos', intro: 'Pela ordem do percurso. Cerca de dez minutos da primeira vez.' },
      demo: { titulo: 'Se usa a conta de demonstração', parrafos: [
        'A Farmazed entrega aos potenciais clientes uma conta de demonstração ("Laboratorios Ejemplo S.A.") com dados de exemplo. Nela o percurso está sempre ativo e os passos falam desses dados: um orçamento já enviado para o "Producto Ejemplo 2", um botão "Preencher com dados de exemplo" no assistente e um carregamento de documentos simulado (os botões "Carregar" mostram um aviso em vez de abrir o explorador de ficheiros).',
        'Nada do que fizer na demo toca em dados reais nem envia e-mails, e o pagamento é feito por um fornecedor de teste mesmo que o botão diga "Pagar com PayPal". O botão "Reiniciar conta demo", na barra superior, apaga o que fez e repõe tudo como no início; terá de iniciar sessão outra vez.',
        'Convidar membros e mudar de plano estão ocultos na demo; o resto do portal funciona como em produção.',
      ] },
      fases: { titulo: 'As 13 fases de um processo', intro: 'Cada produto avança por estas fases; em "Os meus produtos" vê em qual está o seu. As destacadas são as que toca durante o percurso.' },
      notas: { titulo: 'Bom saber', items: [
        'O assistente exige os documentos obrigatórios do seu tipo de processo para enviar o pedido; enquanto faltarem, o produto fica guardado como rascunho e pode retomá-lo.',
        'O orçamento agrupa os seus processos em curso com a discriminação dos honorários Farmazed e das taxas oficiais (DNFD, MEF, IEA). Em caso de dúvida, escreva à sua equipa em "Mensagens" antes de o aceitar.',
        'As mensagens ficam associadas a cada produto: o seu regente vê-as no processo e responde pela mesma via.',
        'A aplicação e este manual existem em espanhol, inglês, francês e português; escolha o idioma na barra superior. Os nomes de produtos e empresas não se traduzem.',
      ] },
    },
  },
  regente: {
    titulo: 'Manual do regente (conta de demonstração)',
    subtitulo: 'O back-office da Farmazed visto por um regente, passo a passo',
    intro: [
      'A conta de demonstração do regente permite-lhe trabalhar um processo de exemplo como o faz a equipa da Farmazed: rever documentos, confirmar a verificação técnica e atender um lead do CRM, com dados de exemplo e sem tocar em nada real.',
      'Este manual segue o painel "Percurso demo" que verá dentro do back-office. Cada passo reproduz o ecrã real e diz-lhe o que fazer e o que vem a seguir.',
    ],
    secciones: {
      empezar: { titulo: 'Antes de começar', parrafos: [
        'Entre na página de início de sessão com o e-mail do regente de demonstração e a palavra-passe que recebeu; as palavras-passe não aparecem neste manual. O percurso do regente só existe na conta de demonstração.',
        'O seletor de idioma (ES · EN · FR · PT) está na barra superior: todo o back-office e a ligação "Ajuda" (que abre este manual) mudam para o idioma que escolher.',
      ] },
      panel: { titulo: 'O painel "Percurso demo"', parrafos: [
        'Em baixo à direita verá um cartão com os três passos do percurso. Assinala o que já fez, destaca o passo em que está e o botão "Ir para o passo" leva-o ao ecrã certo. O progresso deduz-se dos dados: não há nada para guardar.',
        'O botão "Reiniciar conta demo", na barra superior, apaga o que fez (também o trabalho do cliente demo) e repõe tudo como no início. Terá de iniciar sessão outra vez.',
      ] },
      pasos: { titulo: 'Os três passos', intro: 'Sobre o "Producto Ejemplo 3" (fase 8) e o lead "Farmacia Ejemplo".' },
      fases: { titulo: 'As 13 fases de um processo', intro: 'Cada processo avança por estas fases; em "A minha caixa" vê em qual está cada um dos seus. A destacada é a que toca durante o percurso.' },
      notas: { titulo: 'Bom saber', items: [
        'Ao rejeitar um documento, o motivo que escrever é visto pelo cliente no seu portal: seja concreto sobre o que deve corrigir.',
        'A fase 8 exige duas confirmações: a técnica/matrizes (sua) e a jurídica (do advogado). Até estarem as duas, o processo não avança.',
        'Os leads são pedidos do formulário público do site; mudar o seu estado ou deixar notas é a forma de os trabalhar antes de o admin convidar a empresa a criar a sua conta.',
        'A aplicação e este manual existem em espanhol, inglês, francês e português; escolha o idioma na barra superior.',
      ] },
    },
  },
};

module.exports = { IDIOMAS, NOMBRES, FASES_RECORRIDO, TEXTOS: { es, en, fr, pt } };
