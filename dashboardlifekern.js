// ─── PDF.js worker ────────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';

// ─── UI helper ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

let releaseNotesLoaded = false;
let releaseNotesReturnFocus = null;
function scrollReleaseNotesToLatest() {
  const content = $('releaseNotesContent');
  if (!content) return;
  requestAnimationFrame(() => requestAnimationFrame(() => { content.scrollTop = content.scrollHeight; }));
}
function renderReleaseNotes(rawText) {
  const content = $('releaseNotesContent');
  if (!content) return;
  const fragment = document.createDocumentFragment();
  let list = null;
  String(rawText || '').split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) { list = null; return; }
    if (/^v\d{1,2}\.\d{1,2}[.,](?:\d{2}|\d{4})$/i.test(line)) {
      const title = document.createElement('h3');
      title.className = 'releaseNotesVersion';
      title.textContent = line;
      fragment.appendChild(title);
      list = null;
      return;
    }
    if (!list) {
      list = document.createElement('ul');
      list.className = 'releaseNotesList';
      fragment.appendChild(list);
    }
    const item = document.createElement('li');
    item.textContent = line.replace(/^[•*\-]\s*/, '');
    list.appendChild(item);
  });
  content.replaceChildren(fragment);
}
function openReleaseNotesModal() {
  const modal = $('releaseNotesModal');
  const content = $('releaseNotesContent');
  if (!modal || !content) return;
  releaseNotesReturnFocus = document.activeElement;
  modal.classList.remove('hidden');
  document.body.classList.add('releaseNotesOpen');
  $('appVersionBtn')?.setAttribute('aria-expanded', 'true');
  setText('releaseNotesTitle', currentLang === 'fr' ? 'Notes de version' : 'Release notes');
  $('releaseNotesCloseBtn')?.setAttribute('aria-label', currentLang === 'fr' ? 'Fermer' : 'Sluiten');
  $('releaseNotesCloseBtn')?.focus();
  if (!releaseNotesLoaded) {
    renderReleaseNotes($('releaseNotesSource')?.textContent || '');
    releaseNotesLoaded = true;
  }
  content.classList.remove('hidden');
  scrollReleaseNotesToLatest();
}
function closeReleaseNotesModal() {
  const modal = $('releaseNotesModal');
  if (!modal || modal.classList.contains('hidden')) return;
  modal.classList.add('hidden');
  document.body.classList.remove('releaseNotesOpen');
  $('appVersionBtn')?.setAttribute('aria-expanded', 'false');
  if (releaseNotesReturnFocus?.focus) releaseNotesReturnFocus.focus();
}

document.addEventListener('DOMContentLoaded', () => {
  $('appVersionBtn').addEventListener('click', openReleaseNotesModal);
  $('releaseNotesCloseBtn').addEventListener('click', closeReleaseNotesModal);
  $('releaseNotesModal').addEventListener('click', event => {
    if (event.target === $('releaseNotesModal')) closeReleaseNotesModal();
  });
  document.addEventListener('keydown', event => {
    const modal = $('releaseNotesModal');
    if (modal.classList.contains('hidden')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeReleaseNotesModal(); }
    if (event.key === 'Tab') {
      const first = $('releaseNotesCloseBtn'), last = $('releaseNotesContent');
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
});

// ─── Zichtbaarheid van dashboardblokken ─────────────
function toggleDashboardBlockVisibility(block, panelSelector) {
  if (!block) return;
  const isOpen = drillMode ? block.classList.contains('drillOpen') : !block.classList.contains('manualClosed');
  const applyToggle = () => {
    block.classList.toggle(drillMode ? 'drillOpen' : 'manualClosed');
    applyDashboardDisplayModes();
  };
  if (!isOpen) {
    applyToggle();
    triggerBlockOpenMotion(block);
    return;
  }
  if (motionIsReduced()) {
    applyToggle();
    return;
  }
  const panel = block.querySelector(panelSelector);
  if (!panel || !panel.animate) {
    applyToggle();
    return;
  }
  const anim = panel.animate([
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(-5px)' }
  ], { duration: 150, easing: 'ease-out' });
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    applyToggle();
  };
  anim.onfinish = finish;
  anim.oncancel = finish;
}
function triggerBlockOpenMotion(block) {
  if (!block || motionIsReduced() || document.body.classList.contains('pdfExportBusy')) return;
  block.classList.remove('motionOpen');
  void block.offsetWidth;
  block.classList.add('motionOpen');
  window.clearTimeout(block._motionOpenTimer);
  block._motionOpenTimer = window.setTimeout(() => block.classList.remove('motionOpen'), 900);
}
function findCategoryBlockInActiveTab(category) {
  const section = document.querySelector('#dashboard .section.active');
  if (!section || !category) return null;
  const target = normKey(displayLabel(category));
  const rawTarget = normKey(category);
  const blocks = section.id === 'portefeuille'
    ? Array.from(section.querySelectorAll('.portfolioCategoryBlock'))
    : Array.from(section.querySelectorAll('.cat'));
  return blocks.find(block => {
    const title = block.querySelector('.catTitle');
    const text = normKey(title?.innerText || title?.textContent || '');
    return text === target || text === rawTarget || text.includes(target) || text.includes(rawTarget);
  }) || null;
}
function openCategoryBlockIfNeeded(block) {
  if (!block) return;
  if (block.classList.contains('totalNonLife') || block.classList.contains('portfolioTotalBlock')) return;
  const isPortfolio = block.classList.contains('portfolioCategoryBlock');
  const isClosed = drillMode ? !block.classList.contains('drillOpen') : block.classList.contains('manualClosed');
  if (!isClosed) return;
  if (drillMode) block.classList.add('drillOpen');
  else block.classList.remove('manualClosed');
  applyDashboardDisplayModes();
  triggerBlockOpenMotion(block);
  if (isPortfolio) block.querySelector('.portfolioGrid')?.getBoundingClientRect();
  else block.querySelector('.p-18')?.getBoundingClientRect();
}
function jumpToKpiCategory(category) {
  const block = findCategoryBlockInActiveTab(category);
  if (!block) return;
  openCategoryBlockIfNeeded(block);
  const header = block.querySelector('.catHead,.portfolioCategoryHead') || block;
  window.setTimeout(() => {
    const y = Math.max(0, header.getBoundingClientRect().top + window.scrollY - 14);
    window.scrollTo({ top: y, behavior: motionIsReduced() ? 'auto' : 'smooth' });
  }, 35);
}
document.addEventListener('DOMContentLoaded', () => {
  ['uploadLogo', 'brokerLogoImg'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('error', () => { el.style.display = 'none'; });
  });
});

// ─── Applicatiestate ─────────────────────────────────────────────────────────
// Losse variabelen zijn de werkende staat; state{} wordt bijgehouden als
// lees-referentie (bijv. voor debugging). Muteer altijd via de losse vars
// én synchroniseer state{} in setViewMode / setDrillMode.
let currentLang = 'nl';
let lastData    = null;
let csvResult   = '';
let brokerInfo  = { label: '', number: '', name: '' };
let dashboardCurrentPeriod = null;
let dashboardPreviousPeriod = null;
let currentDashboardType = 'life';
let viewMode = 'main';
let drillMode = true;
let previousYearsMode = false;
let productionPieState = { segments: [], total: 0 };
let topInfoCollapsed = false;
let lastKpiContext = null;

const state = {
  get lang()                  { return currentLang; },
  get data()                  { return lastData; },
  get csvResult()             { return csvResult; },
  get brokerInfo()            { return brokerInfo; },
  get dashboardCurrentPeriod(){ return dashboardCurrentPeriod; },
  get dashboardPreviousPeriod(){ return dashboardPreviousPeriod; },
  get viewMode()              { return viewMode; },
  get drillMode()             { return drillMode; },
  get productionPieState()    { return productionPieState; }
};

let euro, num, pct;

const I18N = {
  nl: {
    pageTitle: 'Van PDF naar helder inzicht', heroEyebrow: 'Kerncijfers life',
    pageLead: 'Upload je <strong>kerncijfers life PDF</strong>. Het dashboard zet de gegevens automatisch om in een duidelijke analyse van productie, koopsommen, verhogingen enz. Dit dashboard werkt met de PDF kerncijfers life die je hebt gedownload vanuit Salesforce (je moet de PDF effectief downloaden als bestand, afdrukken als PDF werkt niet), zowel op groepsniveau, koepelniveau alsook voor de kerncijfers AM, CDR of CD.',
    heroBenefitAnalysis: 'Automatische analyse', heroBenefitCompare: 'Direct vergelijkbaar', heroBenefitSafe: 'Veilig',
    uploadTitle: "Sleep je PDF's hierheen", uploadHint: 'of klik om één of meerdere bestanden te kiezen', heroUploadButton: "PDF's selecteren", heroUploadMeta: 'PDF · NL of FR', importPdf: 'Importeer',
    downloadCsv: 'Download CSV', exportPdf: 'Exporteer PDF', pdfBusy: 'PDF wordt gemaakt…', pdfOptionsTitle: 'PDF-secties', pdfNoSections: 'Selecteer minstens één PDF-sectie.', noPdf: 'Klaar om je kerncijfers te verwerken', processing: '⏳ PDF verwerken…',
    pdfSelectAll: 'Alles selecteren', pdfSelectNone: 'Niets selecteren', printPdf: 'Print to PDF', printPdfDestinationHint: 'Kies in het afdrukvenster ‘Opslaan als PDF’ als bestemming/printer.', kpiExport: 'KPI’s exporteren', imageDownload: 'Download als PNG', imageCopy: 'Kopieer als afbeelding',
    success: n => '✅ PDF geladen & verwerkt: ' + n + ' datarijen.', error: '❌ Fout bij verwerken PDF: ',
    broker: 'Makelaar', koepelnummer: 'koepelnummer', groepsnummer: 'groepsnummer', vs: 'vs', main: 'Hoofd', sub: 'Sub', lowerPositive: 'daling is positief', lowerBetter: '', viewModeLabel: 'Weergave', viewAll: 'Hoofd- en subcategorieën', viewMainOnly: 'Hoofdcategorieën', viewSubOnly: 'Subcategorieën', drillDown: 'Beperkte weergave', drillDownActive: 'Alles tonen', importControlTitle: 'Importcontrole', importControlSub: 'Snelle controle of de life-PDF correct werd geïnterpreteerd', importPeriods: 'Aantal periodes gevonden', importLatestPeriod: 'Laatste periode gevonden', importTotalProd: 'TOTAAL LEVEN productie', importTotalSchade: '', importSpPct: '', importBroker: 'Makelaar/koepelnummer', yes: 'Ja', no: 'Nee', topCompactTitle: 'PDF import & controle', topShow: 'Toon importinformatie', topHide: 'Verberg importinformatie', topOk: 'Importcontrole OK', topAttention: n => n + ' aandachtspunt' + (n === 1 ? '' : 'en'), topPeriodsShort: 'periodes', topLatestShort: 'laatste',
    tabSamenvatting: 'Samenvatting', tabProductie: 'Productie', tabVerval: 'Verval', tabTransformatie: 'Transformatie', tabProgressie: 'Progressie', tabSchade: 'Schade', tabPortefeuille: 'Portefeuille', tabDetail: 'Detail', pdfOptDetail: 'Detail per categorie',
    prodTitle: 'Productie', vervalTitle: 'Verval', transTitle: 'Transformatie', progTitle: 'Progressie', schadeTitle: 'Schade', portefeuilleTitle: 'Portefeuille', detailTitle: 'Hoofd- en subcategorieën',
    prodNote: 'Productie toont aantal zaken, premie productie en premie koopsom per hoofdcategorie en subcategorie.', portefeuilleNote: 'Portefeuille toont polissen, portefeuillepremie, uitgegeven premie en reserves per hoofdcategorie en subcategorie.', portefeuilleSub: (a,b) => 'Portefeuille life: ' + a + ' versus ' + b + '.', portefeuilleYears: 'Voorbije 3 jaar', portefeuilleComparison: 'Laatste periode J vs J-1', portefeuilleEmpty: 'Geen portefeuillegegevens gevonden.', vorigJaar: 'Vorig jaar', huidigJaar: 'Dit jaar', vervalNote: 'Verval toont aantal zaken, premie verval en de opsplitsing onnatuurlijk/natuurlijk verval.', transNote: 'Transformatie toont premie transformatie, premie verhoging en premie verlaging.', progNote: 'Progressie toont aantal progressie en premie progressie per hoofdcategorie en subcategorie.', schadeNote: '',
    comparison: (a,b) => 'Vergelijking ' + a + ' versus ' + b + '.', schadeComparison: (a,b) => 'Vergelijking ' + a + ' versus ' + b + '. Voor schade zijn lagere waarden beter: dalende schadelast en dalende S/P worden positief getoond.',
    noProd: 'Geen productiegegevens gevonden.', noVerval: 'Geen vervalgegevens gevonden.', noProg: 'Geen progressiegegevens gevonden.', noSchade: 'Geen schadegegevens gevonden.',
    productie: 'Productie', verval: 'Verval', progressie: 'Progressie', schadelast: 'Schadelast', schade: 'Schade', productiepremie: 'Productiepremie', aantalZaken: 'Aantal zaken', aantalProductiezaken: 'Aantal productiezaken', vervalpremie: 'Vervalpremie', aantalVerval: 'Aantal verval', klantMaatschappij: 'Klant / maatschappij', aantalVervallenZaken: 'Aantal vervallen zaken', vervalKlant: 'Verval door klant', vervalMaatschappij: 'Verval door maatschappij', progressiepremie: 'Progressiepremie', aantalProgressiezaken: 'Aantal progressiezaken', transformatie: 'Transformatie', spNietAfgetopt: 'S/P niet afgetopt', afgetopteSchadelast: 'Afgetopte schadelast', spAfgetopt: 'S/P afgetopt', aantalSchadegevallen: 'Aantal schadegevallen', verdiendePremie: 'Verdiende premie', categorie: 'Categorie', aantal: 'Aantal', spAftop: 'S/P aftop', detailProductie: 'Productie', detailSchade: 'Schade', totaalPrefix: 'Totaal · ', productionPieTitle: 'Verdeling productie', productionPieSub: p => 'Totale productiepremie per tak voor ' + p + '.', productionPieEmpty: 'Geen productiegegevens gevonden voor de verdeling.', vervalPieTitle: 'Verdeling vervalpremie', vervalPieSub: p => 'Totale vervalpremie per tak voor ' + p + '.', vervalPieEmpty: 'Geen vervalgegevens gevonden voor de verdeling.', progressiePieTitle: 'Verdeling progressie', progressiePieSub: p => 'Totale progressiepremie per tak voor ' + p + '.', progressiePieEmpty: 'Geen progressiegegevens gevonden voor de verdeling.', schadePieTitle: 'Verdeling schadelast', schadePieSub: p => 'Totale schadelast per tak voor ' + p + '.', schadePieEmpty: 'Geen schadegegevens gevonden voor de verdeling.',
    labels: {'Auto':'Auto','Auto Vloten':'Vloten','Auto Niet Vloten':'Niet Vloten','Particulieren':'Particulieren','Particulieren Brand':'Brand','Particulieren BA':'BA','Particulieren Overige':'Overige','Ondernemingen':'Ondernemingen','Ondernemingen Brand':'Brand','Ondernemingen BA':'BA','Ondernemingen Overige':'Overige','Arbeidsongevallen':'Arbeidsongevallen','Rechtsbijstand':'Rechtsbijstand','Rechtsbijstand Stand Alone':'Rechtsbijstand','TOTAAL NON LIFE':'TOTAAL NON LIFE','Tweede Pijler':'Tweede Pijler','Derde Pijler':'Derde Pijler','Vierde Pijler':'Vierde Pijler','TOTAAL LEVEN':'TOTAAL LEVEN'}
  },
  fr: {
    pageTitle: 'Du PDF à une vision claire', heroEyebrow: 'Chiffres clés vie',
    pageLead: 'Importez votre <strong>PDF de chiffres clés vie</strong>. Le tableau de bord transforme automatiquement les données en une analyse claire de la production, des primes uniques, des augmentations, etc. Ce tableau de bord utilise le PDF de chiffres clés vie téléchargé depuis Salesforce (vous devez télécharger le PDF comme fichier, une impression au format PDF ne fonctionne pas), au niveau du groupe, de la coupole et pour les chiffres clés AM, CDR ou CD.',
    heroBenefitAnalysis: 'Analyse automatique', heroBenefitCompare: 'Comparaison directe', heroBenefitSafe: 'Sécurisé',
    uploadTitle: 'Glissez votre PDF ici', uploadHint: 'ou cliquez pour choisir un fichier', heroUploadButton: 'Sélectionner un PDF', heroUploadMeta: 'PDF · NL ou FR', importPdf: 'Importer',
    downloadCsv: 'Télécharger CSV', exportPdf: 'Exporter PDF', pdfBusy: 'Création du PDF…', pdfOptionsTitle: 'Sections PDF', pdfNoSections: 'Sélectionnez au moins une section PDF.', noPdf: 'Prêt à traiter vos chiffres clés', processing: '⏳ Traitement du PDF…',
    pdfSelectAll: 'Tout sélectionner', pdfSelectNone: 'Tout désélectionner', printPdf: 'Imprimer en PDF', printPdfDestinationHint: 'Choisissez « Enregistrer au format PDF » comme destination/imprimante dans la fenêtre d’impression.', kpiExport: 'Exporter les indicateurs', imageDownload: 'Télécharger en PNG', imageCopy: 'Copier comme image',
    success: n => '✅ PDF chargé et traité : ' + n + ' lignes de données.', error: '❌ Erreur lors du traitement du PDF : ',
    broker: 'Courtier', koepelnummer: 'n° coupole', groepsnummer: 'n° groupe', vs: 'vs', main: 'Principal', sub: 'Sous-cat.', lowerPositive: 'baisse positive', lowerBetter: 'sinistres : plus bas est meilleur', viewModeLabel: 'Affichage', viewAll: 'Tout', viewMainOnly: 'Catégories principales', viewSubOnly: 'Sous-catégories', drillDown: 'Affichage limité', drillDownActive: 'Tout afficher', importControlTitle: 'Contrôle import', importControlSub: 'Contrôle rapide de l’interprétation du PDF', importPeriods: 'Nombre de périodes', importLatestPeriod: 'Dernière période trouvée', importTotalProd: 'TOTAL VIE production', importTotalSchade: 'TOTAL NON VIE sinistres', importSpPct: 'S/P % lu correctement', importBroker: 'Courtier/n° coupole', yes: 'Oui', no: 'Non', topCompactTitle: 'Import PDF & contrôle', topShow: 'Afficher les informations import', topHide: 'Masquer les informations import', topOk: 'Contrôle import OK', topAttention: n => n + ' point' + (n === 1 ? '' : 's') + ' d’attention', topPeriodsShort: 'périodes', topLatestShort: 'dernière',
    tabSamenvatting: 'Résumé', tabProductie: 'Production', tabVerval: 'Chute', tabTransformatie: 'Transformation', tabProgressie: 'Progression', tabSchade: 'Sinistres', tabPortefeuille: 'Portefeuille', tabDetail: 'Détail', pdfOptDetail: 'Détail par catégorie',
    prodTitle: 'Production', vervalTitle: 'Chute', transTitle: 'Transformation', progTitle: 'Progression', schadeTitle: 'Sinistres', portefeuilleTitle: 'Portefeuille', detailTitle: 'Catégories principales et sous-catégories',
    prodNote: 'Les données ci-dessous affichent d’abord la ligne principale par catégorie, puis toutes les sous-catégories du CSV.', portefeuilleNote: 'Les graphiques ci-dessous affichent la prime acquise au niveau TOTAL NON VIE : d’abord les trois dernières années complètes, puis la dernière période de l’année passée face à la dernière période de cette année.', portefeuilleSub: (a,b) => 'Prime acquise TOTAL NON VIE. Années complètes séparées ; dernière période : ' + a + ' versus ' + b + '.', portefeuilleYears: '3 dernières années', portefeuilleComparison: 'Dernière période A vs A-1', portefeuilleEmpty: 'Aucune donnée portefeuille trouvée.', vorigJaar: 'Année passée', huidigJaar: 'Cette année', vervalNote: 'Les données ci-dessous affichent d’abord la ligne principale par catégorie, puis toutes les sous-catégories du CSV, y compris la chute client et compagnie.', progNote: 'La progression est affichée comme production - chute + transformation, par catégorie principale et sous-catégorie telle que fournie dans le CSV.', schadeNote: 'Interprétation sinistres : une baisse du nombre de sinistres, de la charge sinistre ou du S/P est positive et s’affiche en vert. Une hausse est négative. Les données ci-dessous affichent d’abord la ligne principale par catégorie, puis toutes les sous-catégories du CSV.',
    comparison: (a,b) => 'Comparaison ' + a + ' versus ' + b + '.', schadeComparison: (a,b) => 'Comparaison ' + a + ' versus ' + b + '. Pour les sinistres, des valeurs plus basses sont meilleures : une baisse de la charge sinistre et du S/P est positive.',
    noProd: 'Aucune donnée de production trouvée.', noVerval: 'Aucune donnée de chute trouvée.', noProg: 'Aucune donnée de progression trouvée.', noSchade: 'Aucune donnée sinistres trouvée.',
    productie: 'Production', verval: 'Chute', progressie: 'Progression', schadelast: 'Charge sinistre', schade: 'Sinistres', productiepremie: 'Prime production', aantalZaken: 'Nombre affaires', aantalProductiezaken: 'Nombre affaires production', vervalpremie: 'Prime chute', aantalVerval: 'Nombre affaires chute', klantMaatschappij: 'Client / compagnie', aantalVervallenZaken: 'Nombre affaires chute', vervalKlant: 'Prime chute client', vervalMaatschappij: 'Prime chute compagnie', progressiepremie: 'Prime progression', aantalProgressiezaken: 'Nombre progression', transformatie: 'Prime transformation', spNietAfgetopt: 'S/P non écrêté', afgetopteSchadelast: 'Charge sinistre écrêtée', spAfgetopt: 'S/P écrêté', aantalSchadegevallen: 'Nombre sinistres', verdiendePremie: 'Prime acquise', categorie: 'Catégorie', aantal: 'Nombre', spAftop: 'S/P écrêté', detailProductie: 'Production', detailSchade: 'Sinistres', totaalPrefix: 'Total · ', productionPieTitle: 'Répartition production', productionPieSub: p => 'Prime production totale par branche pour ' + p + '.', productionPieEmpty: 'Aucune donnée de production trouvée pour la répartition.', vervalPieTitle: 'Répartition chute', vervalPieSub: p => 'Prime chute totale par branche pour ' + p + '.', vervalPieEmpty: 'Aucune donnée de chute trouvée pour la répartition.', progressiePieTitle: 'Répartition progression', progressiePieSub: p => 'Prime progression totale par branche pour ' + p + '.', progressiePieEmpty: 'Aucune donnée de progression trouvée pour la répartition.', schadePieTitle: 'Répartition charge sinistre', schadePieSub: p => 'Charge sinistre totale par branche pour ' + p + '.', schadePieEmpty: 'Aucune donnée sinistres trouvée pour la répartition.',
    labels: {'Auto':'Auto','Auto Vloten':'Flottes','Auto Niet Vloten':'Non flottes','Particulieren':'Particuliers','Particulieren Brand':'Incendie','Particulieren BA':'RC','Particulieren Overige':'Autres','Ondernemingen':'Entreprises','Ondernemingen Brand':'Incendie','Ondernemingen BA':'RC','Ondernemingen Overige':'Autres','Arbeidsongevallen':'Accidents de travail','Rechtsbijstand':'Protection juridique','Rechtsbijstand Stand Alone':'Protection juridique','TOTAAL NON LIFE':'TOTAL NON VIE'}
  }
};

Object.assign(I18N.fr.labels, {
  "Tweede Pijler": "Deuxième Pilier",
  "IPT": "EIP",
  "VAPZ": "PLCI",
  "POZ": "CPTI",
  "RIZIV": "PLCI INAMI",
  "Derde Pijler": "Troisième Pilier",
  "Pensioensparen": "Épargne-pension",
  "Langetermijnsparen": "Épargne à long terme",
  "Vierde Pijler": "Quatrième Pilier",
  "Jeugdplan": "Plan jeunesse",
  "Overige Particulieren Niet-Fiscaal": "Autres particuliers non fiscaux",
  "Beleggingsproducten Niet-Fiscaal": "Produits d’investissement non fiscaux",
  "Verzekeringsbon": "Bon d’assurance",
  "TOTAAL LEVEN": "TOTAL VIE",
  "TOTAAL PREMIES": "Total des primes",
  "Totaal premies": "Total des primes",
  "Premie productie": "Prime production",
  "Premie koopsom": "Prime unique",
  "Premie verhoging": "Prime augmentation",
  "Reserves": "Réserves",
  "Productie": "Production",
  "Koopsommen": "Primes uniques",
  "Koopsom": "Prime unique",
  "Verhogingen": "Augmentations",
  "Verhoging": "Augmentation",
  "Portefeuillepremie": "Prime portefeuille",
  "Polissen portefeuille": "Polices en portefeuille",
  "Aantal polissen portefeuille": "Nombre de polices en portefeuille",
  "Aantal zaken": "Nombre d’affaires",
  "Aantal zaken productie": "Nombre d’affaires production",
  "Hoofd- en subcategorieen": "Catégories principales et sous-catégories",
  "Hoofd- en subcategorieën": "Catégories principales et sous-catégories",
  "Vergelijking van de premie productie per hoofdcategorie.": "Comparaison des primes de production par catégorie principale.",
  "Vergelijking van de premie koopsom per hoofdcategorie.": "Comparaison des primes uniques par catégorie principale.",
  "Vergelijking van de premie verhoging per hoofdcategorie.": "Comparaison des primes d’augmentation par catégorie principale.",
  "Productie + verhogingen + 10% van de koopsom.": "Production + augmentations + 10 % des primes uniques.",
  "Premie productie per pijler": "Prime de production par pilier",
  "Premie koopsom per pijler": "Prime unique par pilier",
  "Premie verhoging per pijler": "Prime d’augmentation par pilier",
  "APE per pijler": "APE par pilier",
  "Verdeling totaal premies": "Répartition du total des primes",
  "Verdeling premie productie": "Répartition des primes de production",
  "Totaal premie productie": "Total des primes de production",
  "Verdeling koopsommen": "Répartition des primes uniques",
  "Totaal koopsommen": "Total des primes uniques",
  "Verdeling verhogingen": "Répartition des augmentations",
  "Totaal verhogingen": "Total des augmentations",
  "Verdeling portefeuillepremie": "Répartition de la prime portefeuille",
  "Totaal portefeuillepremie": "Total de la prime portefeuille",
  "2e pijler": "2e pilier",
  "3e pijler": "3e pilier",
  "4e pijler": "4e pilier",
  "Geen gegevens gevonden voor de hoofdcategorieën.": "Aucune donnée trouvée pour les catégories principales.",
  "Geen koopsommen gevonden.": "Aucune prime unique trouvée.",
  "Geen verhogingen gevonden.": "Aucune augmentation trouvée.",
  "Aantal prod.": "Nombre prod.",
  "Δ aantal": "Δ nombre",
  "Premie prod.": "Prime prod.",
  "Δ prod.": "Δ prod.",
  "Δ koopsom": "Δ prime unique",
  "Δ verhoging": "Δ augmentation",
  "Polissen port.": "Polices port.",
  "Δ polissen": "Δ polices",
  "Δ port.": "Δ port.",
  "Δ reserves": "Δ réserves"
});
Object.assign(I18N.fr, { portefeuilleNote: 'Prime portefeuille par catégorie principale et sous-catégorie.', portefeuilleSub: (a,b) => 'Prime portefeuille. Comparaison ' + a + ' et ' + b + '.', vervalNote: 'Primes uniques par catégorie principale et sous-catégorie.' });

function msg(key, ...args) { const value = I18N[currentLang][key]; return typeof value === 'function' ? value(...args) : (value ?? key); }
function updateFormatters() {
  const locale = currentLang === 'fr' ? 'fr-BE' : 'nl-BE';
  euro = {
    format(value) {
      const v = Math.round(Number(value) || 0);
      const sign = v < 0 ? '-' : '';
      const amount = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return `${sign}€ ${amount}`;
    }
  };
  num = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  pct = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
}
function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
function setHtml(id, html) { const el = $(id); if (el) el.innerHTML = html; }
function updateStaticLanguage() {
  document.documentElement.lang = currentLang; document.title = currentLang === 'fr' ? 'Tableau de bord chiffres clés vie' : 'Dashboard kerncijfers life';
  setText('languageLabel', currentLang === 'fr' ? 'Langue' : 'Taal / Langue');
  for (const id of ['pageTitle', 'heroEyebrow', 'heroBenefitAnalysis', 'heroBenefitCompare', 'heroBenefitSafe', 'uploadTitle', 'uploadHint', 'heroUploadButton', 'heroUploadMeta', 'pdfSelectAll', 'pdfSelectNone']) setText(id, msg(id));
  setHtml('pageLead', msg('pageLead'));
  setText('downloadCsvLabel', msg('downloadCsv'));
  setText('exportPdfLabel', msg('exportPdf'));
  setText('printPdfBtn', msg('printPdf'));
  setText('pdfPrintDestinationHint', msg('printPdfDestinationHint'));
  setText('summaryTitle', msg('tabSamenvatting'));
  setText('previousYearsToggleLabel', currentLang === 'fr' ? 'Années précédentes' : 'Vorige jaren');
  $('viewModeControls').setAttribute('aria-label', msg('viewModeLabel'));
  document.querySelectorAll('[data-static-export]').forEach(actions => {
    actions.innerHTML = exportActionButtonsHtml();
  });
  setHtml('lifeKpiActions', exportActionsHtml({classes:'kpiExportActions', target:'topKpis', label:msg('kpiExport')}));
  setText('pdfOptionsTitle', msg('pdfOptionsTitle')); setText('pdfOptSummary', msg('tabSamenvatting')); setText('pdfOptProductie', msg('tabProductie')); setText('pdfOptVerval', msg('tabVerval')); setText('pdfOptTransformatie', msg('tabTransformatie')); setText('pdfOptDetail', msg('pdfOptDetail'));
  setText('tabSamenvatting', msg('tabSamenvatting')); setText('tabProductie', msg('tabProductie')); setText('tabVerval', msg('tabVerval')); setText('tabTransformatie', msg('tabTransformatie')); setText('tabProgressie', msg('tabProgressie')); setText('tabPortefeuille', msg('tabPortefeuille')); setText('tabDetail', msg('tabDetail'));
  setText('viewAllBtn', msg('viewAll')); setText('viewMainBtn', msg('viewMainOnly')); setText('viewSubBtn', msg('viewSubOnly')); applyDashboardDisplayModes(); setText('topCompactTitle', msg('topCompactTitle')); if (lastData && (dashboardCurrentPeriod || currentDashboardType === 'adviesvergoeding')) { if (dashboardCurrentPeriod) renderImportControl(lastData, dashboardCurrentPeriod); renderTopCompactBar(); updateTopInfoToggleButton(); }
  setText('prodTitle', msg('prodTitle')); setText('vervalTitle', msg('vervalTitle')); setText('transTitle', msg('transTitle')); setText('progTitle', msg('progTitle')); setText('portefeuilleTitle', msg('portefeuilleTitle')); setText('detailTitle', msg('detailTitle')); setText('productionPieTitle', msg('productionPieTitle'));
  updateSectionPeriodInline(dashboardPreviousPeriod, dashboardCurrentPeriod);
  applyLifeDashboardLabels();
  setText('prodNote', msg('prodNote')); setText('vervalNote', msg('vervalNote')); setText('transNote', msg('transNote')); setText('progNote', msg('progNote')); setText('portefeuilleNote', msg('portefeuilleNote'));
  const status = $('status'); if (status && (!csvResult || status.textContent.includes('Nog geen PDF') || status.textContent.includes('Aucun PDF'))) status.textContent = msg('noPdf');
  const styleId = 'i18nTotalPrefixStyle';
  let style = document.getElementById(styleId);
  if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
  // Gebruik data-attribuut ipv dynamische CSS content-string om XSS-risico en CSS-injection te vermijden
  style.textContent = `.cat.totalNonLife .catTitle::before{content:attr(data-total-prefix);color:#dcecff;font-weight:950}`;
  // Stel het data-attribuut in op alle bestaande totalNonLife-titels
  document.querySelectorAll('.cat.totalNonLife .catTitle').forEach(el => {
    el.dataset.totalPrefix = msg('totaalPrefix');
  });
}
function setLanguage(lang) {
  currentLang = lang === 'fr' ? 'fr' : 'nl';
  const sel = $('languageSelect');
  if (sel) sel.value = currentLang;
  updateFormatters();
  updateStaticLanguage();
  renderBrokerInfo();
  if (lastData) {
    if (currentDashboardType === 'adviesvergoeding') {
      buildAdviceDashboard(lastData);
      setTopInfoCollapsed(true);
    } else {
      build(lastData);
      renderTopCompactBar();
    }
    setStatus(currentDashboardType === 'adviesvergoeding' ? `✅ Adviesvergoeding geladen: ${lastData.length} totalen.` : msg('success', lastData.length));
  }
}

function hasManualClosedCategories() {
  return !!document.querySelector('.cat.manualClosed,.portfolioCategoryBlock.manualClosed');
}

function applyDashboardDisplayModes() {
  const dash = $('dashboard');
  if (!dash) return;
  dash.classList.toggle('view-main-only', viewMode === 'main');
  dash.classList.toggle('view-sub-only', viewMode === 'sub');
  dash.classList.toggle('drillMode', !!drillMode);
  document.querySelectorAll('#viewModeControls .viewBtn').forEach(btn => {
    const active = btn.dataset.view === viewMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  const drillBtn = $('drillToggleBtn');
  const manualClosedInAllMode = !drillMode && hasManualClosedCategories();
  if (drillBtn) {
    drillBtn.classList.toggle('active', !!drillMode || manualClosedInAllMode);
    const expand = drillMode || manualClosedInAllMode;
    drillBtn.textContent = currentLang === 'fr'
      ? (expand ? 'Tout déplier' : 'Tout replier')
      : (expand ? 'Alles uitklappen' : 'Alles inklappen');
  }
  if (!drillMode) document.querySelectorAll('.cat.drillOpen,.portfolioCategoryBlock.drillOpen').forEach(cat => cat.classList.remove('drillOpen'));
  if (drillMode) document.querySelectorAll('.cat.manualClosed,.portfolioCategoryBlock.manualClosed').forEach(cat => cat.classList.remove('manualClosed'));
}
function setViewMode(mode) {
  viewMode = ['all', 'main', 'sub'].includes(mode) ? mode : 'all';
  applyDashboardDisplayModes();
}
function setPreviousYearsMode(on) {
  previousYearsMode = on;
  if (!lastData || !dashboardCurrentPeriod || currentDashboardType !== 'life') return;
  renderInsightSummary(lastData, dashboardPreviousPeriod, dashboardCurrentPeriod);
  formatDisplayedPeriods($('insightSummary'));
  const groups = [
    ['prodGrouped', renderProductieGrouped],
    ['vervalGrouped', renderVervalGrouped],
    ['transGrouped', renderTransformatieGrouped],
    ['portefeuilleCharts', renderPortefeuille]
  ];
  for (const [id, render] of groups) {
    const container = $(id);
    const expansion = [...container.querySelectorAll(':scope > .cat')].map(block =>
      ['drillOpen', 'manualClosed'].filter(name => block.classList.contains(name))
    );
    render(lastData, dashboardPreviousPeriod, dashboardCurrentPeriod);
    container.querySelectorAll(':scope > .cat').forEach((block, index) => block.classList.add(...(expansion[index] || [])));
    formatDisplayedPeriods(container);
  }
}
function setDrillMode(on) {
  drillMode = !!on;
  document.querySelectorAll('.cat.drillOpen,.portfolioCategoryBlock.drillOpen,.cat.manualClosed,.portfolioCategoryBlock.manualClosed').forEach(cat => cat.classList.remove('drillOpen','manualClosed'));
  applyDashboardDisplayModes();
}
updateFormatters();

// ─── PDF → CSV conversieparameters (uit ok_CSV.html) ─────────────────────────
const TRANSLATIONS = {
  "Auto": ["Auto"],
  "Auto Vloten": ["Auto Vloten", "Auto Flottes"],
  "Auto Niet Vloten": ["Auto Niet Vloten", "Auto Non Flottes"],
  "Particulieren": ["Particulieren", "Particuliers"],
  "Particulieren Brand": ["Particulieren Brand", "Particuliers Incendie"],
  "Particulieren BA": ["Particulieren BA", "Particuliers BA", "Particuliers RC"],
  "Particulieren Overige": ["Particulieren Overige", "Particuliers Overige", "Particuliers Autres"],
  "Ondernemingen": ["Ondernemingen", "Entreprises"],
  "Ondernemingen Brand": ["Ondernemingen Brand", "Entreprises Incendie"],
  "Ondernemingen BA": ["Ondernemingen BA", "Entreprises BA", "Entreprises RC"],
  "Ondernemingen Overige": ["Ondernemingen Overige", "Entreprises Overige", "Entreprises Autres"],
  "Arbeidsongevallen": ["Arbeidsongevallen", "Accidents de Travail"],
  "Rechtsbijstand": ["Rechtsbijstand Stand Alone", "Rechtsbijstand", "Protection Juridique Stand Alone", "Protection Juridique"],
  "TOTAAL NON LIFE": ["TOTAAL NON LIFE", "TOTAL NON VIE"],
  "Tweede Pijler": ["Tweede Pijler", "Deuxième Pilier"],
  "IPT": ["IPT", "EIP"],
  "VAPZ": ["VAPZ", "PLCI"],
  "POZ": ["POZ", "CPTI"],
  "RIZIV": ["RIZIV", "PLCI INAMI"],
  "Derde Pijler": ["Derde Pijler", "Troisième Pilier"],
  "Pensioensparen": ["Pensioensparen", "Epargne-Pension", "Epargne Pension"],
  "Langetermijnsparen": ["Langetermijnsparen", "Epargne Long Terme"],
  "Vierde Pijler": ["Vierde Pijler", "Quatrième Pilier"],
  "Jeugdplan": ["Jeugdplan", "Plan Jeunesse"],
  "Overige Particulieren Niet-Fiscaal": ["Overige Particulieren Niet-Fiscaal", "Autres Particuliers Non-Fiscal"],
  "Beleggingsproducten Niet-Fiscaal": ["Beleggingsproducten Niet-Fiscaal", "Produits d'Investissement Non-Fiscal"],
  "Verzekeringsbon": ["Verzekeringsbon", "Bon d'Assurance"],
  "TOTAAL LEVEN": ["TOTAAL LEVEN", "TOTAL VIE"]
};

const SUBCATEGORY_PARENT = {
  "Auto Vloten": "Auto",
  "Auto Niet Vloten": "Auto",
  "Particulieren Brand": "Particulieren",
  "Particulieren BA": "Particulieren",
  "Particulieren Overige": "Particulieren",
  "Ondernemingen Brand": "Ondernemingen",
  "Ondernemingen BA": "Ondernemingen",
  "Ondernemingen Overige": "Ondernemingen",
  "IPT": "Tweede Pijler",
  "VAPZ": "Tweede Pijler",
  "POZ": "Tweede Pijler",
  "RIZIV": "Tweede Pijler",
  "Pensioensparen": "Derde Pijler",
  "Langetermijnsparen": "Derde Pijler",
  "Jeugdplan": "Vierde Pijler",
  "Overige Particulieren Niet-Fiscaal": "Vierde Pijler",
  "Beleggingsproducten Niet-Fiscaal": "Vierde Pijler",
  "Verzekeringsbon": "Vierde Pijler"
};

const GENERIC_FR_SUBCATEGORY = {
  "incendie": "Brand",
  "rc": "BA",
  "autres": "Overige"
};

function normText(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
}

function getCategoryMatch(rowText, currentCategory) {
  const normalized = normText(rowText);
  const matches = [];

  for (const [canonical, aliases] of Object.entries(TRANSLATIONS)) {
    for (const alias of aliases) {
      const a = normText(alias);
      if (normalized === a || normalized.startsWith(a + ' ')) {
        matches.push({ canonical, alias });
      }
    }
  }

  const generic = normalized.match(/^(incendie|rc|autres)(?:\b|\s)/i);
  if (generic && (currentCategory === 'Ondernemingen' || currentCategory === 'Particulieren')) {
    const sub = GENERIC_FR_SUBCATEGORY[generic[1].toLowerCase()];
    matches.push({ canonical: currentCategory + ' ' + sub, alias: generic[1] });
  }

  if (!matches.length) return null;
  matches.sort((a, b) => b.alias.length - a.alias.length);
  const canonical = matches[0].canonical;
  return { hoofd: SUBCATEGORY_PARENT[canonical] || canonical, sub: canonical };
}

function exportActionsHtml(options = {}) {
  const classes = ['blockExportActions', options.classes || ''].filter(Boolean).join(' ');
  const target = options.target ? ` data-export-target="${esc(options.target)}"` : '';
  const label = options.label || 'Blok exporteren';
  return `<div class="${classes}"${target} aria-label="${esc(label)}">${exportActionButtonsHtml(options.downloadTitle, options.copyTitle)}</div>`;
}
function exportActionButtonsHtml(downloadTitle = msg('imageDownload'), copyTitle = msg('imageCopy')) {
  const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const downloadIcon = icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M12 3v12m-5-5 5 5 5-5"/>');
  const copyIcon = icon('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>');
  return `<button type="button" class="blockExportBtn blockExportDownload" aria-label="${esc(downloadTitle)}" title="${esc(downloadTitle)}">${downloadIcon}</button><button type="button" class="blockExportBtn blockExportCopy" aria-label="${esc(copyTitle)}" title="${esc(copyTitle)}">${copyIcon}</button>`;
}
function productBlockExportActionsHtml() {
  return exportActionsHtml();
}
function safeFilePart(v) {
  return String(v || 'blok').replace(/<[^>]*>/g, '').replace(/[^a-z0-9_\-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'blok';
}
async function renderBlockToCanvas(block) {
  if (!window.html2canvas) throw new Error('html2canvas niet beschikbaar');
  block.classList.add('exportingBlock');
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    return await html2canvas(block, { backgroundColor: '#ffffff', scale: 2, useCORS: true, allowTaint: true, logging: false });
  } finally {
    block.classList.remove('exportingBlock');
  }
}
function resolveBlockExportTarget(button) {
  const actions = button.closest('.blockExportActions');
  const target = actions?.dataset?.exportTarget || '';
  if (target === 'topKpis') return {block:$('lifeKpiBlock'), title:'KPI'};
  const allTargets = {
    productieAll: { id: 'productie', blockId: 'prodGrouped', titleId: 'prodTitle', fallback: 'Productie' },
    vervalAll: { id: 'verval', blockId: 'vervalGrouped', titleId: 'vervalTitle', fallback: 'Verval' },
    transformatieAll: { id: 'transformatie', blockId: 'transGrouped', titleId: 'transTitle', fallback: 'Verhogingen' },
    progressieAll: { id: 'progressie', blockId: 'progGrouped', titleId: 'progTitle', fallback: 'Progressie' },
    schadeAll: { id: 'schade', blockId: 'schadeGrouped', titleId: 'schadeTitle', fallback: 'Schade' },
    portefeuilleAll: { id: 'portefeuille', blockId: 'portefeuilleCharts', titleId: 'portefeuilleTitle', fallback: 'Portefeuille' },
    detailAll: { id: 'detail', blockId: 'categoryDetails', titleId: 'detailTitle', fallback: 'Detail' },
    summaryAll: { id: 'samenvatting', blockId: 'insightSummaryExport', titleId: 'tabSamenvatting', fallback: 'Samenvatting' },
    detailProductie: { id: 'detail', blockId: 'detailProductieBlock', titleId: null, fallback: 'Detail Productie' },
    detailSchade: { id: 'detail', blockId: 'detailSchadeBlock', titleId: null, fallback: 'Detail Schade' }
  };
  if (allTargets[target]) {
    const cfg = allTargets[target];
    const block = $(cfg.blockId);
    return { block, title: $(cfg.titleId)?.innerText || cfg.fallback, before: () => {
      const section = $(cfg.id);
      if (!section) return () => {};
      section.classList.add('forceExportOpen');
      return () => section.classList.remove('forceExportOpen');
    }};
  }
  if (target === 'productionPie') {
    const block = $('productionPieCard');
    return { block, title: $('productionPieTitle')?.innerText || 'Verdeling' };
  }
  if (target === 'portfolioPie') {
    const block = $('portfolioPieCard');
    return { block, title: $('portfolioPieTitle')?.innerText || 'Verdeling verdiende premie' };
  }
  const block = button.closest('.cat') || button.closest('.portfolioCategoryBlock') || button.closest('.insightItem') || button.closest('.portfolioPieCard');
  return { block, title: block?.querySelector('.catTitle,h3,h2')?.innerText || 'dashboard_blok' };
}
async function exportBlockAsImage(button, mode) {
  const targetInfo = resolveBlockExportTarget(button);
  const block = targetInfo.block;
  if (!block) return;
  const cleanup = targetInfo.before ? targetInfo.before() : null;
  try {
    const canvas = await renderBlockToCanvas(block);
    const filename = `dashboard_${safeFilePart(targetInfo.title)}.png`;
    if (mode === 'copy') {
      if (!navigator.clipboard || !window.ClipboardItem) {
        alert('Kopiëren naar klembord wordt door deze browser niet ondersteund. Gebruik download.');
        return;
      }
      canvas.toBlob(async blob => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch (err) {
          alert('Kopiëren naar klembord is niet gelukt. Gebruik download.');
        }
      }, 'image/png');
      return;
    }
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    if (typeof cleanup === 'function') cleanup();
  }
}

// ─── Initialisatie na laden DOM ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const sel = $('languageSelect');
  if (sel) sel.addEventListener('change', e => setLanguage(e.target.value));
  document.querySelectorAll('#viewModeControls .viewBtn').forEach(btn => btn.addEventListener('click', () => setViewMode(btn.dataset.view)));
  $('previousYearsToggle').addEventListener('change', e => setPreviousYearsMode(e.target.checked));
  const drillBtn = $('drillToggleBtn');
  if (drillBtn) drillBtn.addEventListener('click', () => {
    if (!drillMode && hasManualClosedCategories()) {
      document.querySelectorAll('.cat.manualClosed,.portfolioCategoryBlock.manualClosed').forEach(cat => cat.classList.remove('manualClosed'));
      applyDashboardDisplayModes();
      return;
    }
    setDrillMode(!drillMode);
  });
  updateStaticLanguage();
  applyDashboardDisplayModes();
  $('dashboard')?.addEventListener('click', e => {
    const exportBtn = e.target.closest('.blockExportBtn');
    if (exportBtn) {
      e.preventDefault();
      e.stopPropagation();
      exportBlockAsImage(exportBtn, exportBtn.classList.contains('blockExportCopy') ? 'copy' : 'download');
      return;
    }
    const portfolioHead = e.target.closest('.portfolioCategoryHead');
    if (portfolioHead) {
      const block = portfolioHead.closest('.portfolioCategoryBlock');
      const section = block?.closest('.section');
      if (block && section?.id === 'portefeuille' && !block.classList.contains('portfolioTotalBlock')) {
        toggleDashboardBlockVisibility(block, '.portfolioGrid');
      }
      return;
    }

    const head = e.target.closest('.catHead');
    if (!head) return;
    const cat = head.closest('.cat');
    if (!cat || cat.classList.contains('totalNonLife')) return;
    const section = cat.closest('.section');
    if (!section || !['productie','verval','transformatie','progressie','portefeuille','detail'].includes(section.id)) return;
    toggleDashboardBlockVisibility(cat, '.p-18');
  });
  $('kpis')?.addEventListener('click', e => {
    const card = e.target.closest('.kpi[data-kpi-cat]');
    if (!card) return;
    jumpToKpiCategory(card.dataset.kpiCat);
  });
  $('kpis')?.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.kpi[data-kpi-cat]');
    if (!card) return;
    e.preventDefault();
    jumpToKpiCategory(card.dataset.kpiCat);
  });
});

function importControlChecks(data, currP) {
  if (!data) return { periods: [], latest: '-', issues: 0 };
  const periods = [...new Set(data.map(r => String(r[cols.periode] || '').trim()).filter(Boolean))].sort((a,b) => pkey(a) - pkey(b));
  const latest = currP || periods[periods.length - 1] || '-';
  const prodTotalRow = totalRow(data, 'PRODUCTIE', latest) || {};
  const hasProdTotal = !!prodTotalRow[cols.hoofd];
  const brokerOk = !!(brokerInfo.number || brokerInfo.name);
  const issueFlags = [periods.length > 0, latest !== '-', hasProdTotal, brokerOk];
  return { periods, latest, issues: issueFlags.filter(Boolean).length === issueFlags.length ? 0 : issueFlags.filter(v => !v).length };
}

function placeLanguageSwitch() {
  const lang = document.querySelector('.languageSwitch');
  const actions = document.querySelector('#topCompactBar .topCompactActions');
  const wrap = document.querySelector('.wrap');
  const barVisible = document.body.classList.contains('topInfoReady') && actions;
  if (!lang || !wrap) return;
  if (barVisible) {
    if (lang.parentElement !== actions) actions.appendChild(lang);
  } else if (lang.parentElement !== wrap) {
    wrap.insertBefore(lang, wrap.firstElementChild);
  }
}

function renderTopCompactBar() {
  const bar = $('topCompactBar');
  const summary = $('topCompactSummary');
  if (!bar || !summary) return;
  if (!lastData || (!dashboardCurrentPeriod && currentDashboardType !== 'adviesvergoeding')) {
    bar.classList.add('hidden');
    document.body.classList.remove('topInfoReady','topInfoCollapsed');
    placeLanguageSwitch();
    return;
  }
  if (currentDashboardType === 'adviesvergoeding') {
    const fileName = ($('fileName')?.textContent || '').trim();
    const filePart = fileName && !/geen bestand|aucun fichier/i.test(fileName) ? `PDF: ${esc(fileName)} &middot; ` : '';
    const detailRows = adviceDetailRows(lastData);
    const producerCount = adviceProducerList(lastData).length;
    summary.innerHTML = `${filePart}${num.format(producerCount)} prodnrs &middot; ${num.format(detailRows.length)} detailregels &middot; Adviesvergoeding`;
    bar.classList.remove('hidden');
    document.body.classList.add('topInfoReady');
    document.body.classList.toggle('topInfoCollapsed', !!topInfoCollapsed);
    placeLanguageSwitch();
    updateTopInfoToggleButton();
    return;
  }
  const checks = importControlChecks(lastData, dashboardCurrentPeriod);
  const fileName = ($('fileName')?.textContent || '').trim();
  const filePart = fileName && !/geen bestand|aucun fichier/i.test(fileName) ? `PDF: ${esc(fileName)} · ` : '';
  const statusText = checks.issues ? msg('topAttention', checks.issues) : msg('topOk');
  summary.innerHTML = `${filePart}${checks.periods.length} ${esc(msg('topPeriodsShort'))} · ${esc(msg('topLatestShort'))}: ${esc(fmtPeriod(checks.latest))} · ${esc(statusText)}`;
  bar.classList.remove('hidden');
  document.body.classList.add('topInfoReady');
  document.body.classList.toggle('topInfoCollapsed', !!topInfoCollapsed);
  placeLanguageSwitch();
  updateTopInfoToggleButton();
}

function updateTopInfoToggleButton() {
  const btn = $('topInfoToggleBtn');
  if (!btn) return;
  const title = lastData ? msg('heroUploadButton') : (topInfoCollapsed ? msg('topShow') : msg('topHide'));
  btn.textContent = msg('importPdf');
  btn.title = title;
  btn.setAttribute('aria-label', title);
}

function setTopInfoCollapsed(collapsed) {
  topInfoCollapsed = !!collapsed;
  document.body.classList.toggle('topInfoCollapsed', topInfoCollapsed);
  renderTopCompactBar();
}

function toggleTopInfo() {
  if (lastData) {
    $('pdfFile')?.click();
    return;
  }
  setTopInfoCollapsed(!topInfoCollapsed);
}

function setStatus(msg, warn = false) {
  const s = $('status');
  s.textContent = msg;
  s.className = 'status' + (warn ? ' warn' : '');
}

// ─── PDF verwerking ───────────────────────────────────────────────────────────
$('pdfFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  $('fileName').textContent = file.name;
  $('dashboard').classList.add('hidden');
  $('brokerInfo').classList.add('hidden');
  $('importControl')?.classList.add('hidden');
  $('topCompactBar')?.classList.add('hidden');
  document.body.classList.remove('topInfoReady','topInfoCollapsed');
  topInfoCollapsed = false;
  brokerInfo = { label: "koepelnummer", number: "", name: "" };
  lastData = null;
  currentDashboardType = 'life';
  $('downloadCsvBtn').classList.add('hidden');
  $('exportPdfWrap')?.classList.add('hidden');
  setStatus(msg('processing'));
  try {
    csvResult = await pdfToCsv(file);
    const data = currentDashboardType === 'adviesvergoeding' ? parseAdviceCSV(csvResult) : parseCSV(csvResult);
    lastData = data;
    if (currentDashboardType === 'adviesvergoeding') {
      buildAdviceDashboard(data);
      setTopInfoCollapsed(true);
      setStatus(`✅ Adviesvergoeding geladen: ${data.length} totalen.`);
    } else {
      build(data);
      setStatus(msg('success', data.length));
      setTopInfoCollapsed(true);
    }
    $('downloadCsvBtn').classList.remove('hidden');
    if (currentDashboardType !== 'adviesvergoeding') $('exportPdfWrap')?.classList.remove('hidden');
    // Na import terug naar helemaal bovenaan. De importblokken zijn dan ingeklapt.
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 180);
  } catch (err) {
    console.error(err);
    $('topCompactBar')?.classList.add('hidden');
    $('exportPdfWrap')?.classList.add('hidden');
    document.body.classList.remove('topInfoReady','topInfoCollapsed');
    setStatus(msg('error') + err.message, true);
  }
});

function cleanBrokerName(name) {
  return String(name || '')
    .replace(/\bCDR\b.*$/i, '')
    .replace(/\b(Kerncijfers\s+NON\s+LIFE|Gegevens\s+ultimo\s*:?|Données\s+ultimo\s*:?|Nombre\s+Affaires|Aantal\s+Zaken|Productie|Premie|Verval|Progressie|Transformatie|Bedragen\s+in\s+euro)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatPersonNameFromPdf(name) {
  let raw = String(name || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  // CDR/AM-overzichten staan vaak volledig in kapitalen. Maak dit leesbaarder,
  // maar behoud kleine tussenvoegsels zoals "van", "der", "de".
  if (raw === raw.toUpperCase()) {
    const lowercaseParts = new Set(['VAN','VON','DER','DE','DEN','DI','DA','DEL','DU','LE','LA','DES']);
    raw = raw.split(' ').map((part, idx) => {
      if (idx > 0 && lowercaseParts.has(part)) return part.toLowerCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
  }
  return raw;
}

function extractTotalRoleInfoFromRows(texts) {
  // Fallback voor CDR/AM-rapporten zonder makelaar/groeps- of koepelnummer.
  // Bovenaan staat bv. "Totaal AM" of "Total CDR"; de naam staat op de volgende regel.
  const skipName = /^(Kerncijfers|Gegevens|Données|Aantal|Nombre|Productie|Premie|Verval|Progressie|Transformatie|Portefeuille|Verdiende|Uitgegeven|Auto|Particulieren|Ondernemingen|TOTAAL\s+NON\s+LIFE|Bedragen)/i;
  for (let i = 0; i < texts.length; i++) {
    const rowText = texts[i];
    const roleMatch = rowText.match(/\b(?:Totaal|Total)\s+(CDR|AM)\b/i) || rowText.match(/\b(CDR|AM)\s+(?:Totaal|Total)\b/i);
    if (!roleMatch) continue;
    const role = (roleMatch[1] || '').toUpperCase();
    for (let j = i + 1; j < Math.min(texts.length, i + 5); j++) {
      let name = cleanBrokerName(texts[j])
        .replace(/\b(?:Totaal|Total)\s+(?:CDR|AM)\b/ig, '')
        .replace(/\b(?:CDR|AM)\s+(?:Totaal|Total)\b/ig, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!name || skipName.test(name) || /\d{2}\s+20\d{2}/.test(name)) continue;
      name = formatPersonNameFromPdf(name);
      return { label: 'functionName', number: '', name: `${role}/${name}` };
    }
  }
  return { label: '', number: '', name: '' };
}

function extractBrokerInfoFromRows(pageRows) {
  if ((brokerInfo.number && brokerInfo.name) || (brokerInfo.label === 'functionName' && brokerInfo.name)) return;

  const sortedRows = pageRows.slice().sort((a, b) => b.y - a.y).slice(0, 22);
  const texts = sortedRows
    .map(row => row.items.slice().sort((a, b) => a.x - b.x).map(i => i.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const topText = texts.join(' ').replace(/\s+/g, ' ').trim();
  const labelRegex = /(?:\b(Koepelnummer|Groepsnummer)\s*:?|N\s*[°º]\s*(Coupole|Groupe)\s*:?)/i;
  const labelMatch = topText.match(labelRegex);
  const rawLabel = labelMatch ? (labelMatch[1] || labelMatch[2] || '').toLowerCase() : '';
  const label = rawLabel === 'groepsnummer' || rawLabel === 'groupe' ? 'groepsnummer'
    : rawLabel === 'koepelnummer' || rawLabel === 'coupole' ? 'koepelnummer'
    : '';

  if (!labelMatch || !label) {
    const roleInfo = extractTotalRoleInfoFromRows(texts);
    brokerInfo = roleInfo.name ? roleInfo : { label: '', number: '', name: '' };
    return;
  }

  function tryCandidate(text) {
    let t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return false;

    t = t.replace(/(?:\b(?:Koepelnummer|Groepsnummer)\s*:?|N\s*[°º]\s*(?:Coupole|Groupe)\s*:?)/ig, ' ').replace(/\s+/g, ' ').trim();

    const match = t.match(/\b([A-Z]{1,8}\d{2,}|\d{3,})\s+(.+)$/i);
    if (!match) return false;

    const number = match[1].trim();
    let name = cleanBrokerName(match[2])
      .replace(/\s+(?:12\s+20\d{2}|0[1-9]\s+20\d{2}|1[0-2]\s+20\d{2})\b.*$/i, '')
      .replace(/\s+\d{1,3}(?:[\.,]\d{3})*\b.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (number && name && !/^(Kerncijfers|Gegevens|Aantal|Productie|Premie|Verval|Progressie|Transformatie)$/i.test(name)) {
      brokerInfo = { label, number, name };
      return true;
    }
    return false;
  }

  for (const rowText of texts) {
    if (tryCandidate(rowText)) return;
  }

  const afterLabel = labelMatch ? topText.slice(labelMatch.index + labelMatch[0].length) : topText;
  if (!tryCandidate(afterLabel)) {
    brokerInfo = { label: '', number: '', name: '' };
  }
}

function renderBrokerInfo() {
  if (brokerInfo.number || brokerInfo.name) {
    if (brokerInfo.label === 'functionName') {
      $('brokerInfoLabel').textContent = currentLang === 'fr' ? 'Fonction / nom' : 'Functie / naam';
    } else if (brokerInfo.label === 'koepelnummer') {
      $('brokerInfoLabel').textContent = currentLang === 'fr' ? 'Coupole / n° coupole' : 'Koepel / koepelnummer';
    } else if (brokerInfo.label === 'groepsnummer') {
      $('brokerInfoLabel').textContent = `${msg('broker')} / ${msg('groepsnummer')}`;
    } else {
      $('brokerInfoLabel').textContent = '';
    }
    const displayName = brokerInfo.number
      ? `${brokerInfo.name || ''} (${brokerInfo.number})`.trim()
      : (brokerInfo.name || '');
    $('brokerName').textContent = displayName;
    $('brokerInfo').classList.remove('hidden');
  } else {
    $('brokerInfoLabel').textContent = msg('heroEyebrow');
    $('brokerName').textContent = '';
    $('brokerInfo').classList.remove('hidden');
  }
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function normalizePdfNumber(value) {
  return String(value ?? '').trim().replace(/\./g, '').replace(/,/g, '.').replace('%', '');
}

function nearestPdfCell(items, targetX, tolerance = 24) {
  let best = null;
  items.forEach(item => {
    const distance = Math.abs(item.x - targetX);
    if (distance <= tolerance && (!best || distance < best.distance)) best = { distance, text: item.text };
  });
  return best ? normalizePdfNumber(best.text) : '';
}

function lifeCategoryMatch(rowText) {
  const match = getCategoryMatch(rowText, '');
  if (!match) return null;
  const allowed = new Set([
    'Tweede Pijler','IPT','VAPZ','POZ','RIZIV',
    'Derde Pijler','Pensioensparen','Langetermijnsparen',
    'Vierde Pijler','Jeugdplan','Overige Particulieren Niet-Fiscaal',
    'Beleggingsproducten Niet-Fiscaal','Verzekeringsbon','TOTAAL LEVEN'
  ]);
  return allowed.has(match.sub) ? match : null;
}

async function pdfToLifeCsvFromDocument(pdf) {
  const header = [
    cols.type, cols.hoofd, cols.sub, cols.periode,
    cols.prodAantal, cols.prodPremie, cols.premieKoopsom,
    cols.vervalAantal, cols.vervalPremie, cols.vervalOnnatuurlijk, cols.vervalNatuurlijk,
    cols.trans, cols.premieVerhoging, cols.premieVerlaging, cols.progAantal, cols.progPremie,
    cols.polissenPortefeuille, cols.polissenPremiebetalend, cols.polissenPremievrij,
    cols.portefeuillepremie, cols.uitgegeven, cols.reserves,
    cols.portefeuille
  ];
  const csvRows = [header.map(csvCell).join(',')];
  const productionBins = [96, 128, 176, 224, 258, 300, 344, 388, 429, 472, 524, 556];
  const portfolioBins = [133, 228, 302, 359, 429, 500];
  let currentCategory = '';
  let currentSubCategory = '';

  for (let p = 1; p <= pdf.numPages; p++) {
    currentCategory = '';
    currentSubCategory = '';
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const pageRows = [];

    textContent.items.forEach(item => {
      const text = String(item.str || '').trim();
      if (!text) return;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const foundRow = pageRows.find(r => Math.abs(r.y - y) < 4);
      if (foundRow) foundRow.items.push({ x, text });
      else pageRows.push({ y, items: [{ x, text }] });
    });

    extractBrokerInfoFromRows(pageRows);

    pageRows.sort((a, b) => b.y - a.y);
    for (let rowIndex = 0; rowIndex < pageRows.length; rowIndex++) {
      const row = pageRows[rowIndex];
      row.items.sort((a, b) => a.x - b.x);
      const rowText = row.items.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
      const matchedCategory = lifeCategoryMatch(rowText);
      if (matchedCategory && !/(0[1-9]|1[0-2])[- ](20\d{2})/.test(rowText)) {
        currentCategory = matchedCategory.hoofd;
        currentSubCategory = matchedCategory.sub;
        continue;
      }

      const dateMatch = rowText.match(/\b(0[1-9]|1[0-2])[- ](20\d{2})\b/);
      if (!dateMatch || !currentCategory) continue;

      let valueItems = row.items.slice();
      let values = (p === 1 ? productionBins : portfolioBins).map(x => nearestPdfCell(valueItems, x));
      if (p === 2 && values.every(v => !n(v))) {
        for (let lookAhead = 1; lookAhead <= 2; lookAhead++) {
          const nextRow = pageRows[rowIndex + lookAhead];
          if (!nextRow) break;
          nextRow.items.sort((a, b) => a.x - b.x);
          const nextText = nextRow.items.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
          const nextIsDate = /^(0[1-9]|1[0-2])[- ]20\d{2}\b/.test(nextText);
          const nextIsCategory = !!lifeCategoryMatch(nextText);
          if (nextIsDate || nextIsCategory) break;
          const merged = valueItems.concat(nextRow.items);
          const mergedValues = portfolioBins.map(x => nearestPdfCell(merged, x));
          if (mergedValues.some(v => n(v))) {
            valueItems = merged;
            values = mergedValues;
            break;
          }
        }
      }
      const out = Object.fromEntries(header.map(h => [h, '']));
      out[cols.type] = p === 1 ? 'PRODUCTIE' : 'PORTEFEUILLE';
      out[cols.hoofd] = currentCategory;
      out[cols.sub] = currentSubCategory;
      out[cols.periode] = `${dateMatch[1]} ${dateMatch[2]}`;

      if (p === 1) {
        [
          cols.prodAantal, cols.prodPremie, cols.premieKoopsom,
          cols.vervalAantal, cols.vervalPremie, cols.vervalOnnatuurlijk, cols.vervalNatuurlijk,
          cols.trans, cols.premieVerhoging, cols.premieVerlaging, cols.progAantal, cols.progPremie
        ].forEach((col, idx) => out[col] = values[idx] || '0');
      } else {
        [
          cols.polissenPortefeuille, cols.polissenPremiebetalend, cols.polissenPremievrij,
          cols.portefeuillepremie, cols.uitgegeven, cols.reserves
        ].forEach((col, idx) => out[col] = values[idx] || '0');
        out[cols.portefeuille] = out[cols.portefeuillepremie];
      }

      csvRows.push(header.map(h => csvCell(out[h])).join(','));
    }
  }

  if (csvRows.length < 2) throw new Error('geen life-rijen gevonden in de PDF');
  return csvRows.join('\n');
}

function adviceAmountItems(items) {
  return items
    .filter(([x, t]) => x >= 330 && /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/.test(t))
    .map(([x, t]) => ({ x, text: t }));
}
function adviceMoneyTokens(text) {
  return String(text || '').match(/-?\d{1,3}(?:\.\d{3})*,\d{2}/g) || [];
}
function adviceDeathCapitalToken(text) {
  const s = String(text || '');
  const exact = s.match(/(\d{1,3}(?:\.\d{3})+|\d{4,7})\s+\d{1,3},\d\s*(?:VH|NZ|NK|KP)/i);
  if (exact) return exact[1];
  const candidates = s.match(/\b\d{1,3}(?:\.\d{3})+\b|\b\d{4,7}\b/g) || [];
  return candidates.find(token => {
    const digits = token.replace(/\D/g, '');
    const value = n(token);
    return digits.length >= 4 && digits.length <= 7 && value >= 1000 && value <= 10000000;
  }) || '';
}

function adviceSubcategoryFromText(text) {
  const t = String(text || '').trim();
  if (/^(IPT|VAPZ|RIZIV|POZ)\b/i.test(t)) return t.match(/^(IPT|VAPZ|RIZIV|POZ)\b/i)[1].toUpperCase();
  if (/^Pensioensparen\b/i.test(t)) return 'Pensioensparen';
  if (/^(Lange\s*termijnsparen|Langetermijnsparen)\b/i.test(t)) return 'Langetermijnsparen';
  if (/^Overige Particulieren Niet[-\s]?Fiscaal\b/i.test(t)) return 'Overige Particulieren Niet Fiscaal';
  return '';
}
function adviceDetailFromText(text, adviceType = 'Sparen') {
  const typeMatch = String(text || '').match(/\b(VH|NZ|NK|KP)\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})?/);
  const type = typeMatch ? typeMatch[1] : '';
  const money = adviceMoneyTokens(text);
  if (!type || money.length < 3 || /^Totaal\b/i.test(text)) return null;
  const isDeath = String(adviceType || '').toLowerCase() === 'overlijden';
  return {
    type,
    adviesbasisOngewogen: money[0],
    adviesbasisGewogen: typeMatch && typeMatch[2] ? typeMatch[2] : money[1],
    kapitaalOverlijden: isDeath ? adviceDeathCapitalToken(text) : '',
    adviesvergoeding: money[money.length - 1]
  };
}

function advicePijlerFromLabel(label, currentPijler) {
  if (/Tweede Pijler/i.test(label)) return 'Tweede Pijler';
  if (/Derde Pijler/i.test(label)) return 'Derde Pijler';
  if (/Vierde Pijler/i.test(label)) return 'Vierde Pijler';
  if (/\b(IPT|VAPZ|RIZIV|POZ)\b/i.test(label)) return 'Tweede Pijler';
  if (/Pensioensparen|Lange\s*termijnsparen|Langetermijnsparen/i.test(label)) return 'Derde Pijler';
  if (/Overige Particulieren Niet[-\s]?Fiscaal/i.test(label)) return 'Vierde Pijler';
  if (/Tijdelijke en schuldsaldoverzekeringen/i.test(label)) return 'Tijdelijke en schuldsaldoverzekeringen';
  if (/OVERLIJDEN/i.test(label)) return currentPijler || 'Tijdelijke en schuldsaldoverzekeringen';
  return currentPijler || '';
}

function adviceNiveauFromLabel(label) {
  if (/Groepsnr|Koepelnummer|Koepelnr/i.test(label)) return 'Groep';
  if (/Prodnr/i.test(label)) return 'Prodnr';
  if (/Tweede Pijler|Derde Pijler|Vierde Pijler|Tijdelijke en schuldsaldoverzekeringen/i.test(label)) return 'Pijler';
  return 'Subcategorie';
}

async function pdfToAdviceCsvFromDocument(pdf, adviceType = 'Sparen') {
  const header = ['DocumentType','AdviesType','GroepsType','Groepsnummer','Naam','TypePartner','AMNonLife','AMLife','EBS','CDR','Prodnr','ProducentNaam','Pijler','Subcategorie','Niveau','Type','Aantal','AdviesbasisOngewogen','AdviesbasisGewogen','KapitaalOverlijden','Adviesvergoeding'];
  const csvRows = [header.map(csvCell).join(',')];
  const meta = { groepsType:'', groepsnummer:'', naam:'', typePartner:'', amNonLife:'', amLife:'', ebs:'', cdr:'' };
  let currentProd = '';
  let currentProdName = '';
  let currentPijler = '';
  let currentSubcategorie = '';

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const pageRows = [];
    textContent.items.forEach(item => {
      const text = String(item.str || '').trim();
      if (!text) return;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const found = pageRows.find(r => Math.abs(r.y - y) < 8);
      if (found) found.items.push([x, text]);
      else pageRows.push({ y, items: [[x, text]] });
    });
    pageRows.forEach(row => {
      row.items.sort((a, b) => a[0] - b[0]);
      row.text = row.items.map(x => x[1]).join(' ').replace(/\s+/g, ' ').trim();
    });
    pageRows.sort((a, b) => b.y - a.y);

    if (p === 1) {
      pageRows.forEach(row => {
        const items = row.items;
        const text = row.text;
        const valueAfter = label => {
          const idx = items.findIndex(x => x[1] === label);
          return idx >= 0 && items[idx + 1] ? items[idx + 1][1] : '';
        };
        if (/Groepsnummer:|Koepelnummer:/i.test(text)) {
          const label = items.find(x => /Groepsnummer:|Koepelnummer:/i.test(x[1]));
          if (label) meta.groepsType = label[1].replace(':', '');
          meta.groepsnummer = items.find(x => x[0] > 70 && x[0] < 150)?.[1] || '';
          meta.naam = items.filter(x => x[0] >= 150 && x[0] < 360).map(x => x[1]).join(' ');
          meta.amNonLife = valueAfter('AM Non-Life:');
        }
        if (/AM Life:/i.test(text)) meta.amLife = valueAfter('AM Life:');
        if (/Type partner:/i.test(text)) {
          meta.typePartner = valueAfter('Type partner:');
          meta.ebs = valueAfter('EBS:');
        }
        if (/CDR:/i.test(text)) meta.cdr = valueAfter('CDR:');
      });
    }

    for (const row of pageRows) {
      const items = row.items;
      const text = row.text;
      const isProdHeader = /\bProdnr\./i.test(text) && !/^Totaal\b/i.test(text);
      if (isProdHeader) {
        const prod = items.find(x => /^\d+$/.test(x[1])) || (text.match(/(\d+)\s*Prodnr\./i) ? [0, text.match(/(\d+)\s*Prodnr\./i)[1]] : null);
        currentProd = prod ? prod[1] : '';
        currentProdName = text.replace(/^\s*\d+\s*Prodnr\.\s*/i, '').replace(/\bProdnr\.\b/i, '').trim() || items.filter(x => x[0] > 130 && !/^\d+$/.test(x[1]) && !/Prodnr\./i.test(x[1])).map(x => x[1]).join(' ');
        currentPijler = '';
        currentSubcategorie = '';
        continue;
      }
      if (!/^Totaal\b/i.test(text)) {
        if (/Tweede Pijler/i.test(text)) { currentPijler = 'Tweede Pijler'; currentSubcategorie = ''; }
        else if (/Derde Pijler/i.test(text)) { currentPijler = 'Derde Pijler'; currentSubcategorie = ''; }
        else if (/Vierde Pijler/i.test(text)) { currentPijler = 'Vierde Pijler'; currentSubcategorie = ''; }
        const subInText = adviceSubcategoryFromText(text);
        if (subInText) {
          currentSubcategorie = subInText;
          currentPijler = advicePijlerFromLabel(subInText, currentPijler);
        } else if (/Tijdelijke en schuldsaldoverzekeringen/i.test(text)) {
          currentPijler = 'Tijdelijke en schuldsaldoverzekeringen';
          currentSubcategorie = text;
        }
        const detail = adviceDetailFromText(text, adviceType);
        if (detail && currentProd && currentPijler && currentSubcategorie) {
          const out = {
            DocumentType:`ADVIESVERGOEDING ${adviceType.toUpperCase()}`,
            AdviesType:adviceType,
            GroepsType:meta.groepsType,
            Groepsnummer:meta.groepsnummer,
            Naam:meta.naam,
            TypePartner:meta.typePartner,
            AMNonLife:meta.amNonLife,
            AMLife:meta.amLife,
            EBS:meta.ebs,
            CDR:meta.cdr,
            Prodnr:currentProd,
            ProducentNaam:currentProdName,
            Pijler:currentPijler,
            Subcategorie:currentSubcategorie,
            Niveau:'Detail',
            Type:detail.type,
            Aantal:'1',
            AdviesbasisOngewogen:detail.adviesbasisOngewogen,
            AdviesbasisGewogen:detail.adviesbasisGewogen,
            KapitaalOverlijden:detail.kapitaalOverlijden,
            Adviesvergoeding:detail.adviesvergoeding
          };
          csvRows.push(header.map(h => csvCell(out[h])).join(','));
          continue;
        }
        continue;
      }
      const amountItems = adviceAmountItems(items);
      if (amountItems.length < 2) continue;
      const labelParts = items
        .filter(([x, t]) => x < 330 && !/^Totaal$/i.test(t) && !/^RE?\d+$/i.test(t) && !/^\d+$/.test(t))
        .map(([x, t]) => t);
      const label = labelParts.join(' ').replace(/\s+/g, ' ').trim();
      const niveau = adviceNiveauFromLabel(label);
      const rowProd = niveau === 'Groep' ? '' : (items.find(x => x[1] === 'Prodnr.') ? (items.find(x => /^\d+$/.test(x[1]))?.[1] || currentProd) : currentProd);
      const out = {
        DocumentType:`ADVIESVERGOEDING ${adviceType.toUpperCase()}`,
        AdviesType:adviceType,
        GroepsType:meta.groepsType,
        Groepsnummer:meta.groepsnummer,
        Naam:meta.naam,
        TypePartner:meta.typePartner,
        AMNonLife:meta.amNonLife,
        AMLife:meta.amLife,
        EBS:meta.ebs,
        CDR:meta.cdr,
        Prodnr:rowProd,
        ProducentNaam:niveau === 'Groep' ? '' : currentProdName,
        Pijler:advicePijlerFromLabel(label, currentPijler),
        Subcategorie:niveau === 'Prodnr' ? 'Totaal prodnr' : (niveau === 'Groep' ? label : label.replace(/^Totaal\s+/i, '')),
        Niveau:niveau,
        Type:'',
        Aantal:'',
        AdviesbasisOngewogen:'',
        AdviesbasisGewogen:amountItems[0].text,
        KapitaalOverlijden:String(adviceType || '').toLowerCase() === 'overlijden' && amountItems.length >= 3 ? amountItems[amountItems.length - 2].text : '',
        Adviesvergoeding:String(adviceType || '').toLowerCase() === 'overlijden' ? amountItems[amountItems.length - 1].text : amountItems[1].text
      };
      csvRows.push(header.map(h => csvCell(out[h])).join(','));
    }
  }
  if (csvRows.length < 2) throw new Error('geen adviesvergoeding-totalen gevonden in de PDF');
  return csvRows.join('\n');
}

function isLifePdfTitle(text) {
  return /\b(?:kerncijfers\s+leven|chiffres\s+clef?s\s+vie)\b/.test(normText(text));
}

async function pdfToCsv(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(new Uint8Array(buffer)).promise;
  const firstPage = await pdf.getPage(1);
  const firstText = (await firstPage.getTextContent()).items.map(i => i.str || '').join(' ');
  const adviceMatch = firstText.match(/Opvolging\s+Adviesvergoeding\s+(Sparen|Overlijden)/i);
  if (adviceMatch) {
    currentDashboardType = 'adviesvergoeding';
    return pdfToAdviceCsvFromDocument(pdf, adviceMatch[1].toLowerCase() === 'overlijden' ? 'Overlijden' : 'Sparen');
  }
  if (!isLifePdfTitle(firstText)) throw new Error('Dit dashboard verwacht een kerncijfers life PDF (NL of FR) of een opvolging adviesvergoeding sparen PDF.');
  currentDashboardType = 'life';
  return pdfToLifeCsvFromDocument(pdf);
}

// ─── CSV download ─────────────────────────────────────────────────────────────
$('downloadCsvBtn').addEventListener('click', () => {
  const blob = new Blob(["\uFEFF" + csvResult], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Analyse_Kerncijfers.csv";
  a.click();
});

// ─── Life-afdruk: geselecteerde blokken op staande A4-pagina’s ──────────────
function cloneForPdf(id) {
  const el = $(id);
  return el ? el.cloneNode(true) : null;
}

function makeSafeFilePart(text) {
  return String(text || 'dashboard')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'dashboard';
}

function buildPdfHeader() {
  const header = document.createElement('div');
  header.className = 'pdfExportHeader';

  const broker = cloneForPdf('brokerInfo');
  if (broker && !broker.classList.contains('hidden')) {
    broker.classList.remove('hidden');
    header.appendChild(broker);
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'brokerInfo';
    fallback.innerHTML = `<div><div class="label">Kerncijfers Life</div><div class="brokerName">Dashboard</div></div>`;
    header.appendChild(fallback);
  }
  return header;
}

function addPdfTestPageNumbers(root) {
  const pages = Array.from(root.querySelectorAll('.pdfTestPage'));
  pages.forEach((page, idx) => {
    page.querySelectorAll('.pdfTestPageNumber').forEach(el => el.remove());
    const number = document.createElement('div');
    number.className = 'pdfTestPageNumber';
    number.textContent = `${idx + 1} / ${pages.length}`;
    page.appendChild(number);
  });
}

function selectedPdfSections() {
  return new Set(Array.from(document.querySelectorAll('.pdfSectionCheck'))
    .filter(input => input.checked)
    .map(input => input.value));
}

function lifePdfSections() {
  return [
    {key:'summary', tab:'tabSamenvatting', label:'pdfOptSummary'},
    {key:'productie', tab:'tabProductie', label:'pdfOptProductie', source:'prodGrouped'},
    {key:'verval', tab:'tabVerval', label:'pdfOptVerval', source:'vervalGrouped'},
    {key:'transformatie', tab:'tabTransformatie', label:'pdfOptTransformatie', source:'transGrouped'},
    {key:'portefeuille', tab:'tabPortefeuille', label:'pdfOptPortefeuille', source:'portefeuilleCharts'},
    {key:'detail', tab:'tabDetail', label:'pdfOptDetail', source:'categoryDetails'}
  ];
}
function updateLifePdfSectionLabels() {
  lifePdfSections().forEach(section => setText(section.label, $(section.tab)?.textContent || ''));
}
function prepareLifePdfBlock(source, section) {
  const clone = source.cloneNode(true);
  clone.classList.remove('manualClosed', 'drillOpen');
  clone.querySelectorAll('.blockExportActions,.pieTooltip').forEach(el => el.remove());
  const canvases = source.querySelectorAll('canvas');
  clone.querySelectorAll('canvas').forEach((canvas, index) => {
    const image = document.createElement('img');
    image.src = canvases[index].toDataURL('image/png');
    image.alt = section;
    canvas.replaceWith(image);
  });
  clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  // Match the visible main/subcategory selection, while opening the exported blocks.
  if (viewMode === 'main') clone.querySelectorAll('.barrow:has(.catSubText)').forEach(el => el.remove());
  if (viewMode === 'sub' && !clone.classList.contains('totalNonLife')) clone.querySelectorAll('.barrow:has(.catMainText.hasSubs)').forEach(el => el.remove());
  return clone;
}
function lifePdfDistribution(section) {
  const cfg = lifePillarPieConfig(section);
  const card = document.createElement('div');
  card.className = 'portfolioPieCard pdfLifeDistribution';
  card.innerHTML = '<h2>' + esc(cfg.title) + '</h2><div class="portfolioPiePair"></div>';
  [dashboardPreviousPeriod, dashboardCurrentPeriod].forEach((period, index) => {
    const panel = document.createElement('div');
    panel.className = 'portfolioPiePanel';
    const heading = index ? (currentLang === 'fr' ? 'Dernière période' : 'Laatste periode') : (currentLang === 'fr' ? 'Période précédente' : 'Vorige periode');
    const items = lifePillarPieItems(lastData, period, cfg);
    const canvas = document.createElement('canvas');
    canvas.width = 990; canvas.height = 645;
    drawPortfolioPie(canvas, period, items, -1, cfg.center);
    panel.innerHTML = '<h3>' + esc(heading + ' · ' + fmtPeriod(period)) + '</h3><img alt="' + esc(cfg.title) + '" src="' + canvas.toDataURL('image/png') + '"><div class="portfolioPieTotal">' + esc(cfg.total) + ': <b>' + euro.format(items.reduce((sum, item) => sum + item.value, 0)) + '</b></div><div class="pieLegend"></div>';
    renderPortfolioPieLegend(panel.querySelector('.pieLegend'), items);
    card.querySelector('.portfolioPiePair').appendChild(panel);
  });
  return card;
}
async function appendLifePdfBlocks(root, blocks, section) {
  let page, frame, count = 0;
  const startPage = () => {
    page = document.createElement('div');
    page.className = 'pdfExportPage pdfTestPage pdfLifePage';
    page.dataset.section = section.key;
    const heading = document.createElement('h2');
    heading.className = 'pdfLifeSectionTitle';
    heading.textContent = $(section.tab).textContent + ' · ' + fmtPeriod(dashboardPreviousPeriod) + ' → ' + fmtPeriod(dashboardCurrentPeriod);
    page.appendChild(heading);
    frame = document.createElement('div');
    frame.className = 'pdfLifeFrame';
    page.appendChild(frame);
    root.appendChild(page);
    count = 0;
  };
  const bottom = () => frame.getBoundingClientRect().bottom;
  for (const block of blocks) {
    if (!page) startPage();
    frame.appendChild(block);
    await Promise.all(Array.from(block.querySelectorAll('img')).map(img => img.decode().catch(() => {})));
    if (block.getBoundingClientRect().bottom > bottom() && count) {
      block.remove(); startPage(); frame.appendChild(block);
    }
    // A large category stays intact; fit only that individual block to the page.
    if (block.getBoundingClientRect().bottom > bottom()) {
      const width = block.getBoundingClientRect().width;
      const height = block.getBoundingClientRect().height;
      const scale = Math.min(1, (bottom() - block.getBoundingClientRect().top - 2) / height);
      if (!(scale > 0)) throw new Error('PDF: onvoldoende ruimte voor dit blok.');
      const fit = document.createElement('div');
      fit.style.cssText = 'position:relative;height:' + height * scale + 'px;flex:none';
      block.replaceWith(fit); fit.appendChild(block);
      block.style.cssText += ';position:absolute;left:0;top:0;width:' + width + 'px;transform-origin:top left;transform:scale(' + scale + ');margin:0!important';
    }
    count++;
  }
}
function lifePdfSummaryKpis() {
  const kpis = document.createElement('div');
  kpis.className = 'kpis pdfLifeKpis';
  kpis.innerHTML = (lastKpiContext?.summary || []).map(item => {
    const delta = yoy(item.o, item.v);
    return '<div class="kpi"><div class="label">' + escLabel(item.l) + '<br>ULT. ' + esc(dashboardCurrentPeriod) + '</div><div class="value">' + fmt(item.v,item.type) + '</div><div class="delta ' + cls(delta, item.invert) + '">' + signedPct(delta) + ' ' + msg('vs') + ' ' + esc(dashboardPreviousPeriod) + '</div>' + lifeKpiComparisonHtml(item,dashboardPreviousPeriod,dashboardCurrentPeriod) + '</div>';
  }).join('');
  return kpis;
}
async function buildLifePdfPages(root, selected) {
  document.body.appendChild(root);
  if (document.fonts?.ready) await document.fonts.ready;
  for (const section of lifePdfSections()) {
    if (!selected.has(section.key)) continue;
    let blocks;
    if (section.key === 'summary') {
      const summary = $('insightSummary');
      blocks = [buildPdfHeader(), lifePdfSummaryKpis(), ...Array.from(summary.querySelectorAll('.insightItem')).map(item => prepareLifePdfBlock(item, section.key))];
      const mix = summary.querySelector('.summaryProductionMixCard');
      if (mix) blocks.push(prepareLifePdfBlock(mix, section.key));
    } else {
      blocks = Array.from($(section.source).querySelectorAll(':scope > .cat')).map(block => prepareLifePdfBlock(block, section.key));
      if (section.key !== 'detail') blocks.push(lifePdfDistribution(section.key));
    }
    if (!blocks.length) throw new Error('PDF: geen inhoud gevonden voor ' + $(section.tab).textContent);
    await appendLifePdfBlocks(root, blocks, section);
  }
  addPdfTestPageNumbers(root);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
let lifePrintCleanup = null;
async function printSelectedPdf() {
  if (!lastData || lifePrintCleanup || document.body.classList.contains('pdfExportBusy')) return;
  const selected = selectedPdfSections();
  if (!selected.size) { alert(msg('pdfNoSections')); return; }
  const buttons = ['exportPdfBtn','printPdfBtn'].map($).filter(Boolean);
  const originalTitle = document.title;
  let root;
  const finish = () => {
    window.removeEventListener('afterprint', finish);
    root?.remove();
    document.title = originalTitle;
    document.body.classList.remove('printingPdf','pdfPrintPreparing','pdfExportBusy');
    buttons.forEach(button => button.disabled = false);
    setText('exportPdfLabel', msg('exportPdf'));
    lifePrintCleanup = null;
  };
  try {
    setPdfOptionsOpen(false);
    buttons.forEach(button => button.disabled = true);
    setText('exportPdfLabel', msg('pdfBusy'));
    document.body.classList.add('pdfExportBusy','pdfPrintPreparing');
    root = document.createElement('div'); root.className = 'pdfExportRoot pdfLifeExportRoot';
    await buildLifePdfPages(root, selected);
    const pages = Array.from(root.querySelectorAll('.pdfTestPage'));
    if (!pages.length) throw new Error('PDF: geen pagina’s aangemaakt.');
    lifePrintCleanup = finish;
    window.addEventListener('afterprint', finish, {once:true});
    document.body.classList.add('printingPdf');
    document.title = 'Dashboard kerncijfers life - ' + makeSafeFilePart(brokerInfo?.name || $('brokerName')?.textContent || 'Dashboard');
    window.print();
  } catch (error) {
    console.error(error); finish();
    alert((currentLang === 'fr' ? 'Impossible de créer le PDF : ' : 'PDF kon niet worden gemaakt: ') + error.message);
  }
}

function setPdfOptionsOpen(open) {
  $('pdfOptionsWrap').classList.toggle('open', open);
  $('exportPdfBtn').setAttribute('aria-expanded', String(open));
  if (open) $('pdfOptionsMenu').querySelector('.pdfSectionCheck')?.focus();
}

function selectPdfSections(selected) {
  document.querySelectorAll('#pdfOptionsMenu .pdfSectionCheck').forEach(input => { input.checked = selected; });
}

$('pdfSelectAll').addEventListener('click', () => selectPdfSections(true));
$('pdfSelectNone').addEventListener('click', () => selectPdfSections(false));
$('printPdfBtn').addEventListener('click', printSelectedPdf);
$('exportPdfBtn').addEventListener('click', e => {
  e.stopPropagation();
  setPdfOptionsOpen(!$('pdfOptionsWrap').classList.contains('open'));
});
$('pdfOptionsMenu').addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  setPdfOptionsOpen(false);
  $('exportPdfBtn').focus();
});
$('pdfOptionsMenu')?.addEventListener('click', e => e.stopPropagation());
document.addEventListener('click', () => {
  if ($('pdfOptionsWrap').classList.contains('open')) setPdfOptionsOpen(false);
});

// ─── Tab navigatie ────────────────────────────────────────────────────────────
function setActiveTabColor(tab) {
  const color = getComputedStyle(tab).getPropertyValue('--tab-color') || getComputedStyle(tab).borderColor || 'var(--green)';
  document.documentElement.style.setProperty('--active-tab-color', color.trim());
}
function moveDashboardToolbarToActiveSection() {
  const toolbar = $('dashboardToolbar');
  if (!toolbar) return;
  const activeSection = document.querySelector('#dashboard .section.active');
  const targetSlot = activeSection?.querySelector(':scope > .card .titleExportRow > .sectionToolbarSlot');
  const fallback = $('dashboardToolbarHome');
  const target = targetSlot || fallback;
  if (target && toolbar.parentElement !== target) target.appendChild(toolbar);
  toolbar.classList.toggle('contextualToolbar', !!targetSlot);
  $('dashboardToolbarHome').classList.toggle('hidden', !targetSlot);
  const isSummary = activeSection?.id === 'samenvatting';
  $('viewDropdownWrap').classList.toggle('hidden', isSummary || activeSection?.id === 'detail');
  $('drillToggleBtn').classList.toggle('hidden', isSummary);
  $('previousYearsControl').classList.toggle('hidden', !['samenvatting', 'productie', 'verval', 'transformatie', 'portefeuille'].includes(activeSection?.id));
}

function motionIsReduced() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function triggerMotionRefresh(section = document.querySelector('#dashboard .section.active')) {
  if (!section || motionIsReduced() || document.body.classList.contains('pdfExportBusy')) return;
  section.classList.remove('motionActive');
  void section.offsetWidth;
  section.classList.add('motionActive');
  window.clearTimeout(section._motionTimer);
  section._motionTimer = window.setTimeout(() => section.classList.remove('motionActive'), 950);
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  setActiveTabColor(b);
  $(b.dataset.tab).classList.add('active');
  moveDashboardToolbarToActiveSection();
  if (lastData && dashboardCurrentPeriod) {
    updateTopKpisForActiveTab();
    renderActivePie(lastData, dashboardCurrentPeriod);
    formatDisplayedPeriods();
  }
  triggerMotionRefresh($(b.dataset.tab));
  // Geen automatische scrollpositie-wijziging bij tabwissel.
}));
setActiveTabColor(document.querySelector('.tab.active') || document.getElementById('tabSamenvatting'));
placeLanguageSwitch();
moveDashboardToolbarToActiveSection();

// ─── Life-gegevensmodel en berekeningen ────────────────────────────────────
const cols = {
  type: 'Type', hoofd: 'Hoofdcategorie', sub: 'Subcategorie', periode: 'Periode',
  prodAantal: 'Aantal Prod', prodPremie: 'Premie Prod',
  premieKoopsom: 'Premie Koopsom',
  vervalAantal: 'Aantal Verval', vervalPremie: 'Premie Verval',
  vervalOnnatuurlijk: 'Premie Onnatuurlijk Verval', vervalNatuurlijk: 'Premie Natuurlijk Verval',
  vervalKlant: 'Verval Klant', vervalMij: 'Verval Mij',
  trans: 'Transformatie', premieVerhoging: 'Premie Verhoging', premieVerlaging: 'Premie Verlaging',
  progAantal: 'Aantal Progr', progPremie: 'Premie Progr',
  portefeuille: 'Portefeuille', uitgegeven: 'Uitgegeven Premie', verdiend: 'Verdiende Premie',
  polissenPortefeuille: 'Aantal Polissen Portefeuille', polissenPremiebetalend: 'Aantal Polissen Premiebetalend',
  polissenPremievrij: 'Aantal Polissen Premievrij', portefeuillepremie: 'Portefeuillepremie', reserves: 'Reserves',
  schadeAantal: 'Aantal Schades', schadelast: 'Schadelast', sp: 'S/P %',
  schadeCap: 'Afgetopte Schadelast', spCap: 'S/P Afgetopt %'
};

const dataIndexCache = new WeakMap();
function getDataIndex(data) {
  if (!Array.isArray(data)) return { rowsByType:new Map(), rowsByTypePeriod:new Map(), mainRowsByType:new Map(), categoryRowsByType:new Map() };
  const cached = dataIndexCache.get(data);
  if (cached) return cached;
  const index = { rowsByType:new Map(), rowsByTypePeriod:new Map(), mainRowsByType:new Map(), categoryRowsByType:new Map() };
  const push = (map, key, row) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  };
  data.forEach(row => {
    const type = String(row[cols.type] || '').trim().toUpperCase();
    if (!type) return;
    const period = String(row[cols.periode] || '').trim();
    push(index.rowsByType, type, row);
    push(index.rowsByTypePeriod, `${type}|${period}`, row);
    if (row[cols.hoofd] && row[cols.sub] && row[cols.hoofd] === row[cols.sub]) {
      push(index.mainRowsByType, type, row);
      if (!isTotalNonLife(row)) push(index.categoryRowsByType, type, row);
    }
  });
  dataIndexCache.set(data, index);
  return index;
}
function rowsOfPeriod(data, type, period) {
  return getDataIndex(data).rowsByTypePeriod.get(`${type}|${String(period || '').trim()}`) || [];
}

function detectDelimiter(text) {
  const first = (String(text).split(/\r?\n/).find(l => l.trim()) || '');
  const count = (ch) => { let q = false, c = 0; for (let i = 0; i < first.length; i++) { const x = first[i], nx = first[i + 1]; if (x === '"' && q && nx === '"') { i++; continue } if (x === '"') q = !q; else if (x === ch && !q) c++; } return c };
  return count(';') > count(',') ? ';' : ',';
}

function parseCSV(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const rows = []; let row = [], val = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], nxt = text[i + 1];
    if (c === '"' && q && nxt === '"') { val += '"'; i++ }
    else if (c === '"') { q = !q }
    else if (c === delimiter && !q) { row.push(val); val = '' }
    else if ((c === '\n' || c === '\r') && !q) {
      if (c === '\r' && nxt === '\n') i++;
      row.push(val);
      if (row.some(x => String(x).trim() !== '')) rows.push(row);
      row = []; val = '';
    } else { val += c }
  }
  if (val !== '' || row.length) { row.push(val); rows.push(row); }
  if (rows.length < 2) throw new Error(currentLang === 'fr' ? 'aucune ligne exploitable trouvée' : 'geen bruikbare rijen gevonden');
  const headers = rows.shift().map(h => String(h).trim());
  const required = [cols.type, cols.hoofd, cols.sub, cols.periode, cols.prodPremie, cols.vervalPremie, cols.progPremie];
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length) throw new Error((currentLang === 'fr' ? 'colonnes manquantes : ' : 'ontbrekende kolommen: ') + missing.join(', '));
  return rows.map(cells => {
    const obj = Object.fromEntries(headers.map((h, i) => [h, String(cells[i] ?? '').trim()]));
    obj._cells = cells.map(x => String(x ?? '').trim());
    if (String(obj[cols.type] || "").trim().toUpperCase() === "SCHADE") {
      const c = obj._cells;
      obj[cols.uitgegeven] = c[14] ?? obj[cols.uitgegeven] ?? "";
      obj[cols.verdiend] = c[15] ?? obj[cols.verdiend] ?? "";
      obj[cols.schadeAantal] = c[16] ?? obj[cols.schadeAantal] ?? "";
      obj[cols.schadelast] = c[17] ?? obj[cols.schadelast] ?? "";
      obj[cols.sp] = c[18] ?? obj[cols.sp] ?? "";
      obj[cols.schadeCap] = c[19] ?? obj[cols.schadeCap] ?? "";
      obj[cols.spCap] = c[20] ?? obj[cols.spCap] ?? "";
    }
    return obj;
  });
}

function parseAdviceCSV(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const rows = []; let row = [], val = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], nxt = text[i + 1];
    if (c === '"' && q && nxt === '"') { val += '"'; i++ }
    else if (c === '"') { q = !q }
    else if (c === delimiter && !q) { row.push(val); val = '' }
    else if ((c === '\n' || c === '\r') && !q) {
      if (c === '\r' && nxt === '\n') i++;
      row.push(val);
      if (row.some(x => String(x).trim() !== '')) rows.push(row);
      row = []; val = '';
    } else { val += c }
  }
  if (val !== '' || row.length) { row.push(val); rows.push(row); }
  if (rows.length < 2) throw new Error('geen bruikbare adviesvergoeding-rijen gevonden');
  const headers = rows.shift().map(h => String(h).trim());
  return rows.map(cells => {
    const obj = Object.fromEntries(headers.map((h, i) => [h, String(cells[i] ?? '').trim()]));
    obj._cells = cells.map(x => String(x ?? '').trim());
    return obj;
  });
}

function n(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/%/g, '').replace(/\s/g, '');
  if (!s) return 0;
  const hasDot = s.includes('.'), hasComma = s.includes(',');
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    const parts = s.split(',');
    s = (parts.length === 2 && parts[1].length <= 2) ? parts[0].replace(/,/g, '') + '.' + parts[1] : s.replace(/,/g, '');
  } else if (hasDot) {
    const parts = s.split('.');
    s = (parts.length === 2 && parts[1].length <= 2) ? s : s.replace(/\./g, '');
  }
  return Number(s) || 0;
}

function pkey(p) { const m = String(p).trim().match(/(\d{1,2})\s+(\d{4})/); return m ? Number(m[2]) * 100 + Number(m[1]) : 0 }
function fmtPeriod(value) {
  return String(value ?? '').replace(/\b(\d{1,2})\s+(\d{4})\b/g, (_, mm, yyyy) => `${String(mm).padStart(2, '0')}/${yyyy}`);
}
function updateSectionPeriodInline(prevP, currP) {
  const text = prevP && currP ? `${fmtPeriod(prevP)} vs ${fmtPeriod(currP)}` : '';
  ['summary', 'prod', 'verval', 'trans', 'prog', 'portefeuille', 'detail'].forEach(key => {
    const el = $(`${key}PeriodInline`);
    if (el) el.textContent = text;
  });
}
function formatDisplayedPeriods(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName;
      return ['SCRIPT','STYLE','TEXTAREA'].includes(tag) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const next = fmtPeriod(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  });
}
function latestMonthPair(rows) {
  const periods = [...new Set(rows.map(r => r[cols.periode]).filter(Boolean))].sort((a, b) => pkey(a) - pkey(b));
  if (periods.length < 2) throw new Error(currentLang === 'fr' ? 'moins de deux périodes trouvées' : 'minder dan twee periodes gevonden');
  const months = {};
  periods.forEach(p => { const m = String(p).trim().split(/\s+/)[0]; (months[m] ?? (months[m] = [])).push(p) });
  let best = null;
  Object.values(months).forEach(list => { if (list.length >= 2) { const pair = list.slice(-2); if (!best || pkey(pair[1]) > pkey(best[1])) best = pair } });
  return best || periods.slice(-2);
}
function rowsOf(data, type) { return getDataIndex(data).rowsByType.get(type) || [] }
function isTotalNonLife(r) {
  const hoofd = String(r[cols.hoofd] || '').trim().toUpperCase();
  const sub = String(r[cols.sub] || '').trim().toUpperCase();
  return (hoofd === 'TOTAAL NON LIFE' && sub === 'TOTAAL NON LIFE') || (hoofd === 'TOTAAL LEVEN' && sub === 'TOTAAL LEVEN');
}
function mainRows(data, type) { return getDataIndex(data).mainRowsByType.get(type) || [] }
function categoryRows(data, type) { return getDataIndex(data).categoryRowsByType.get(type) || [] }
function totalRow(data, type, periode) {
  const samePeriod = r => String(r[cols.periode] || '').trim() === String(periode).trim();
  const periodRows = rowsOfPeriod(data, type, periode);
  const candidates = periodRows.filter(r => isTotalNonLife(r) && samePeriod(r));
  const fallbackCandidates = periodRows.filter(r => samePeriod(r) && (['TOTAAL NON LIFE','TOTAAL LEVEN'].includes(String(r[cols.hoofd] || '').trim().toUpperCase()) || ['TOTAAL NON LIFE','TOTAAL LEVEN'].includes(String(r[cols.sub] || '').trim().toUpperCase())));
  const all = candidates.length ? candidates : fallbackCandidates;
  const start = type === 'SCHADE' ? 14 : 4;
  const hasNumericData = r => r && r._cells && r._cells.slice(start).some(x => String(x ?? '').trim() !== '' && n(x) !== 0);
  return all.slice().reverse().find(hasNumericData) || all[all.length - 1] || {};
}

function yoy(oldv, newv) { return oldv ? ((newv - oldv) / Math.abs(oldv)) * 100 : (newv ? 100 : 0) }
function ppDelta(oldv, newv) { return n(newv) - n(oldv) }
function cls(v, invert = false) { const x = invert ? -v : v; return x > 0 ? 'pos' : x < 0 ? 'neg' : 'neu' }
function fmt(v, type) { if (type === 'money') return euro.format(v); if (type === 'pct') return pct.format(v) + '%'; return num.format(v) }
function pctText(v, invert = false) { return `<span class="${cls(v, invert)}">${v >= 0 ? '+' : ''}${pct.format(v)}%</span>` }
function deltaHtml(d, oldVal, prevP, type, invert = false) {
  const prevFmt = fmt(oldVal, type);
  return `<div class="delta ${cls(d, invert)}">${d >= 0 ? '+' : ''}${pct.format(d)}% ${msg('vs')} ${prevP} <span style="opacity:.7">(${prevFmt})</span></div>`;
}

function barDeltaTextHtml(oldVal, newVal, invert = false) {
  const d = yoy(Number(oldVal) || 0, Number(newVal) || 0);
  return `<span class="barValueDelta ${cls(d, invert)}">(${d >= 0 ? '+' : ''}${pct.format(d)}%)</span>`;
}
function barAbsolutePctDeltaTextHtml(oldVal, newVal, invert = false) {
  const d = ppDelta(oldVal, newVal);
  return `<span class="barValueDelta ${cls(d, invert)}">(${d >= 0 ? '+' : ''}${pct.format(d)}%)</span>`;
}

function historyComparisonHtml(delta, invert) {
  return `<span class="historyComparison ${cls(delta, invert)}"><svg viewBox="0 0 12 24" aria-hidden="true"><path d="M2 22C12 22 12 2 2 2m3 4L2 2l4-1"/></svg>${delta >= 0 ? '+' : ''}${pct.format(delta)}%</span>`;
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])) }
function displayLabel(s) {
  const value = String(s ?? '');
  const direct = I18N[currentLang].labels[value];
  if (direct) return direct;
  return value
    .replace(/Protection Juridique Stand Alone/gi, I18N[currentLang].labels['Rechtsbijstand'])
    .replace(/Protection Juridique/gi, I18N[currentLang].labels['Rechtsbijstand'])
    .replace(/Total Non Vie/gi, I18N[currentLang].labels['TOTAAL NON LIFE'])
    .replace(/Particuliers Incendie/gi, I18N[currentLang].labels['Particulieren Brand'])
    .replace(/Particuliers RC/gi, I18N[currentLang].labels['Particulieren BA'])
    .replace(/Particuliers Autres/gi, I18N[currentLang].labels['Particulieren Overige'])
    .replace(/Entreprises Incendie/gi, I18N[currentLang].labels['Ondernemingen Brand'])
    .replace(/Entreprises RC/gi, I18N[currentLang].labels['Ondernemingen BA'])
    .replace(/Entreprises Autres/gi, I18N[currentLang].labels['Ondernemingen Overige'])
    .replace(/Auto Flottes/gi, I18N[currentLang].labels['Auto Vloten'])
    .replace(/Auto Non Flottes/gi, I18N[currentLang].labels['Auto Niet Vloten']);
}
function escLabel(s) { return esc(displayLabel(s)); }

function orderedSubs(catRows, cat) { const subAll = [...new Set(catRows.map(r => r[cols.sub]).filter(Boolean))]; const subs = subAll.filter(s => s !== cat); if (!subs.length) return [cat]; return [cat, ...subs]; }
function categoryRowLabelHtml(s, cat, hasSubs = false) {
  const isMain = s === cat;
  const clsName = isMain ? `catMainText${hasSubs ? ' hasSubs' : ''}` : 'catSubText';
  return `<span class="${clsName}">${escLabel(s)}</span>`;
}
function labelHtmlFor(ordered, cat) {
  const hasSubs = ordered.some(s => s !== cat);
  return ordered.map(s => categoryRowLabelHtml(s, cat, hasSubs));
}

const CATEGORY_ICONS = {
  auto: "data:image/png;base64,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",
  particulieren: "data:image/png;base64,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",
  ondernemingen: "data:image/png;base64,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",
  arbeidsongevallen: "data:image/png;base64,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",
  rechtsbijstand: "data:image/png;base64,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"
};
function categoryIconKey(cat) {
  const c = String(cat || '').trim().toLowerCase();
  if (c === 'auto') return 'auto';
  if (c === 'particulieren' || c === 'particuliers') return 'particulieren';
  if (c === 'ondernemingen' || c === 'entreprises') return 'ondernemingen';
  if (c === 'arbeidsongevallen' || c === 'accidents de travail') return 'arbeidsongevallen';
  if (c === 'rechtsbijstand' || c === 'rechtsbijstand stand alone' || c === 'protection juridique' || c === 'protection juridique stand alone') return 'rechtsbijstand';
  return '';
}
function catTitleHtml(cat) {
  const key = categoryIconKey(cat);
  const icon = key ? `<img class="catIcon" src="${CATEGORY_ICONS[key]}" alt="" />` : '';
  return `${icon}<span>${escLabel(cat)}</span>`;
}

function totalBlock(html) { return String(html).replace('class="cat"', 'class="cat totalNonLife"') }

function importCheckHtml(label, value, okState, detailHtml = '') {
  const stateClass = okState === true ? 'ok' : (okState === false ? 'warn' : 'neu');
  const clickable = okState === false && detailHtml ? ' clickable' : '';
  const toggle = clickable ? ' onclick="toggleImportDetail(this)" title="Klik voor detail"' : '';
  return `<div class="importCheckWrap"><div class="importCheck ${stateClass}${clickable}"${toggle}><div class="importCheckLabel">${esc(label)}</div><div class="importCheckValue">${esc(value)}</div></div>${detailHtml ? `<div class="importDetail">${detailHtml}</div>` : ''}</div>`;
}
function toggleImportDetail(el) {
  const wrap = el && el.closest ? el.closest('.importCheckWrap') : null;
  if (wrap) wrap.classList.toggle('open');
}
function detailList(title, items) {
  const list = (items || []).filter(Boolean).slice(0, 8);
  const more = (items || []).length > 8 ? `<li>${esc('…')}</li>` : '';
  return `${esc(title)}${list.length ? `<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}${more}</ul>` : ''}`;
}
function inspectSpPercentages(data) {
  const schadeRows = rowsOf(data, 'SCHADE');
  if (!schadeRows.length) return { ok: false, issues: ['Geen schade-rijen gevonden.'] };

  // S/P-percentages kunnen in werkelijkheid hoger zijn dan 100% of zelfs negatief zijn.
  // Daarom valideren we hier bewust niet op bereik, maar enkel op aanwezigheid en numerieke leesbaarheid.
  const values = [];
  const issues = [];

  schadeRows.forEach(r => {
    [[cols.sp, 'S/P'], [cols.spCap, 'S/P afgetopt']].forEach(([field, label]) => {
      const raw = String(r[field] ?? '').trim();
      if (!raw) return;
      const val = n(raw);
      if (Number.isFinite(val)) {
        values.push(val);
      } else {
        issues.push(`${r[cols.periode] || '-'} · ${r[cols.hoofd] || '-'} / ${r[cols.sub] || '-'} · ${label}: niet numeriek gelezen (${raw})`);
      }
    });
  });

  if (!values.length) return { ok: false, issues: ['Geen numerieke S/P-percentages gevonden in de schade-rijen.'] };
  return { ok: issues.length === 0, issues };
}

function renderImportControl(data, currP) {
  const box = $('importControl');
  if (!box || !data) return;
  const periods = [...new Set(data.map(r => String(r[cols.periode] || '').trim()).filter(Boolean))].sort((a,b) => pkey(a) - pkey(b));
  const latest = currP || periods[periods.length - 1] || '-';
  const prodTotalRow = totalRow(data, 'PRODUCTIE', latest) || {};
  const hasProdTotal = !!prodTotalRow[cols.hoofd];
  const brokerOk = !!((brokerInfo && brokerInfo.number) || (brokerInfo && brokerInfo.name));
  const yes = msg('yes'), no = msg('no');
  const periodDetail = periods.length ? '' : detailList('Geen periodes gevonden. Controleer of de PDF-tabellen correct zijn uitgelezen.', []);
  const latestDetail = latest !== '-' ? '' : detailList('Geen laatste periode bepaald omdat er geen geldige periodes gevonden zijn.', []);
  const prodDetail = hasProdTotal ? '' : detailList(`Niet gevonden: PRODUCTIE / TOTAAL LEVEN voor periode ${latest}.`, [
    `Aantal productie-rijen: ${rowsOf(data, 'PRODUCTIE').length}`,
    `Gevonden periodes: ${periods.join(', ') || '-'}`
  ]);
  box.innerHTML = `<div class="importControlHead"><div class="importControlTitle">${esc(msg('importControlTitle'))}</div><div class="importControlSub">${esc(msg('importControlSub'))}</div></div>` +
    `<div class="importGrid">` +
    importCheckHtml(msg('importPeriods'), String(periods.length), periods.length > 0, periodDetail) +
    importCheckHtml(msg('importLatestPeriod'), latest, latest !== '-', latestDetail) +
    importCheckHtml(msg('importTotalProd'), hasProdTotal ? yes : no, hasProdTotal, prodDetail) +
    importCheckHtml(msg('importBroker'), brokerOk ? yes : no, brokerOk) +
    `</div>`;
  box.classList.remove('hidden');
}

function setDashboardKind(kind) {
  const isAdvice = kind === 'adviesvergoeding';
  const tabs = document.querySelector('#dashboard > .tabs');
  if (tabs) tabs.classList.toggle('hidden', isAdvice);
  $('dashboardToolbarHome')?.classList.toggle('hidden', isAdvice);
  $('dashboardToolbar')?.classList.toggle('hidden', isAdvice);
  $('summaryTitle').closest('.titleExportRow').classList.toggle('hidden', isAdvice);
  $('importControl')?.classList.add('hidden');
  $('topCompactBar')?.classList.add('hidden');
  if (isAdvice) {
    document.querySelectorAll('#dashboard .section').forEach(section => section.classList.remove('active'));
    $('samenvatting')?.classList.add('active');
    document.querySelectorAll('#dashboard .tab').forEach(tab => tab.classList.remove('active'));
    $('tabSamenvatting')?.classList.add('active');
    ['prodGrouped','vervalGrouped','transGrouped','progGrouped','portefeuilleCharts','categoryDetails'].forEach(id => { const el = $(id); if (el) el.innerHTML = ''; });
    $('productionPieCard')?.classList.add('hidden');
    $('portfolioPieCard')?.classList.add('hidden');
  }
  moveDashboardToolbarToActiveSection();
}

function adviceRowsByLevel(data, level) {
  return data.filter(r => String(r.Niveau || '').trim() === level);
}

function adviceTotalGroup(data) {
  return adviceRowsByLevel(data, 'Groep')[0] || {};
}

function adviceProducerTotals(data) {
  return adviceRowsByLevel(data, 'Prodnr');
}
function adviceDetailRows(data) {
  return data.filter(r => String(r.Niveau || '').trim() === 'Detail');
}
function adviceAggregateRows(rows, groupFields) {
  const map = new Map();
  const moneyRound = v => Math.round((v + Number.EPSILON) * 100) / 100;
  rows.forEach(r => {
    const key = groupFields.map(f => String(r[f] || '')).join('|');
    if (!map.has(key)) {
      const base = Object.fromEntries(groupFields.map(f => [f, r[f] || '']));
      map.set(key, { ...base, Aantal:0, AdviesbasisOngewogen:0, AdviesbasisGewogen:0, KapitaalOverlijden:0, Adviesvergoeding:0 });
    }
    const x = map.get(key);
    x.Aantal += n(r.Aantal) || 1;
    x.AdviesbasisOngewogen += n(r.AdviesbasisOngewogen);
    x.AdviesbasisGewogen += n(r.AdviesbasisGewogen);
    x.KapitaalOverlijden += n(r.KapitaalOverlijden);
    x.Adviesvergoeding += n(r.Adviesvergoeding);
    x.AdviesbasisOngewogen = moneyRound(x.AdviesbasisOngewogen);
    x.AdviesbasisGewogen = moneyRound(x.AdviesbasisGewogen);
    x.KapitaalOverlijden = moneyRound(x.KapitaalOverlijden);
    x.Adviesvergoeding = moneyRound(x.Adviesvergoeding);
  });
  return [...map.values()].sort((a, b) => groupFields.map(f => String(a[f] || '').localeCompare(String(b[f] || ''), 'nl')).find(v => v) || 0);
}

function adviceTableHtml(rows, columns, emptyText = 'Geen detailregels gevonden.') {
  if (!rows.length) return `<div class="note">${esc(emptyText)}</div>`;
  const hasWidths = columns.some(c => c.width);
  const colgroup = hasWidths ? `<colgroup>${columns.map(c => `<col${c.width ? ` style="width:${esc(c.width)}"` : ''}>`).join('')}</colgroup>` : '';
  const head = `<tr>${columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>`;
  const body = rows.map(r => {
    const rowClass = r.isTotal ? ' class="adviceTotalRow"' : '';
    return `<tr${rowClass}>${columns.map(c => `<td>${c.value(r)}</td>`).join('')}</tr>`;
  }).join('');
  return `<table class="summary-table${hasWidths ? ' adviceFixedTable' : ''}">${colgroup}<thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function advicePiePath(cx, cy, r, start, end) {
  const sx = cx + r * Math.cos(start), sy = cy + r * Math.sin(start);
  const ex = cx + r * Math.cos(end), ey = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${sx.toFixed(3)} ${sy.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(3)} ${ey.toFixed(3)} Z`;
}
function adviceCategoryPieHtml(cats, field, title) {
  const items = cats
    .map((cat, i) => ({ label:cat.Subcategorie || '-', value:n(cat[field]), color:pieSegmentColor(cat.Subcategorie || String(i), i) }))
    .filter(item => item.value > 0);
  const total = items.reduce((s, item) => s + item.value, 0);
  if (!total) return `<div class="advicePieCard"><h4>${esc(title)}</h4><div class="pieEmpty">Geen bedragen gevonden.</div></div>`;
  let angle = -Math.PI / 2;
  const cx = 60, cy = 60, r = 52;
  const slices = items.map((item, i) => {
    const share = item.value / total;
    const start = angle;
    const end = i === items.length - 1 ? Math.PI * 1.5 : angle + share * Math.PI * 2;
    angle = end;
    const tip = `${item.label}\n${euro.format(item.value)}\n${pct.format(share * 100)}%`;
    if (items.length === 1) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${esc(item.color)}" data-advice-tip="${esc(tip)}"></circle>`;
    return `<path d="${advicePiePath(cx, cy, r, start, end)}" fill="${esc(item.color)}" data-advice-tip="${esc(tip)}"></path>`;
  }).join('');
  const legend = items.map(item => {
    const share = item.value / total * 100;
    const tip = `${item.label}\n${euro.format(item.value)}\n${pct.format(share)}%`;
    return `<div class="advicePieLegendItem" data-advice-tip="${esc(tip)}"><span class="pieSwatch" style="background:${esc(item.color)}"></span><span class="advicePieLegendName">${esc(item.label)}</span><span class="advicePieLegendValue">${pct.format(share)}%</span></div>`;
  }).join('');
  return `<div class="advicePieCard"><h4>${esc(title)}</h4><div class="advicePieInner"><svg class="advicePieSvg" viewBox="0 0 120 120" role="img" aria-label="${esc(title)}">${slices}<circle cx="${cx}" cy="${cy}" r="23" fill="#fff"></circle></svg><div class="advicePieLegend">${legend}</div></div></div>`;
}
function advicePillarPieGridHtml(cats) {
  return `<div class="advicePieGrid">${[
    adviceCategoryPieHtml(cats, 'AdviesbasisOngewogen', 'Adviesbasis ongewogen'),
    adviceCategoryPieHtml(cats, 'AdviesbasisGewogen', 'Adviesbasis gewogen'),
    adviceCategoryPieHtml(cats, 'Adviesvergoeding', 'Adviesvergoeding')
  ].join('')}</div>`;
}
function advicePdfOrderIndex(value, list) {
  const v = String(value || '').toLowerCase();
  const i = list.findIndex(x => v.includes(String(x).toLowerCase()));
  return i < 0 ? 99 : i;
}
function sortAdviceRowsByPdfOrder(rows) {
  const pijlerOrder = ['Tijdelijke en schuldsaldoverzekeringen','Tweede Pijler','Derde Pijler','Vierde Pijler'];
  const subOrder = ['Tijdelijke en schuldsaldoverzekeringen','OVERLIJDEN','IPT','VAPZ','RIZIV','POZ','Pensioensparen','Langetermijnsparen','Overige Particulieren Niet Fiscaal'];
  return [...rows].sort((a, b) =>
    advicePdfOrderIndex(a.Pijler, pijlerOrder) - advicePdfOrderIndex(b.Pijler, pijlerOrder) ||
    advicePdfOrderIndex(a.Subcategorie, subOrder) - advicePdfOrderIndex(b.Subcategorie, subOrder) ||
    String(a.Subcategorie || '').localeCompare(String(b.Subcategorie || ''), 'nl')
  );
}
function adviceExtractedAmountsHtml(data, totalTitle = 'Totaal') {
  const detailRows = data.filter(r => String(r.Niveau || '').trim() === 'Detail');
  if (!detailRows.length) return `<div class="note">Er werden geen detailregels uit de PDF gelezen.</div>`;
  const isDeath = String(detailRows[0]?.AdviesType || '').toLowerCase() === 'overlijden';
  const order = isDeath ? ['Tijdelijke en schuldsaldoverzekeringen','Tweede Pijler','Derde Pijler','Vierde Pijler'] : ['Tweede Pijler','Derde Pijler','Vierde Pijler'];
  const labels = { 'Tijdelijke en schuldsaldoverzekeringen':'Overlijden', 'Tweede Pijler':'2e pijler', 'Derde Pijler':'3e pijler', 'Vierde Pijler':'4e pijler' };
  const typeCell = (r, type) => {
    const rows = (r.sourceRows || []).filter(x => String(x.Type || '').trim() === type);
    const count = rows.length;
    const ongewogen = rows.reduce((s, x) => s + n(x.AdviesbasisOngewogen), 0);
    const gewogen = rows.reduce((s, x) => s + n(x.AdviesbasisGewogen), 0);
    const title = `${type}\nAantal: ${num.format(count)}\nAdviesbasis ongewogen: ${euro.format(ongewogen)}\nAdviesbasis gewogen: ${euro.format(gewogen)}`;
    return `<span class="adviceTypeCell" data-advice-tip="${esc(title)}">${num.format(count)}</span>`;
  };
  const columns = [
    { label:'Categorie', width:isDeath ? '22%' : '28%', value:r => esc(r.Subcategorie || '') },
    { label:'Aantal', width:'7%', value:r => num.format(n(r.Aantal)) },
    { label:'VH', width:'5%', value:r => r.isDeathSummary ? '' : typeCell(r, 'VH') },
    { label:'NZ', width:'5%', value:r => r.isDeathSummary ? '' : typeCell(r, 'NZ') },
    { label:'NK', width:'5%', value:r => r.isDeathSummary ? '' : typeCell(r, 'NK') },
    { label:'KP', width:'5%', value:r => r.isDeathSummary ? '' : typeCell(r, 'KP') },
    { label:'Adviesbasis ongewogen', width:isDeath ? '13%' : '15%', value:r => r.isDeathSummary ? '' : euro.format(n(r.AdviesbasisOngewogen)) },
    { label:'Adviesbasis gewogen', width:isDeath ? '13%' : '15%', value:r => r.isDeathSummary ? '' : euro.format(n(r.AdviesbasisGewogen)) },
    ...(isDeath ? [{ label:'Kapitaal overlijden', width:'14%', value:r => euro.format(n(r.KapitaalOverlijden)) }] : []),
    { label:'Adviesvergoeding', width:isDeath ? '13%' : '15%', value:r => r.isDeathSummary ? '' : euro.format(n(r.Adviesvergoeding)) }
  ];
  const totalCats = sortAdviceRowsByPdfOrder(adviceAggregateRows(detailRows, ['Pijler','Subcategorie'])).map(cat => ({
    ...cat,
    Subcategorie:`${labels[cat.Pijler] || cat.Pijler} · ${cat.Subcategorie}`,
    sourceRows:detailRows.filter(r => r.Pijler === cat.Pijler && r.Subcategorie === cat.Subcategorie)
  }));
  const totalAll = adviceAggregateRows(detailRows, ['Niveau'])[0] || {};
  const totalRows = [{ ...totalAll, Subcategorie:'Totaal', isTotal:true, sourceRows:detailRows }];
  const totalPieHtml = !isDeath || totalCats.length > 1 ? advicePillarPieGridHtml(totalCats) : '';
  const totalBlock = `<div class="adviceTotalBlock"><div class="adviceTotalHead"><div class="adviceTotalTitle">${esc(totalTitle)}</div><div class="small">Alle pijlers samen</div><div></div></div>${adviceTableHtml(totalRows, columns)}${totalPieHtml}</div>`;
  const pillarBlocks = order.map(pijler => {
    const pRows = detailRows.filter(r => r.Pijler === pijler);
    if (!pRows.length) return '';
    const pTotal = adviceAggregateRows(pRows, ['Pijler'])[0] || {};
    const cats = sortAdviceRowsByPdfOrder(adviceAggregateRows(pRows, ['Pijler','Subcategorie'])).map(cat => ({
      ...cat,
      sourceRows:pRows.filter(r => r.Subcategorie === cat.Subcategorie)
    }));
    const totalRow = { ...pTotal, Subcategorie:`Totaal ${labels[pijler] || pijler}`, isTotal:true, sourceRows:pRows };
    const rows = isDeath && cats.length <= 1 ? [totalRow] : [...cats, totalRow];
    const pieHtml = !isDeath || cats.length > 1 ? advicePillarPieGridHtml(cats) : '';
    return `<div class="advicePillarBlock"><div class="advicePillarHead"><div class="advicePillarTitle">${esc(labels[pijler] || pijler)}</div></div>${adviceTableHtml(rows, columns)}${pieHtml}</div>`;
  }).join('');
  return `${totalBlock}${pillarBlocks || `<div class="note">Er werden geen detailregels voor tweede, derde of vierde pijler gevonden.</div>`}`;
}
function adviceProducerList(data) {
  const rows = adviceDetailRows(data);
  const map = new Map();
  rows.forEach(r => {
    if (!r.Prodnr) return;
    if (!map.has(r.Prodnr)) map.set(r.Prodnr, cleanAdviceProducerName(r.ProducentNaam, r.Prodnr));
  });
  return [...map.entries()].map(([prodnr, name]) => ({ prodnr, name })).sort((a,b) => a.prodnr.localeCompare(b.prodnr, 'nl'));
}
function cleanAdviceProducerName(name, prodnr) {
  let out = String(name || '').replace(/\s+/g, ' ').trim();
  if (prodnr) out = out.replace(new RegExp(`^\\s*(?:Prodnr\\.?\\s*)?${String(prodnr).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:Prodnr\\.?\\s*)?`, 'i'), '');
  out = out.replace(/^\s*Prodnr\.?\s*/i, '').trim();
  return out;
}

function renderAdviceKpis(rows) {
  const detailRows = (rows || []).filter(r => String(r.Niveau || '').trim() === 'Detail');
  const isDeath = String(detailRows[0]?.AdviesType || '').toLowerCase() === 'overlijden';
  const allByPijler = adviceAggregateRows(detailRows, ['Pijler']);
  const totalAdviceFee = detailRows.reduce((s, r) => s + n(r.Adviesvergoeding), 0);
  const totalWeightedBasis = detailRows.reduce((s, r) => s + n(r.AdviesbasisGewogen), 0);
  const totalDeathCapital = detailRows.reduce((s, r) => s + n(r.KapitaalOverlijden), 0);
  if (isDeath) {
    $('kpis').innerHTML = [
      `<div class="kpi adviceTotalKpi"><div class="label">Totaal adviesvergoeding</div><div class="value">${euro.format(totalAdviceFee)}</div><div class="delta neu">Overlijden</div></div>`,
      `<div class="kpi adviceTotalKpi"><div class="label">Totaal gewogen adviesbasis</div><div class="value">${euro.format(totalWeightedBasis)}</div><div class="delta neu">Overlijden</div></div>`,
      `<div class="kpi adviceComponentKpi adviceDeathKpi"><div class="label">Aantal zaken</div><div class="value">${num.format(detailRows.length)}</div><div class="delta neu">Aantal polisnrs</div></div>`,
      `<div class="kpi adviceComponentKpi adviceDeathKpi"><div class="label">Totaal kapitaal overlijden</div><div class="value">${euro.format(totalDeathCapital)}</div><div class="delta neu">Kap. Overl.</div></div>`
    ].join('');
    return;
  }
  const pijlerTotal = pijler => allByPijler.find(r => r.Pijler === pijler) || {};
  $('kpis').innerHTML = [
    `<div class="kpi adviceTotalKpi"><div class="label">Totaal adviesvergoeding</div><div class="value">${euro.format(totalAdviceFee)}</div><div class="delta neu">Alle pijlers samen</div></div>`,
    `<div class="kpi adviceTotalKpi"><div class="label">Totaal gewogen adviesbasis</div><div class="value">${euro.format(totalWeightedBasis)}</div><div class="delta neu">Alle pijlers samen</div></div>`,
    `<div class="kpi adviceComponentKpi"><div class="label">2e pijler</div><div class="value">${euro.format(n(pijlerTotal('Tweede Pijler').AdviesbasisGewogen))}</div><div class="delta neu">Gewogen adviesbasis</div></div>`,
    `<div class="kpi adviceComponentKpi"><div class="label">3e pijler</div><div class="value">${euro.format(n(pijlerTotal('Derde Pijler').AdviesbasisGewogen))}</div><div class="delta neu">Gewogen adviesbasis</div></div>`,
    `<div class="kpi adviceComponentKpi"><div class="label">4e pijler</div><div class="value">${euro.format(n(pijlerTotal('Vierde Pijler').AdviesbasisGewogen))}</div><div class="delta neu">Gewogen adviesbasis</div></div>`
  ].join('');
}

function showAdviceTab(tab) {
  const scrollY = window.scrollY;
  const insightItem = document.querySelector('#insightSummary .insightItem');
  if (insightItem) insightItem.style.minHeight = `${Math.max(insightItem.offsetHeight, insightItem.scrollHeight)}px`;
  document.querySelectorAll('.adviceTabBtn').forEach(btn => btn.classList.toggle('active', btn.dataset.adviceTab === tab));
  document.querySelectorAll('.advicePanel').forEach(panel => panel.classList.toggle('hidden', panel.dataset.advicePanel !== tab));
  if (currentDashboardType === 'adviesvergoeding' && lastData) {
    const rows = adviceDetailRows(lastData);
    const prodMatch = String(tab || '').match(/^producer-(.+)$/);
    renderAdviceKpis(prodMatch ? rows.filter(r => String(r.Prodnr || '') === prodMatch[1]) : rows);
  }
  requestAnimationFrame(() => {
    window.scrollTo(0, scrollY);
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  });
}
function ensureAdviceHoverTooltip() {
  let tip = document.getElementById('adviceHoverTip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'adviceHoverTip';
    tip.className = 'adviceHoverTip';
    document.body.appendChild(tip);
  }
  return tip;
}
function moveAdviceHoverTooltip(e) {
  const tip = document.getElementById('adviceHoverTip');
  if (!tip || tip.style.display === 'none') return;
  tip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 12)}px`;
  tip.style.top = `${Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 12)}px`;
}
document.addEventListener('mouseover', e => {
  const target = e.target.closest?.('[data-advice-tip]');
  if (!target) return;
  const tip = ensureAdviceHoverTooltip();
  tip.textContent = target.dataset.adviceTip || '';
  tip.style.display = 'block';
  moveAdviceHoverTooltip(e);
});
document.addEventListener('mousemove', moveAdviceHoverTooltip);
document.addEventListener('mouseout', e => {
  if (!e.target.closest?.('[data-advice-tip]')) return;
  const tip = document.getElementById('adviceHoverTip');
  if (tip) tip.style.display = 'none';
});

function buildAdviceDashboard(data) {
  const first = data[0] || {};
  const adviceType = first.AdviesType || 'Sparen';
  const groupTotal = adviceTotalGroup(data);
  const producerTotals = adviceProducerTotals(data);
  const producers = [...new Set(data.map(r => r.Prodnr).filter(Boolean))];
  const detailRows = adviceDetailRows(data);
  const producerList = adviceProducerList(data);
  const selectedProducer = producerList[0]?.prodnr || '';
  const allByPijler = adviceAggregateRows(detailRows, ['Pijler']);
  const allByCategory = adviceAggregateRows(detailRows, ['Pijler','Subcategorie']);
  const allByType = adviceAggregateRows(detailRows, ['Type']);
  const perProdCategoryType = adviceAggregateRows(detailRows, ['Prodnr','ProducentNaam','Pijler','Subcategorie','Type']);
  brokerInfo = {
    label: String(first.GroepsType || '').toLowerCase().includes('groep') ? 'groepsnummer' : 'koepelnummer',
    number: first.Groepsnummer || '',
    name: first.Naam || ''
  };
  dashboardPreviousPeriod = null;
  dashboardCurrentPeriod = null;
  lastKpiContext = null;
  $('dashboard').classList.remove('hidden');
  setDashboardKind('adviesvergoeding');
  renderBrokerInfo();
  renderAdviceKpis(detailRows);
  const producerRows = producerTotals.map(r => `<tr><td>${esc(r.Prodnr)}</td><td>${esc(r.ProducentNaam)}</td><td>${euro.format(n(r.AdviesbasisGewogen))}</td><td>${euro.format(n(r.Adviesvergoeding))}</td></tr>`).join('');
  const pijlerRows = data.filter(r => r.Niveau === 'Pijler').map(r => `<tr><td>${esc(r.Prodnr)}</td><td>${esc(r.Pijler)}</td><td>${euro.format(n(r.AdviesbasisGewogen))}</td><td>${euro.format(n(r.Adviesvergoeding))}</td></tr>`).join('');
  const metaHtml = [
    first.TypePartner ? `<li><b>Type partner</b>: ${esc(first.TypePartner)}</li>` : '',
    first.AMLife ? `<li><b>AM Life</b>: ${esc(first.AMLife)}</li>` : '',
    first.AMNonLife ? `<li><b>AM Non-Life</b>: ${esc(first.AMNonLife)}</li>` : '',
    first.EBS ? `<li><b>EBS</b>: ${esc(first.EBS)}</li>` : '',
    first.CDR ? `<li><b>CDR</b>: ${esc(first.CDR)}</li>` : ''
  ].filter(Boolean).join('');
  $('insightSummary').classList.remove('hidden');
  const producerTabs = producerList.map(p => `<button type="button" class="adviceTabBtn" data-advice-tab="producer-${esc(p.prodnr)}" onclick="showAdviceTab('producer-${esc(p.prodnr)}')">${esc(p.prodnr)}</button>`).join('');
  const producerPanels = producerList.map(p => {
    const rows = detailRows.filter(r => String(r.Prodnr || '') === String(p.prodnr));
    const title = `${p.prodnr}${p.name ? ' ' + p.name : ''}`;
    return `<div class="advicePanel hidden" data-advice-panel="producer-${esc(p.prodnr)}"><div class="note">Detailregels gevonden voor deze producent: ${num.format(rows.length)}.</div>${adviceExtractedAmountsHtml(rows, title)}</div>`;
  }).join('');
  $('insightSummary').innerHTML = `<div id="insightSummaryExport" class="insightSummaryExport"><div class="insightGrid"><div class="insightItem" style="grid-column:1/-1"><div class="adviceTabs"><button type="button" class="adviceTabBtn active" data-advice-tab="total" onclick="showAdviceTab('total')">Totaal</button>${producerTabs}</div><div class="advicePanel" data-advice-panel="total"><div class="note">Detailregels gevonden: ${num.format(detailRows.length)}. Totaalregels gevonden: ${num.format(data.filter(r => String(r.Niveau || '').trim() && String(r.Niveau || '').trim() !== 'Detail').length)}.</div>${adviceExtractedAmountsHtml(data, `Totaal op groepsnr ${first.Groepsnummer || '-'}`)}</div>${producerPanels}</div></div></div>`;
  formatDisplayedPeriods();
  triggerMotionRefresh($('samenvatting'));
}

function build(data) {
  setDashboardKind('life');
  applyLifeDashboardLabels();
  const prodM = mainRows(data, 'PRODUCTIE');
  if (!prodM.length) throw new Error(currentLang === 'fr' ? 'aucune catégorie principale production trouvée' : 'geen productie-hoofdcategorieën gevonden waarbij Hoofdcategorie = Subcategorie');
  const [prevP, currP] = latestMonthPair(prodM);
  const prodCatsRows = categoryRows(data, 'PRODUCTIE');
  const cats = [...new Set(prodCatsRows.filter(r => r[cols.periode] === currP).map(r => r[cols.hoofd]))];
  const totalProdPrev = totalRow(data, 'PRODUCTIE', prevP), totalProdCurr = totalRow(data, 'PRODUCTIE', currP);
  if (!totalProdCurr[cols.hoofd]) throw new Error(`geen TOTAAL LEVEN-rij gevonden voor PRODUCTIE ${currP}`);
  $('dashboard').classList.remove('hidden');
  applyDashboardDisplayModes();
  renderBrokerInfo();
  renderImportControl(data, currP);
  ['prodSub', 'vervalSub', 'transSub', 'progSub', 'detailSub'].forEach(id => $(id).textContent = msg('comparison', prevP, currP));
  $('portefeuilleSub').textContent = msg('portefeuilleSub', prevP, currP);
  dashboardPreviousPeriod = prevP;
  dashboardCurrentPeriod = currP;
  updateSectionPeriodInline(prevP, currP);
  lastKpiContext = {
    summary: summaryKpiItems(totalProdPrev, totalProdCurr, data, prevP, currP),
    prevP,
    currP
  };
  updateTopKpisForActiveTab();
  renderInsightSummary(data, prevP, currP);
  renderProductieGrouped(data, prevP, currP);
  renderVervalGrouped(data, prevP, currP);
  renderTransformatieGrouped(data, prevP, currP);
  $('progGrouped').innerHTML = '';
  renderPortefeuille(data, prevP, currP);
  renderDetails(data, cats, [], prevP, currP);
  dashboardPreviousPeriod = prevP;
  dashboardCurrentPeriod = currP;
  renderActivePie(data, currP);
  formatDisplayedPeriods();
  triggerMotionRefresh();
}

function signedPct(d) { return `${d >= 0 ? '+' : ''}${pct.format(d)}%`; }

// ─── Uitlijning van de samenvattingsblokken ──────────────────────────────────
function equalizeSummaryRows() {
  const grid = document.querySelector('#insightSummary .insightGrid');
  if (!grid) return;
  const items = Array.from(grid.querySelectorAll('.insightItem'));
  if (!items.length) return;

  items.forEach(item => {
    item.style.minHeight = '';
    const p = item.querySelector('p');
    const trendWrap = item.querySelector('.insightTrendBoxes');
    const trendBox = item.querySelector('.insightTrendBox');
    if (p) p.style.minHeight = '';
    if (trendWrap) trendWrap.style.minHeight = '';
    if (trendBox) trendBox.style.minHeight = '';
  });

  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
  const groups = columns >= 2 ? [[0, 1], [2, 3]] : items.map((_, i) => [i]);

  groups.forEach(group => {
    const rowItems = group.map(i => items[i]).filter(Boolean);
    if (!rowItems.length) return;

    const maxText = Math.max(...rowItems.map(item => item.querySelector('p')?.scrollHeight || 0));
    rowItems.forEach(item => {
      const p = item.querySelector('p');
      if (p && maxText) p.style.minHeight = maxText + 'px';
    });

    const maxTrend = Math.max(...rowItems.map(item => item.querySelector('.insightTrendBox')?.scrollHeight || 0));
    rowItems.forEach(item => {
      const trendWrap = item.querySelector('.insightTrendBoxes');
      const trendBox = item.querySelector('.insightTrendBox');
      if (trendWrap && maxTrend) trendWrap.style.minHeight = maxTrend + 'px';
      if (trendBox && maxTrend) trendBox.style.minHeight = maxTrend + 'px';
    });
  });
}

window.addEventListener('resize', () => {
  window.clearTimeout(window.__summaryEqualizeTimer);
  window.__summaryEqualizeTimer = window.setTimeout(equalizeSummaryRows, 120);
});

function scrollToKpiStart() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function activeTabId() {
  return document.querySelector('.tab.active')?.dataset?.tab || 'samenvatting';
}

function findMainCategoryRow(data, type, cat, period) {
  const target = normKey(cat);
  const p = String(period || '').trim();
  return mainRows(data, type).find(r => String(r[cols.periode] || '').trim() === p && normKey(r[cols.hoofd]) === target) || {};
}

function updateTopKpisForActiveTab() {
  if (!lastKpiContext || !lastData || !dashboardPreviousPeriod || !dashboardCurrentPeriod) return;
  const tab = activeTabId();
  if (tab === 'samenvatting' || tab === 'detail') {
    renderKpis(lastKpiContext.summary, dashboardPreviousPeriod, dashboardCurrentPeriod);
    return;
  }
  const items = categoryKpiItems(lastData, tab, dashboardPreviousPeriod, dashboardCurrentPeriod);
  renderKpis(items && items.length ? items : lastKpiContext.summary, dashboardPreviousPeriod, dashboardCurrentPeriod);
}

function kpiSpDeltaText(prev, curr) {
  const diff = ppDelta(prev, curr);
  return `${diff >= 0 ? '+' : ''}${pct.format(diff)}%`;
}
function kpiSpDeltaLine(prev, curr, prevP) {
  return `${kpiSpDeltaText(prev, curr)} ${msg('vs')} ${fmtPeriod(prevP)} (${pct.format(n(prev))}%)`;
}
function animateKpiNumbers() {
  if (motionIsReduced() || document.body.classList.contains('pdfExportBusy')) return;
  document.querySelectorAll('#kpis .value').forEach(el => {
    const text = el.childNodes[0]?.textContent || el.textContent || '';
    const match = text.match(/^(.*?)([-+]?)(?:€\s*)?(\d[\d.\s]*(?:,\d+)?)(.*)$/);
    if (!match) return;
    const hasEuro = text.includes('€');
    const prefix = match[1] || '';
    const sign = match[2] === '-' ? -1 : 1;
    const raw = match[3].replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const suffix = match[4] || '';
    const target = sign * Number(raw);
    if (!Number.isFinite(target)) return;
    const decimals = (match[3].split(',')[1] || '').length;
    const duration = 620;
    const start = performance.now();
    const formatValue = value => {
      const abs = Math.abs(value);
      const formatted = decimals
        ? abs.toLocaleString('nl-BE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : Math.round(abs).toLocaleString('nl-BE');
      const signText = value < 0 ? '-' : (match[2] === '+' ? '+' : '');
      return hasEuro ? `${prefix}${signText}€ ${formatted}${suffix}` : `${prefix}${signText}${formatted}${suffix}`;
    };
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.childNodes[0].textContent = formatValue(target * eased);
      if (t < 1) requestAnimationFrame(step);
      else el.childNodes[0].textContent = text;
    };
    requestAnimationFrame(step);
  });
}

function lifeKpiComparisonHtml(item, prevP, currP) {
  if (item.o == null || item.v == null) return '';
  const previous = n(item.o), current = n(item.v);
  const maximum = Math.max(1, Math.abs(previous), Math.abs(current));
  const type = item.type || 'money';
  const line = (period, value, kind) => `<div class="kpiCompareLine"><div class="kpiComparePeriod">${esc(fmtPeriod(period))}</div><div class="kpiCompareTrack"><div class="kpiCompareFill ${kind}" style="width:${Math.abs(value) / maximum * 100}%"></div></div><div class="kpiCompareAmount">${fmt(value, type)}</div></div>`;
  const difference = current - previous;
  const sign = difference > 0 ? '+' : difference < 0 ? '-' : '';
  const delta = type === 'pct' ? `${sign}${pct.format(Math.abs(difference))}% ptn` : `${sign}${fmt(Math.abs(difference), type)}`;
  return `<div class="kpiCompare">${line(currP, current, 'curr')}${line(prevP, previous, 'prev')}<div class="kpiCompareBubble ${cls(difference, item.invert)}">Δ ${delta}</div></div>`;
}
function renderKpis(items, prevP, currP) {
  const kpiBox = $('kpis');
  const pillarOrdinals = { tweede: '2e', derde: '3e', vierde: '4e', 'deuxième':'2e', 'troisième':'3e', 'quatrième':'4e' };
  if (kpiBox) kpiBox.classList.toggle('summaryPremiumGroup', !!(items && items[0] && items[0].kpiRole === 'summary-total'));
  $('kpis').innerHTML = items.map((x, i) => {
    const title = x.showPeriodInLabel === false ? `${displayLabel(x.metricLabel || x.l)} ${displayLabel(x.l)}` : displayLabel(x.l);
    const titleLabel = title.replace(/\b(tweede|derde|vierde|deuxième|troisième|quatrième)(?=\s+(?:pijler|pilier)\b)/gi, ordinal => pillarOrdinals[ordinal.toLowerCase()]);
    const label = `<span>${esc(titleLabel)}</span><span class="kpi-period">ULT. ${esc(currP)}</span>`;
    const cardClass = 'kpi' + (x.dynamicCategory ? ' dynamicCategoryKpi' : '') + (x.kpiRole === 'summary-total' ? ' summaryTotalKpi' : '') + (x.kpiRole === 'summary-component' ? ' summaryComponentKpi' : '');
    const kpiAttrs = x.dynamicCategory ? ` data-kpi-cat="${esc(x.l)}" role="button" tabindex="0"` : '';

    if (x.type === 'sp-category') {
      const d = ppDelta(x.o, x.v);
      return `<div class="${cardClass}"${kpiAttrs}><div class="label">${label}</div><div class="value">S/P ${pct.format(x.v)}%</div><div class="delta ${cls(d, x.invert)}">${kpiSpDeltaLine(x.o, x.v, prevP)}</div></div>`;
    }

    if (x.type === 'pct-combo-plain') {
      const spClass = x.v <= x.o ? 'pos' : 'neg';
      const spCapClass = x.v2 <= x.o2 ? 'pos' : 'neg';
      return `<div class="${cardClass}"${kpiAttrs}><div class="label">${label}</div><div class="value">S/P ${pct.format(x.v)}%</div><div class="delta ${spClass}">S/P ${kpiSpDeltaLine(x.o, x.v, prevP)}</div><div class="delta ${spCapClass}">${msg('spAfgetopt')} ${kpiSpDeltaLine(x.o2, x.v2, prevP)}</div></div>`;
    }

    if (x.type === 'pct-combo') {
      const d = ppDelta(x.o, x.v);
      const d2 = ppDelta(x.o2, x.v2);
      return `<div class="${cardClass}"${kpiAttrs}><div class="label">${label}</div><div class="value">S/P ${pct.format(x.v)}%<span class="kpi-subvalue">(${pct.format(x.v2)}% ${msg('spAfgetopt').toLowerCase().replace('s/p ', '')})</span></div><div class="delta ${cls(d, x.invert)}">S/P ${kpiSpDeltaLine(x.o, x.v, prevP)}</div><div class="delta ${cls(d2, x.invert)}">${msg('spAfgetopt')} ${kpiSpDeltaLine(x.o2, x.v2, prevP)}</div></div>`;
    }

    if (x.type === 'detail-combo') {
      return `<div class="${cardClass}"${kpiAttrs}><div class="label">${label}</div><div class="value">${fmt(x.v, 'money')}</div><div class="delta neu">S/P ${pct.format(x.sp)}%</div><div class="delta neu">${msg('spAfgetopt')} ${pct.format(x.spCap)}%</div></div>`;
    }

    const d = x.type === 'pct' ? ppDelta(x.o, x.v) : yoy(x.o, x.v);
    if (x.type === 'pct') {
      return `<div class="${cardClass}"${kpiAttrs}><div class="label">${label}</div><div class="value">${fmt(x.v, x.type)}</div><div class="delta ${cls(d, x.invert)}">${d >= 0 ? '+' : ''}${pct.format(d)}% ${msg('vs')} ${fmtPeriod(prevP)} (${pct.format(n(x.o))}%)</div>${lifeKpiComparisonHtml(x, prevP, currP)}</div>`;
    }
    const amountDelta = x.v - x.o;
    const showPreviousAmount = x.compareAmountMode === 'previous';
    const amountText = showPreviousAmount ? fmt(x.o, x.type) : (x.dynamicCategory ? fmt(amountDelta, x.type) : fmt(x.o, x.type));
    const amountPrefix = (!showPreviousAmount && x.dynamicCategory && amountDelta > 0) ? '+' : '';
    return `<div class="${cardClass}"${kpiAttrs}><div class="label">${label}</div><div class="value">${fmt(x.v, x.type)}</div><div class="delta ${cls(d, x.invert)}">${d >= 0 ? '+' : ''}${pct.format(d)}% ${msg('vs')} ${prevP} <span style="opacity:.7">(${amountPrefix}${amountText})</span></div>${lifeKpiComparisonHtml(x, prevP, currP)}</div>`;
  }).join('');
  animateKpiNumbers();
}

function plainTextFromHtml(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
function spThresholdForLabel(label, parentLabel = '') {
  const t = (plainTextFromHtml(label) + ' ' + plainTextFromHtml(parentLabel)).toLowerCase();
  // Evenwichtspercentages gelden voor de hoofdcategorie én alle onderliggende subcategorieën.
  if (/auto|flottes|vloten|non flottes|niet vloten/.test(t)) return 43.9;
  if (/particulieren|particuliers/.test(t)) return 28;
  if (/ondernemingen|entreprises/.test(t)) return 28.8;
  if (/arbeidsongevallen|accidents de travail/.test(t)) return 32.7;
  return null;
}
function spVisualClass(value) {
  const v = Number(value) || 0;
  return v < 0 ? 'sp-left' : 'sp-right';
}
function isTotalSpLabel(label) {
  const t = plainTextFromHtml(label).toLowerCase();
  return /totaal non life|total non vie|total non life/.test(t);
}
function spValueClass(value, threshold, label) {
  // Geen evenwichtskleur meer op tekstuele S/P-percentages.
  // Enkel extreme waarden blijven visueel aangeduid: >100% rood, <0% groen.
  if (isTotalSpLabel(label)) return '';
  const v = Number(value);
  if (!Number.isFinite(v)) return '';
  if (v > 100) return 'neg';
  if (v < 0) return 'pos';
  return '';
}

function barCompareHtml(labels, a, b, la, lb, type, color, parentCategory = '', options = {}) {
  const isPct = type === 'pct';

  if (isPct) {
    // Vaste schaal: elke helft = 0–100%. Balkkleur blijft periodegebonden; waarden >100% krijgen een rode invulling.
    // Alleen extreme procenttekst rechts krijgt kleur: <0% groen, >100% rood.
    const line = (period, value, periodClass, threshold, label, delta = '') => {
      const v = Number(value) || 0;
      const width = Math.min(50, Math.abs(v) / 100 * 50);
      const fillClass = spVisualClass(v);
      const valClass  = spValueClass(v, threshold, label);
      const hasOverflow = v > 100 || v < 0;
      return `<div class="barline progressLine"><div class="period">${period}</div><div class="progressTrack"><div class="progressFill ${fillClass} ${periodClass}" style="width:${width}%"></div></div><div class="barDeltaSlot">${delta}</div><div class="value ${valClass}">${fmt(v, type)}</div></div>`;
    };
    return `<div class="bars">` + labels.map((l, i) => {
      const threshold = spThresholdForLabel(l, parentCategory);
      const delta = options.showDelta ? (options.absolutePctDelta ? barAbsolutePctDeltaTextHtml(a[i], b[i], !!options.invertDelta) : barDeltaTextHtml(a[i], b[i], !!options.invertDelta)) : '';
      return `<div class="barrow"><div class="barlabel">${l}</div><div class="bararea">${line(la, a[i], 'prevPeriod', threshold, l)}${line(lb, b[i], 'currPeriod', threshold, l, delta)}</div></div>`;
    }).join('') + `</div>`;
  }

  // Standaard: relatief tov maximum
  const history = options.previousYears || [];
  const max = Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs), ...history.flatMap(year => year.values.map(Math.abs)));
  return `<div class="bars">` + labels.map((l, i) => {
    const line = (period, value, fillClass, delta = '', rowClass = '') => {
      const count = options.caseCount?.(period, i);
      const countLabel = count == null ? '' : ` <span class="barCaseCount">(# ${num.format(count)})</span>`;
      return `<div class="barline${rowClass}"><div class="period">${fmtPeriod(period)}</div><div class="track"><div class="fill ${fillClass}" style="width:${Math.abs(value) / max * 100}%"></div></div><div class="barDeltaSlot">${delta}</div><div class="value">${fmt(value, type)}${countLabel}</div></div>`;
    };
    const countClass = options.caseCount ? ' withCaseCounts' : '';
    if (options.showPreviousYears || options.comparisonBadges) {
      const years = history.filter(year => year.values[i] !== null).reverse();
      const yearLines = years.map((year, index) => {
        const older = years[index + 1]?.values[i];
        const delta = older ? historyComparisonHtml(yoy(older, year.values[i]), options.invertDelta) : '';
        return line(year.period, year.values[i], '', delta, ' previousYearLine');
      });
      const delta = options.showDelta ? historyComparisonHtml(yoy(a[i], b[i]), options.invertDelta) : '';
      return `<div class="barrow"><div class="barlabel">${l}</div><div class="bararea withComparisonBadges${countClass}">${line(lb, b[i], 'currPeriod')}${line(la, a[i], 'prevPeriod', delta)}${yearLines.join('')}</div></div>`;
    }
    const delta = options.showDelta ? (options.absolutePctDelta ? barAbsolutePctDeltaTextHtml(a[i], b[i], !!options.invertDelta) : barDeltaTextHtml(a[i], b[i], !!options.invertDelta)) : '';
    return `<div class="barrow"><div class="barlabel">${l}</div><div class="bararea${countClass}">${line(la, a[i], 'prevPeriod')}${line(lb, b[i], 'currPeriod', delta)}</div></div>`;
  }).join('') + `</div>`;
}

// ─── Categorienamen en gedeelde grafiekhulpen ───────────────────────────────

function normKey(v) { return String(v || '').trim().toUpperCase().replace(/\s+/g, ' '); }

function drawPortfolioPie(canvas, period, items, hoverIndex = -1, centerText = null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,w,h);
  const total = items.reduce((s,x) => s + x.value, 0);
  const cx = Math.round(w * .50), cy = Math.round(h * .52), radius = Math.min(w, h) * .44;
  if (!total) {
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.strokeStyle = '#e6eef7'; ctx.lineWidth = 26; ctx.stroke();
    ctx.fillStyle = '#8fa3ba'; ctx.font = '700 15px Lato,Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg('portefeuilleEmpty'), cx, cy);
    canvas._portfolioPieState = { segments: [], total: 0 };
    return;
  }
  let start = -Math.PI / 2;
  const segments = [];
  items.forEach((item, i) => {
    const angle = item.value / total * Math.PI * 2;
    const end = start + angle;
    if (i !== hoverIndex) drawGradientPieSegment(ctx, cx, cy, radius, start, end, item.color, { strokeWidth: 3 });
    segments.push({ ...item, start, end, total });
    start = end;
  });
  if (hoverIndex >= 0 && segments[hoverIndex]) {
    const seg = segments[hoverIndex];
    drawGradientPieSegment(ctx, cx, cy, radius, seg.start, seg.end, seg.color, { offset: 8, strokeWidth: 4 });
  }
  drawPieCenter(ctx, cx, cy, radius, centerText || msg('verdiendePremie'), fmtPeriod(period), .92);
  canvas._portfolioPieState = { segments, total, cx, cy, radius, period, hoverIndex, centerText: centerText || msg('verdiendePremie') };
}
function renderPortfolioPieLegend(el, items) {
  const total = items.reduce((s,x) => s + x.value, 0);
  if (!el) return;
  if (!items.length || !total) { el.innerHTML = `<div class="pieEmpty">${msg('portefeuilleEmpty')}</div>`; return; }
  el.innerHTML = items.map((item, i) => {
    const share = item.value / total * 100;
    return `<div class="pieLegendItem" data-pie-index="${i}"><span class="pieSwatch" style="background:${item.color}"></span><div class="pieLegendName">${esc(item.label)}<span class="pieLegendPct">${pct.format(share)}%</span></div><div class="pieLegendValue">${euro.format(item.value)}</div></div>`;
  }).join('');
}

function attachPieLegendHover(legendEl, canvas, tooltipId = 'portfolioPieTooltip') {
  if (!legendEl || !canvas || legendEl._pieLegendHoverAttached) return;
  legendEl._pieLegendHoverAttached = true;
  const sourceItems = state => (state?.segments || []).map(({key, label, value, color}) => ({key, label, value, color}));
  const segmentClientPoint = (state, seg) => {
    const rect = canvas.getBoundingClientRect();
    const mid = (seg.start + seg.end) / 2;
    const r = state.radius * .68;
    const x = state.cx + Math.cos(mid) * r;
    const y = state.cy + Math.sin(mid) * r;
    return {
      x: rect.left + (x / canvas.width) * rect.width,
      y: rect.top + (y / canvas.height) * rect.height
    };
  };
  const showFromLegend = (idx) => {
    const state = canvas._portfolioPieState;
    const tooltip = $(tooltipId || canvas.dataset.tooltipId || 'portfolioPieTooltip');
    if (!state || !state.total || idx < 0 || !state.segments[idx]) return;
    drawPortfolioPie(canvas, state.period, sourceItems(state), idx, state.centerText);
    const freshState = canvas._portfolioPieState;
    const seg = freshState.segments[idx];
    if (tooltip) {
      if (tooltip.id === 'summaryProductionMixTooltip' && tooltip.parentElement !== document.body) document.body.appendChild(tooltip);
      const pnt = segmentClientPoint(freshState, seg);
      tooltip.innerHTML = `<strong>${esc(seg.label)}</strong><span class="muted">${euro.format(seg.value)} · ${pct.format(seg.value / freshState.total * 100)}%</span>`;
      positionPieTooltip(tooltip, pnt.x, pnt.y);
    }
    canvas.style.cursor = 'pointer';
  };
  const clearLegendHover = () => {
    const tooltip = $(tooltipId || canvas.dataset.tooltipId || 'portfolioPieTooltip');
    if (tooltip) tooltip.style.display = 'none';
    const state = canvas._portfolioPieState;
    canvas.style.cursor = '';
    if (state) drawPortfolioPie(canvas, state.period, sourceItems(state), -1, state.centerText);
  };
  legendEl.addEventListener('mouseover', e => {
    const item = e.target.closest('.pieLegendItem[data-pie-index]');
    if (!item || !legendEl.contains(item)) return;
    showFromLegend(Number(item.dataset.pieIndex));
  });
  legendEl.addEventListener('mouseout', e => {
    if (legendEl.contains(e.relatedTarget)) return;
    clearLegendHover();
  });
}
function positionPieTooltip(tooltip, x, y) {
  if (!tooltip) return;
  tooltip.style.position = 'fixed';
  tooltip.style.display = 'block';
  const margin = 12;
  const gap = 14;
  const w = tooltip.offsetWidth || 180;
  const h = tooltip.offsetHeight || 54;
  const left = Math.min(Math.max(margin, x + gap), window.innerWidth - w - margin);
  const top = Math.min(Math.max(margin, y + gap), window.innerHeight - h - margin);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}
function attachPortfolioPieHover(canvas) {
  if (!canvas || canvas._portfolioPieHoverAttached) return;
  canvas._portfolioPieHoverAttached = true;
  const normalizePieAngle = a => {
    while (a < -Math.PI / 2) a += Math.PI * 2;
    while (a >= Math.PI * 1.5) a -= Math.PI * 2;
    return a;
  };
  const hitTestPortfolioPie = (state, mx, my) => {
    if (!state || !state.total || !state.segments || !state.segments.length) return -1;
    const dx = mx - state.cx, dy = my - state.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > state.radius) return -1;
    let angle = normalizePieAngle(Math.atan2(dy, dx));
    return state.segments.findIndex(seg => {
      let start = normalizePieAngle(seg.start);
      let end = seg.end;
      while (end < start) end += Math.PI * 2;
      let a = angle;
      if (a < start) a += Math.PI * 2;
      return a >= start && a <= end;
    });
  };
  const sourceItems = state => (state?.segments || []).map(({key, label, value, color}) => ({key, label, value, color}));
  canvas.addEventListener('mousemove', e => {
    const state = canvas._portfolioPieState;
    const tooltip = $(canvas.dataset.tooltipId || 'portfolioPieTooltip');
    if (!state || !state.total || !tooltip) return;
    if (tooltip.id === 'summaryProductionMixTooltip' && tooltip.parentElement !== document.body) document.body.appendChild(tooltip);
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const idx = hitTestPortfolioPie(state, mx, my);
    if (idx >= 0) {
      if (state.hoverIndex !== idx) drawPortfolioPie(canvas, state.period, sourceItems(state), idx, state.centerText);
      const freshState = canvas._portfolioPieState;
      const seg = freshState.segments[idx];
      tooltip.innerHTML = `<strong>${esc(seg.label)}</strong><span class="muted">${euro.format(seg.value)} · ${pct.format(seg.value / freshState.total * 100)}%</span>`;
      positionPieTooltip(tooltip, e.clientX, e.clientY);
      canvas.style.cursor = 'pointer';
    } else {
      tooltip.style.display = 'none';
      canvas.style.cursor = '';
      if (state.hoverIndex !== -1) drawPortfolioPie(canvas, state.period, sourceItems(state), -1, state.centerText);
    }
  });
  canvas.addEventListener('mouseleave', () => {
    const tooltip = $(canvas.dataset.tooltipId || 'portfolioPieTooltip');
    if (tooltip) tooltip.style.display = 'none';
    const state = canvas._portfolioPieState;
    canvas.style.cursor = '';
    if (state && state.hoverIndex !== -1) drawPortfolioPie(canvas, state.period, sourceItems(state), -1, state.centerText);
  });
}

function pieSegmentColor(key, index = 0) {
  const palette = {
    'Auto': '#f58220',
    'Auto Vloten': '#f58220',
    'Auto Niet Vloten': '#ffad5c',
    'Particulieren': '#009b77',
    'Particulieren Brand': '#008f73',
    'Particulieren BA': '#39b995',
    'Particulieren Overige': '#7bd3bd',
    'Ondernemingen': '#003b71',
    'Ondernemingen Brand': '#003b71',
    'Ondernemingen BA': '#1f6fb2',
    'Ondernemingen Overige': '#8fb4dc',
    'Overige': '#9aa7b5',
    'Arbeidsongevallen': '#6f5bb8',
    'Rechtsbijstand': '#c84f2b'
  };
  const fallback = ['#f58220','#009b77','#003b71','#9aa7b5','#6f5bb8','#c84f2b'];
  return palette[key] || fallback[index % fallback.length];
}
function clampColorChannel(v) { return Math.max(0, Math.min(255, Math.round(v))); }
function shadeHexColor(hex, percent) {
  const raw = String(hex || '').replace('#','').trim();
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return hex || '#003b71';
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const target = percent >= 0 ? 255 : 0, amt = Math.abs(percent) / 100;
  const nr = clampColorChannel(r + (target - r) * amt), ng = clampColorChannel(g + (target - g) * amt), nb = clampColorChannel(b + (target - b) * amt);
  return '#' + ((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1);
}
function pieGradient(ctx, cx, cy, radius, color) {
  const g = ctx.createRadialGradient(cx, cy, radius * .50, cx, cy, radius);
  g.addColorStop(0, shadeHexColor(color, -24));
  g.addColorStop(.56, color);
  g.addColorStop(1, shadeHexColor(color, 13));
  return g;
}
function drawGradientPieSegment(ctx, cx, cy, radius, start, end, color, opts = {}) {
  const mid = (start + end) / 2, offset = opts.offset || 0, ox = Math.cos(mid) * offset, oy = Math.sin(mid) * offset;
  if (offset) { ctx.save(); ctx.shadowColor = 'rgba(15,23,42,.20)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; }
  ctx.beginPath(); ctx.moveTo(cx + ox, cy + oy); ctx.arc(cx + ox, cy + oy, radius, start, end); ctx.closePath();
  ctx.fillStyle = pieGradient(ctx, cx + ox, cy + oy, radius, color); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = opts.strokeWidth || 3; ctx.lineJoin = 'round'; ctx.stroke();
  if (offset) ctx.restore();
}
function drawPieCenter(ctx, cx, cy, radius, mainText, subText, fontScale = 1) {
  ctx.beginPath(); ctx.arc(cx, cy, radius * .52, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.strokeStyle = '#c5d6e5'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#0d1473';
  ctx.font = `900 ${Math.round(18 * fontScale)}px Lato,Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(mainText || '', cx, cy - 9 * fontScale);
  ctx.font = `800 ${Math.round(18 * fontScale)}px Lato,Arial`; ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#62748a'; ctx.fillText(subText || '', cx, cy + 13 * fontScale);
}

// ─── Hulpfuncties voor detail-categorieblokken ────────────────────────────────
function catPillHtml(s, cat) {
  return categoryRowLabelHtml(s, cat);
}
function lifeDeltaCell(prevValue, currValue, invert = false) {
  const d = yoy(n(prevValue), n(currValue));
  return pctText(d, invert);
}
function renderLifeCat(cat, prodRows, portRows, prevP, currP) {
  const pRows = prodRows.filter(r => r[cols.hoofd] === cat);
  const pfRows = portRows.filter(r => r[cols.hoofd] === cat);
  const subs = [...new Set([...pRows, ...pfRows].map(r => r[cols.sub]).filter(Boolean))];
  const head = pRows.find(r => r[cols.sub] === cat && r[cols.periode] === currP) || {};
  const pfHead = pfRows.find(r => r[cols.sub] === cat && r[cols.periode] === currP) || {};
  const summary = [
    metricBlock('Premie productie', euro.format(n(head[cols.prodPremie]))),
    metricBlock('Premie koopsom', euro.format(n(head[cols.premieKoopsom]))),
    metricBlock('Premie verhoging', euro.format(n(head[cols.premieVerhoging])))
  ].join('');

  const prodHead = `<tr>
    <th>${msg('categorie')}</th>
    <th>${escLabel('Aantal prod.')} ${prevP}</th><th>${escLabel('Aantal prod.')} ${currP}</th><th>${escLabel('Δ aantal')}</th>
    <th>${escLabel('Premie prod.')} ${prevP}</th><th>${escLabel('Premie prod.')} ${currP}</th><th>${escLabel('Δ prod.')}</th>
    <th>${escLabel('Koopsom')} ${prevP}</th><th>${escLabel('Koopsom')} ${currP}</th><th>${escLabel('Δ koopsom')}</th>
    <th>${escLabel('Verhoging')} ${prevP}</th><th>${escLabel('Verhoging')} ${currP}</th><th>${escLabel('Δ verhoging')}</th>
  </tr>`;
  const prodBody = subs.map(s => {
    const a = pRows.find(r => r[cols.sub] === s && r[cols.periode] === prevP) || {};
    const b = pRows.find(r => r[cols.sub] === s && r[cols.periode] === currP) || {};
    return `<tr>
      <td>${catPillHtml(s, cat)}</td>
      <td>${num.format(n(a[cols.prodAantal]))}</td>
      <td>${num.format(n(b[cols.prodAantal]))}</td>
      <td>${lifeDeltaCell(a[cols.prodAantal], b[cols.prodAantal])}</td>
      <td>${euro.format(n(a[cols.prodPremie]))}</td>
      <td>${euro.format(n(b[cols.prodPremie]))}</td>
      <td>${lifeDeltaCell(a[cols.prodPremie], b[cols.prodPremie])}</td>
      <td>${euro.format(n(a[cols.premieKoopsom]))}</td>
      <td>${euro.format(n(b[cols.premieKoopsom]))}</td>
      <td>${lifeDeltaCell(a[cols.premieKoopsom], b[cols.premieKoopsom])}</td>
      <td>${euro.format(n(a[cols.premieVerhoging]))}</td>
      <td>${euro.format(n(b[cols.premieVerhoging]))}</td>
      <td>${lifeDeltaCell(a[cols.premieVerhoging], b[cols.premieVerhoging])}</td>
    </tr>`;
  }).join('');

  const portHead = `<tr>
    <th>${msg('categorie')}</th>
    <th>${escLabel('Polissen port.')} ${prevP}</th><th>${escLabel('Polissen port.')} ${currP}</th><th>${escLabel('Δ polissen')}</th>
    <th>${escLabel('Portefeuillepremie')} ${prevP}</th><th>${escLabel('Portefeuillepremie')} ${currP}</th><th>${escLabel('Δ port.')}</th>
    <th>${escLabel('Reserves')} ${prevP}</th><th>${escLabel('Reserves')} ${currP}</th><th>${escLabel('Δ reserves')}</th>
  </tr>`;
  const portBody = subs.map(s => {
    const a = pfRows.find(r => r[cols.sub] === s && r[cols.periode] === prevP) || {};
    const b = pfRows.find(r => r[cols.sub] === s && r[cols.periode] === currP) || {};
    return `<tr>
      <td>${catPillHtml(s, cat)}</td>
      <td>${num.format(n(a[cols.polissenPortefeuille]))}</td>
      <td>${num.format(n(b[cols.polissenPortefeuille]))}</td>
      <td>${lifeDeltaCell(a[cols.polissenPortefeuille], b[cols.polissenPortefeuille])}</td>
      <td>${euro.format(n(a[cols.portefeuillepremie]))}</td>
      <td>${euro.format(n(b[cols.portefeuillepremie]))}</td>
      <td>${lifeDeltaCell(a[cols.portefeuillepremie], b[cols.portefeuillepremie])}</td>
      <td>${euro.format(n(a[cols.reserves]))}</td>
      <td>${euro.format(n(b[cols.reserves]))}</td>
      <td>${lifeDeltaCell(a[cols.reserves], b[cols.reserves])}</td>
    </tr>`;
  }).join('');

  const body = [
    `<div class="split">${summary}</div>`,
    `<h3 class="lifeDetailSubheading">${msg('prodTitle')}</h3>`,
    `<table class="summary-table lifeDetailTable"><thead>${prodHead}</thead><tbody>${prodBody}</tbody></table>`,
    `<h3 class="lifeDetailSubheading">${msg('portefeuilleTitle')}</h3>`,
    `<table class="summary-table lifeDetailTable"><thead>${portHead}</thead><tbody>${portBody}</tbody></table>`
  ].join('');
  return catContainer(cat, `${prevP} → ${currP}`, body);
}
function metricBlock(label, valueHtml) {
  return `<div class="metric"><b>${escLabel(label)}</b><span class="metric-val">${valueHtml}</span></div>`;
}
function catContainer(cat, headRight, bodyHtml) {
  return [
    `<div class="cat">`,
      `<div class="catHead exportableBlockHeader">`,
        `<div class="catTitle">${catTitleHtml(cat)}</div>`,
        `<div class="small">${headRight}</div>`,
        productBlockExportActionsHtml(),
      `</div>`,
      `<div class="p-18">${bodyHtml}</div>`,
    `</div>`
  ].join('');
}

// ─── Life-tabbladen, samenvatting en verdelingen ────────────────────────────
function lifeMainCats(data, type, period) {
  return mainRows(data, type).filter(r => String(r[cols.periode] || '').trim() === String(period).trim() && !isTotalNonLife(r)).map(r => r[cols.hoofd]).filter((v, i, a) => v && a.indexOf(v) === i);
}

function lifeRowHasData(r) {
  const fields = r && r[cols.type] === 'PORTEFEUILLE'
    ? [cols.polissenPortefeuille, cols.polissenPremiebetalend, cols.polissenPremievrij, cols.portefeuillepremie, cols.uitgegeven, cols.reserves]
    : [cols.prodAantal, cols.prodPremie, cols.premieKoopsom, cols.vervalAantal, cols.vervalPremie, cols.vervalOnnatuurlijk, cols.vervalNatuurlijk, cols.trans, cols.premieVerhoging, cols.premieVerlaging, cols.progAantal, cols.progPremie];
  return fields.some(field => n(r && r[field]) !== 0);
}
function bestLifeRow(candidates) {
  return candidates.slice().reverse().find(lifeRowHasData) || candidates[candidates.length - 1] || {};
}
function lifePickRow(catRows, sub, period) {
  const p = String(period || '').trim();
  return bestLifeRow(catRows.filter(r => r[cols.sub] === sub && String(r[cols.periode] || '').trim() === p));
}
function lifeGroupBasics(cat, rows, prevP, currP) {
  const catRows = rows.filter(r => r[cols.hoofd] === cat);
  const ordered = orderedSubs(catRows.filter(r => [prevP, currP].includes(r[cols.periode])), cat);
  const labels = labelHtmlFor(ordered, cat);
  const row = (s, p) => lifePickRow(catRows, s, p);
  const vals = (field, period) => ordered.map(s => n(row(s, period)[field]));
  const periods = lifePreviousYearPeriods(catRows, prevP, currP);
  const bars = (field, type, cellIndex) => {
    const values = period => cellIndex === undefined
      ? vals(field, period)
      : ordered.map(sub => lifeField(row(sub, period), field, cellIndex));
    const previousYears = periods.map(period => ({
      period, values: ordered.map(sub => {
        const source = row(sub, period);
        if (!source[cols.periode]) return null;
        return lifeField(source, field, cellIndex);
      })
    }));
    return barCompareHtml(labels, values(prevP), values(currP), prevP, currP, type, 'blue', '', {showDelta:true, showPreviousYears:previousYearsMode, previousYears});
  };
  return { labels, vals, bars, head: row(cat, currP), prevHead: row(cat, prevP) };
}
function lifePreviousYearPeriods(rows, prevP, currP) {
  if (!previousYearsMode) return [];
  return [...new Set(rows.map(row => row[cols.periode]))]
    .filter(period => /^12\s+20\d{2}$/.test(period) && period !== prevP && pkey(period) < pkey(currP))
    .sort((a, b) => pkey(a) - pkey(b)).slice(-3);
}
function renderLifeGroupedSection(containerId, data, type, prevP, currP, renderGroupFn, emptyText) {
  const source = rowsOf(data, type);
  const periods = new Set([prevP, currP, ...lifePreviousYearPeriods(source, prevP, currP)]);
  const rows = source.filter(row => periods.has(row[cols.periode]));
  const totalHtml = rows.some(isTotalNonLife) ? totalBlock(renderGroupFn('TOTAAL LEVEN', rows.filter(isTotalNonLife), prevP, currP, data)) : '';
  const catHtml = lifeMainCats(data, type, currP).map(cat => renderGroupFn(cat, rows, prevP, currP, data)).join('');
  $(containerId).innerHTML = totalHtml + catHtml || `<div class="note">${escLabel(emptyText)}</div>`;
}
function applyLifeDashboardLabels() {
  const fr = currentLang === 'fr';
  setText('tabSamenvatting', fr ? 'Résumé' : 'Samenvatting');
  setText('tabProductie', fr ? 'Production' : displayLabel('Productie'));
  setText('tabVerval', fr ? 'Primes uniques' : displayLabel('Koopsommen'));
  setText('tabTransformatie', fr ? 'Augmentations' : displayLabel('Verhogingen'));
  setText('tabPortefeuille', displayLabel('Portefeuille'));
  setText('prodTitle', displayLabel('Productie'));
  setText('vervalTitle', displayLabel('Koopsommen'));
  setText('transTitle', displayLabel('Verhogingen'));
  setText('portefeuilleTitle', displayLabel('Portefeuille'));
  setText('detailTitle', displayLabel('Hoofd- en subcategorieen'));
  updateLifePdfSectionLabels();
  $('tabProgressie')?.classList.add('hidden');
  $('progressie')?.classList.add('hidden');
  if ($('tabProgressie')?.classList.contains('active')) {
    document.querySelectorAll('#dashboard .section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('#dashboard .tab').forEach(tab => tab.classList.remove('active'));
    $('samenvatting')?.classList.add('active');
    $('tabSamenvatting')?.classList.add('active');
  }
}
function renderProductieGrouped(data, prevP, currP) { renderLifeGroupedSection('prodGrouped', data, 'PRODUCTIE', prevP, currP, renderProductionGroup, msg('noProd')); }
function renderVervalGrouped(data, prevP, currP) { renderLifeGroupedSection('vervalGrouped', data, 'PRODUCTIE', prevP, currP, renderVervalGroup, 'Geen koopsommen gevonden.'); }
function renderTransformatieGrouped(data, prevP, currP) { renderLifeGroupedSection('transGrouped', data, 'PRODUCTIE', prevP, currP, renderTransformatieGroup, 'Geen verhogingen gevonden.'); }

function renderPortefeuille(data, prevP, currP) { renderLifeGroupedSection('portefeuilleCharts', data, 'PORTEFEUILLE', prevP, currP, renderPortefeuilleGroup, msg('portefeuilleEmpty')); $('portfolioPieCard')?.classList.add('hidden'); }

function renderVervalGroup(cat, rows, prevP, currP) {
  const { bars, head, prevHead } = lifeGroupBasics(cat, rows, prevP, currP);
  return `<div class="cat"><div class="catHead exportableBlockHeader"><div class="catTitle">${catTitleHtml(cat)}</div><div class="small">${prevP} &rarr; ${currP}</div>${productBlockExportActionsHtml()}</div><div class="p-18"><div class="split split-1"><div class="metric"><b>${escLabel('Premie koopsom')} ${currP}</b><span class="metric-val">${euro.format(n(head[cols.premieKoopsom]))}</span>${deltaHtml(yoy(n(prevHead[cols.premieKoopsom]), n(head[cols.premieKoopsom])), n(prevHead[cols.premieKoopsom]), prevP, 'money')}</div></div><div class="miniGrid"><div class="miniCard"><h3>${escLabel('Premie koopsom')}</h3>${bars(cols.premieKoopsom, 'money')}</div></div></div></div>`;
}
function renderTransformatieGroup(cat, rows, prevP, currP) {
  const { bars, head, prevHead } = lifeGroupBasics(cat, rows, prevP, currP);
  return `<div class="cat"><div class="catHead exportableBlockHeader"><div class="catTitle">${catTitleHtml(cat)}</div><div class="small">${prevP} &rarr; ${currP}</div>${productBlockExportActionsHtml()}</div><div class="p-18"><div class="split split-1"><div class="metric"><b>${escLabel('Premie verhoging')} ${currP}</b><span class="metric-val">${euro.format(n(head[cols.premieVerhoging]))}</span>${deltaHtml(yoy(n(prevHead[cols.premieVerhoging]), n(head[cols.premieVerhoging])), n(prevHead[cols.premieVerhoging]), prevP, 'money')}</div></div><div class="miniGrid"><div class="miniCard"><h3>${escLabel('Premie verhoging')}</h3>${bars(cols.premieVerhoging, 'money')}</div></div></div></div>`;
}

function summaryKpiItems(totalProdPrev, totalProdCurr, data, prevP, currP) {
  const portPrev = totalRow(data, 'PORTEFEUILLE', prevP), portCurr = totalRow(data, 'PORTEFEUILLE', currP);
  const prodPrev = n(totalProdPrev[cols.prodPremie]);
  const prodCurr = n(totalProdCurr[cols.prodPremie]);
  const koopsomPrev = n(totalProdPrev[cols.premieKoopsom]);
  const koopsomCurr = n(totalProdCurr[cols.premieKoopsom]);
  const verhogingPrev = n(totalProdPrev[cols.premieVerhoging]);
  const verhogingCurr = n(totalProdCurr[cols.premieVerhoging]);
  const totalPrev = prodPrev + koopsomPrev + verhogingPrev;
  const totalCurr = prodCurr + koopsomCurr + verhogingCurr;
  return [
    {l:'TOTAAL PREMIES',v:totalCurr,o:totalPrev,type:'money',kpiRole:'summary-total'},
    {l:'Premie productie',v:prodCurr,o:prodPrev,type:'money',kpiRole:'summary-component'},
    {l:'Premie koopsom',v:koopsomCurr,o:koopsomPrev,type:'money',kpiRole:'summary-component'},
    {l:'Premie verhoging',v:verhogingCurr,o:verhogingPrev,type:'money',kpiRole:'summary-component'},
    {l:'Reserves',v:lifeField(portCurr, cols.reserves, 21),o:lifeField(portPrev, cols.reserves, 21),type:'money'}
  ];
}

function lifeSummaryMainCategories(data, type, currP) {
  const names = lifeMainCats(data, type, currP);
  const wanted = ['Tweede Pijler', 'Derde Pijler', 'Vierde Pijler'];
  return wanted.filter(cat => names.includes(cat));
}
function annualPremiumEquivalent(row) {
  return n(row[cols.prodPremie]) + n(row[cols.premieVerhoging]) + 0.1 * n(row[cols.premieKoopsom]);
}
function summaryTrendLine(label, prevVal, currVal, formatType, invert = false) {
  const delta = currVal - prevVal;
  const direction = currentLang === 'fr' ? (delta > 0 ? 'augmente de' : delta < 0 ? 'diminue de' : 'reste stable, variation de') : (delta > 0 ? 'stijgt met' : delta < 0 ? 'daalt met' : 'blijft stabiel met');
  const amount = formatType === 'num' ? num.format(Math.abs(delta)) : euro.format(Math.abs(delta));
  const pctTxt = prevVal ? ` (${delta >= 0 ? '+' : '-'}${pct.format(Math.abs(yoy(prevVal, currVal)))}%)` : '';
  const clsName = delta === 0 ? 'neu' : ((delta > 0) !== invert ? 'pos' : 'neg');
  return `<li><b>${escLabel(label)}</b> ${direction} <span class="${clsName}">${amount}${pctTxt}</span>.</li>`;
}
function lifeSummaryIcon(kind) {
  const paths = {
    production: 'm3 17 6-6 4 4 8-8m-5 0h5v5',
    lumpSum: 'M19 5a7 7 0 1 0 0 14M4 10h11M4 14h9',
    increase: 'M9 20V4m-5 5 5-5 5 5M18 13v8m-4-4h8',
    ape: 'M4 19h16M7 16v-4m5 4V7m5 9V4',
    mix: 'M12 3v9h9A9 9 0 1 0 12 21 9 9 0 0 0 21 12M15 3.5A9 9 0 0 1 20.5 9H15z'
  };
  return `<div class="insightItemIcon" data-summary-icon="${kind}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[kind]}"/></svg></div>`;
}
function renderLifeSummaryBlock(data, cfg, prevP, currP) {
  const cats = lifeSummaryMainCategories(data, cfg.type, currP);
  const labels = cats.map(catTitleHtml);
  const source = rowsOf(data, cfg.type);
  const categoryRows = cats.map(cat => source.filter(row => row[cols.hoofd] === cat && row[cols.sub] === cat));
  const row = (period, index) => lifePickRow(categoryRows[index], cats[index], period);
  const value = cfg.value || (item => lifeField(item, cfg.field, cfg.cellIndex));
  const prevVals = cats.map((cat, index) => value(row(prevP, index)));
  const currVals = cats.map((cat, index) => value(row(currP, index)));
  const previousYears = lifePreviousYearPeriods(source, prevP, currP).map(period => ({
    period, values: cats.map((cat, index) => {
      const item = row(period, index);
      return item[cols.periode] ? value(item) : null;
    })
  }));
  const caseCount = cfg.countField && ((period, index) => {
    const count = row(period, index)[cfg.countField];
    return count == null || count === '' ? null : n(count);
  });
  const trendLines = cats.map((cat, idx) => summaryTrendLine(cat, prevVals[idx], currVals[idx], cfg.formatType, cfg.invert)).join('');
  const chart = cats.length
    ? barCompareHtml(labels, prevVals, currVals, prevP, currP, cfg.formatType, cfg.color, '', {
        showDelta: true, invertDelta: cfg.invert, comparisonBadges: true, previousYears, caseCount
      })
    : `<div class="note">${escLabel('Geen gegevens gevonden voor de hoofdcategorieën.')}</div>`;
  return `<div class="insightItem"><div class="insightItemHeader">${lifeSummaryIcon(cfg.icon)}<h3>${escLabel(cfg.title)}</h3>${exportActionsHtml({classes:'summaryExportActions'})}</div><p>${escLabel(cfg.intro)}</p><ul>${trendLines}</ul><div class="miniCard"><h3>${escLabel(cfg.chartTitle)}</h3>${chart}</div></div>`;
}

function lifePillarPieConfig(mode) {
  const cfg = {
    productie:{ type:'PRODUCTIE', field:cols.prodPremie, cellIndex:5, title:'Verdeling premie productie', center:'Premie productie', total:'Totaal premie productie' },
    verval:{ type:'PRODUCTIE', field:cols.premieKoopsom, cellIndex:6, title:'Verdeling koopsommen', center:'Koopsommen', total:'Totaal koopsommen' },
    transformatie:{ type:'PRODUCTIE', field:cols.premieVerhoging, cellIndex:12, title:'Verdeling verhogingen', center:'Verhogingen', total:'Totaal verhogingen' },
    portefeuille:{ type:'PORTEFEUILLE', field:cols.portefeuillepremie, cellIndex:19, title:'Verdeling portefeuillepremie', center:'Portefeuille', total:'Totaal portefeuillepremie' }
  }[mode] || null;
  return cfg ? {...cfg,title:displayLabel(cfg.title),center:displayLabel(cfg.center),total:displayLabel(cfg.total)} : null;
}
function lifePillarPieItems(data, period, cfg) {
  const order = [
    { key:'Tweede Pijler', label:'2e pijler', color:'#ff934c' },
    { key:'Derde Pijler', label:'3e pijler', color:'#009b77' },
    { key:'Vierde Pijler', label:'4e pijler', color:'#0d1473' }
  ];
  return order.map(item => {
    const row = findMainCategoryRow(data, cfg.type, item.key, period);
    return { ...item, label:displayLabel(item.label), value:lifeField(row, cfg.field, cfg.cellIndex) };
  }).filter(item => item.value > 0);
}
function lifeDistributionPanel(prefix, period, current) {
  const label = current
    ? (currentLang === 'fr' ? 'Dernière période' : 'Laatste periode')
    : (currentLang === 'fr' ? 'Période précédente' : 'Vorige periode');
  return `<div class="portfolioPiePanel"><h3>${label} · ${esc(fmtPeriod(period))}</h3><div class="productionPieGrid portfolioPieGrid"><div class="pieWrap"><canvas id="${prefix}Canvas" width="990" height="645"></canvas><div id="${prefix}Total" class="portfolioPieTotal"></div></div><div id="${prefix}Legend" class="pieLegend"></div></div></div>`;
}
function ensureLifePillarPieLayout(prevP, currP) {
  const card = $('productionPieCard');
  if (!card) return;
  const grid = card.querySelector('.productionPieGrid');
  if (!grid) return;
  card.classList.remove('progressContributionCard');
  grid.classList.add('portfolioPieGrid');
  grid.innerHTML = `<div class="portfolioPiePair productionComparePiePair">
    ${lifeDistributionPanel('productionPiePrev', prevP, false)}
    ${lifeDistributionPanel('productionPieCurr', currP, true)}
  </div><div id="productionPieTooltip" class="pieTooltip portfolioPieTooltip"></div>`;
}
function renderLifePillarPie(data, prevP, currP, mode) {
  const cfg = lifePillarPieConfig(mode);
  const card = $('productionPieCard');
  if (!cfg || !card) return;
  card.classList.remove('hidden');
  $('portfolioPieCard')?.classList.add('hidden');
  setText('productionPieTitle', cfg.title);
  setText('productionPieSub', '');
  ensureLifePillarPieLayout(prevP, currP);
  [
    { period:prevP, canvas:$('productionPiePrevCanvas'), legend:$('productionPiePrevLegend'), total:$('productionPiePrevTotal') },
    { period:currP, canvas:$('productionPieCurrCanvas'), legend:$('productionPieCurrLegend'), total:$('productionPieCurrTotal') }
  ].forEach(panel => {
    if (!panel.canvas || !panel.legend) return;
    const items = lifePillarPieItems(data, panel.period, cfg);
    panel.canvas.dataset.tooltipId = 'productionPieTooltip';
    drawPortfolioPie(panel.canvas, panel.period, items, -1, cfg.center);
    renderPortfolioPieLegend(panel.legend, items);
    attachPortfolioPieHover(panel.canvas);
    attachPieLegendHover(panel.legend, panel.canvas, 'productionPieTooltip');
    if (panel.total) panel.total.innerHTML = `${esc(cfg.total)}: <b>${euro.format(items.reduce((sum, item) => sum + item.value, 0))}</b>`;
  });
}
function renderActivePie(data, currP) {
  const active = document.querySelector('.tab.active');
  const mode = active ? active.dataset.tab : '';
  const card = $('productionPieCard');
  if (!card) return;
  const cfg = lifePillarPieConfig(mode);
  if (cfg && data && currP) {
    renderLifePillarPie(data, dashboardPreviousPeriod || '', currP, mode);
  } else {
    card.classList.add('hidden');
    $('portfolioPieCard')?.classList.add('hidden');
    const tooltip = $('productionPieTooltip');
    if (tooltip) tooltip.style.display = 'none';
  }
}
function lifeField(row, field, cellIndex) {
  const byName = n(row && row[field]);
  if (byName !== 0) return byName;
  if (row && row._cells && cellIndex != null && row._cells[cellIndex] !== undefined) return n(row._cells[cellIndex]);
  return byName;
}

function renderPortefeuilleGroup(cat, rows, prevP, currP) {
  const { bars, head, prevHead } = lifeGroupBasics(cat, rows, prevP, currP);
  const portPremie = lifeField(head, cols.portefeuillepremie, 19);
  const prevPortPremie = lifeField(prevHead, cols.portefeuillepremie, 19);
  const reserves = lifeField(head, cols.reserves, 21);
  const prevReserves = lifeField(prevHead, cols.reserves, 21);
  const polissen = lifeField(head, cols.polissenPortefeuille, 16);
  const prevPolissen = lifeField(prevHead, cols.polissenPortefeuille, 16);
  return `<div class="cat"><div class="catHead exportableBlockHeader"><div class="catTitle">${catTitleHtml(cat)}</div><div class="small">${prevP} &rarr; ${currP}</div>${productBlockExportActionsHtml()}</div><div class="p-18"><div class="split"><div class="metric"><b>${escLabel('Portefeuillepremie')} ${currP}</b><span class="metric-val">${euro.format(portPremie)}</span>${deltaHtml(yoy(prevPortPremie, portPremie), prevPortPremie, prevP, 'money')}</div><div class="metric"><b>${escLabel('Polissen portefeuille')} ${currP}</b><span class="metric-val">${num.format(polissen)}</span>${deltaHtml(yoy(prevPolissen, polissen), prevPolissen, prevP, 'num')}</div><div class="metric"><b>${escLabel('Reserves')} ${currP}</b><span class="metric-val">${euro.format(reserves)}</span>${deltaHtml(yoy(prevReserves, reserves), prevReserves, prevP, 'money')}</div></div><div class="miniGrid"><div class="miniCard"><h3>${escLabel('Portefeuillepremie')}</h3>${bars(cols.portefeuillepremie, 'money', 19)}</div><div class="miniCard"><h3>${escLabel('Aantal polissen portefeuille')}</h3>${bars(cols.polissenPortefeuille, 'num', 16)}</div><div class="miniCard"><h3>${escLabel('Reserves')}</h3>${bars(cols.reserves, 'money', 21)}</div></div></div></div>`;
}

function renderDetails(data, prodCats, schadeCats, prevP, currP) {
  renderLifeDetails(data, prodCats, prevP, currP);
}
function renderLifeDetails(data, prodCats, prevP, currP) {
  const prodRows = rowsOf(data, 'PRODUCTIE').filter(r => [prevP, currP].includes(r[cols.periode]));
  const portRows = rowsOf(data, 'PORTEFEUILLE').filter(r => [prevP, currP].includes(r[cols.periode]));
  const cats = (prodCats.length ? prodCats : lifeMainCats(data, 'PRODUCTIE', currP)).filter(cat => cat !== 'TOTAAL LEVEN');
  const totalHtml = prodRows.some(isTotalNonLife) ? totalBlock(renderLifeCat('TOTAAL LEVEN', prodRows, portRows, prevP, currP)) : '';
  const detailHtml = cats.map(cat => renderLifeCat(cat, prodRows, portRows, prevP, currP)).join('');
  $('categoryDetails').innerHTML = `${totalHtml}${detailHtml}`;
}
function renderInsightSummary(data, prevP, currP) {
  const blocks = [
    { icon:'production', title:'Productie', type:'PRODUCTIE', field:cols.prodPremie, countField:cols.prodAantal, cellIndex:5, formatType:'money', color:'blue', invert:false, intro:'Vergelijking van de premie productie per hoofdcategorie.', chartTitle:'Premie productie per pijler' },
    { icon:'lumpSum', title:'Koopsommen', type:'PRODUCTIE', field:cols.premieKoopsom, cellIndex:6, formatType:'money', color:'blue', invert:false, intro:'Vergelijking van de premie koopsom per hoofdcategorie.', chartTitle:'Premie koopsom per pijler' },
    { icon:'increase', title:'Verhogingen', type:'PRODUCTIE', field:cols.premieVerhoging, cellIndex:12, formatType:'money', color:'blue', invert:false, intro:'Vergelijking van de premie verhoging per hoofdcategorie.', chartTitle:'Premie verhoging per pijler' },
    { icon:'ape', title:'APE', type:'PRODUCTIE', value:annualPremiumEquivalent, formatType:'money', color:'blue', invert:false, intro:'Productie + verhogingen + 10% van de koopsom.', chartTitle:'APE per pijler' }
  ];
  $('insightSummary').classList.remove('hidden');
  $('insightSummary').innerHTML = `<div id="insightSummaryExport" class="insightSummaryExport"><div class="insightGrid">${blocks.map(cfg => renderLifeSummaryBlock(data, cfg, prevP, currP)).join('')}<div class="portfolioPieCard summaryProductionMixCard" style="grid-column:1/-1"><div class="titleExportRow"><h2>${escLabel('Verdeling totaal premies')}</h2>${exportActionsHtml({classes:'summaryExportActions'})}</div><div class="portfolioPiePair">${lifeDistributionPanel('summaryProductionMixPrev', prevP, false)}${lifeDistributionPanel('summaryProductionMixCurr', currP, true)}</div><div id="summaryProductionMixTooltip" class="pieTooltip portfolioPieTooltip"></div></div></div></div>`;
  renderSummaryProductionMix(data, prevP, currP);
}
function summaryProductionMixItems(data, period) {
  const row = totalRow(data, 'PRODUCTIE', period);
  return [
    { key:'premieProductie', label:displayLabel('Premie productie'), value:n(row[cols.prodPremie]), color:'#ff934c' },
    { key:'premieKoopsom', label:displayLabel('Premie koopsom'), value:n(row[cols.premieKoopsom]), color:'#009b77' },
    { key:'premieVerhoging', label:displayLabel('Premie verhoging'), value:n(row[cols.premieVerhoging]), color:'#0d1473' }
  ].filter(item => item.value > 0);
}
function renderSummaryProductionMix(data, prevP, currP) {
  [
    { period:prevP, canvas:$('summaryProductionMixPrevCanvas'), legend:$('summaryProductionMixPrevLegend'), total:$('summaryProductionMixPrevTotal') },
    { period:currP, canvas:$('summaryProductionMixCurrCanvas'), legend:$('summaryProductionMixCurrLegend'), total:$('summaryProductionMixCurrTotal') }
  ].forEach(cfg => {
    if (!cfg.canvas || !cfg.legend) return;
    const items = summaryProductionMixItems(data, cfg.period);
    cfg.canvas.dataset.tooltipId = 'summaryProductionMixTooltip';
    drawPortfolioPie(cfg.canvas, cfg.period, items, -1, displayLabel('Totaal premies'));
    renderPortfolioPieLegend(cfg.legend, items);
    cfg.total.innerHTML = `${escLabel('Totaal premies')}: <b>${euro.format(items.reduce((sum, item) => sum + item.value, 0))}</b>`;
    attachPortfolioPieHover(cfg.canvas);
    attachPieLegendHover(cfg.legend, cfg.canvas, 'summaryProductionMixTooltip');
  });
}

function categoryKpiItems(data, tab, prevP, currP) {
  const cfg = {
    productie:['PRODUCTIE', cols.prodPremie, 5, 'Premie productie', false],
    verval:['PRODUCTIE', cols.premieKoopsom, 6, 'Premie koopsom', false],
    transformatie:['PRODUCTIE', cols.premieVerhoging, 12, 'Premie verhoging', false],
    portefeuille:['PORTEFEUILLE', cols.portefeuillepremie, 19, 'Portefeuillepremie', false],
    detail:['PRODUCTIE', cols.prodPremie, 5, 'Premie productie', false]
  }[tab];
  if (!cfg) return null;
  const [type, field, cellIndex, label, invert] = cfg;
  const valueFor = (cat, period) => lifeField(cat === 'TOTAAL LEVEN' ? totalRow(data, type, period) : findMainCategoryRow(data, type, cat, period), field, cellIndex);
  const totalItem = { l:'TOTAAL LEVEN', metricLabel:label, v:valueFor('TOTAAL LEVEN', currP), o:valueFor('TOTAAL LEVEN', prevP), type:'money', invert, dynamicCategory:true, showPeriodInLabel:false, compareAmountMode:'previous', kpiRole:'summary-total' };
  const catItems = lifeMainCats(data, type, currP).map(cat => {
    return { l:cat, metricLabel:label, v:valueFor(cat, currP), o:valueFor(cat, prevP), type:'money', invert, dynamicCategory:true, showPeriodInLabel:false, compareAmountMode:'previous', kpiRole:'summary-component' };
  });
  return [totalItem, ...catItems];
}
function renderProductionGroup(cat, rows, prevP, currP) {
  const { bars, head, prevHead } = lifeGroupBasics(cat, rows, prevP, currP);
  return `<div class="cat"><div class="catHead exportableBlockHeader"><div class="catTitle">${catTitleHtml(cat)}</div><div class="small">${prevP} &rarr; ${currP}</div>${productBlockExportActionsHtml()}</div><div class="p-18"><div class="split split-2"><div class="metric"><b>${escLabel('Aantal zaken')} ${currP}</b><span class="metric-val">${num.format(n(head[cols.prodAantal]))}</span>${deltaHtml(yoy(n(prevHead[cols.prodAantal]), n(head[cols.prodAantal])), n(prevHead[cols.prodAantal]), prevP, 'num')}</div><div class="metric"><b>${escLabel('Premie productie')} ${currP}</b><span class="metric-val">${euro.format(n(head[cols.prodPremie]))}</span>${deltaHtml(yoy(n(prevHead[cols.prodPremie]), n(head[cols.prodPremie])), n(prevHead[cols.prodPremie]), prevP, 'money')}</div></div><div class="miniGrid"><div class="miniCard"><h3>${escLabel('Aantal zaken productie')}</h3>${bars(cols.prodAantal, 'num')}</div><div class="miniCard"><h3>${escLabel('Premie productie')}</h3>${bars(cols.prodPremie, 'money')}</div></div></div></div>`;
}

/* === Selectieve UI helpers: drag feedback === */
(function(){
  function initSelectiveUi(){
    var zone=document.querySelector('.upload-zone');
    var input=document.getElementById('pdfFile');
    if(zone && input && !zone.dataset.dragEnhanced){
      zone.dataset.dragEnhanced='1';
      zone.addEventListener('click', e => {
        if (e.target !== input) input.click();
      });
      ['dragenter','dragover'].forEach(function(evt){
        zone.addEventListener(evt,function(e){
          e.preventDefault();
          e.stopPropagation();
          zone.classList.add('dragging');
        });
      });
      ['dragleave','dragend'].forEach(function(evt){
        zone.addEventListener(evt,function(e){
          e.preventDefault();
          e.stopPropagation();
          zone.classList.remove('dragging');
        });
      });
      zone.addEventListener('drop',function(e){
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('dragging');
        var files=e.dataTransfer && e.dataTransfer.files;
        if(!files || !files.length) return;
        var file=files[0];
        if(file && file.type && file.type !== 'application/pdf') return;
        try{
          var dt=new DataTransfer();
          dt.items.add(file);
          input.files=dt.files;
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }catch(err){
          // Fallback: browsers without assignable FileList still keep the visual drag behaviour.
        }
      });
    }

  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initSelectiveUi); else initSelectiveUi();
})();
