// ─── PDF.js worker ────────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';

// ─── UI helper ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── Logo fallback: verberg logo's als de externe bron niet laadt ─────────────
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
    if (/^v\d{1,2}(?:\.\d{1,2}){2}$/i.test(line)) {
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
  ['uploadLogo', 'brokerLogoImg'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('error', () => { el.style.display = 'none'; });
  });
  $('appVersionBtn')?.addEventListener('click', openReleaseNotesModal);
  $('releaseNotesCloseBtn')?.addEventListener('click', closeReleaseNotesModal);
  $('releaseNotesModal')?.addEventListener('click', event => {
    if (event.target === $('releaseNotesModal')) closeReleaseNotesModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeReleaseNotesModal();
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
let viewMode = 'all';
let previousYearsMode = false;
let view360AnalysisMode = 'all';
let drillMode = true;
let productionPieState = { segments: [], total: 0 };
let topInfoCollapsed = false;
let lastKpiContext = null;
let cappedSpKpiKeys = new Set();
let showCappedSpKpis = false;
let kpiOverviewVisibility = { samenvatting: true, productie: true, verval: true, progressie: true, schade: true, portefeuille: true };
const dashboardRenderedSections = new Set();
const dashboardDirtySections = new Set();

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
    pageTitle: 'Van PDF naar helder inzicht',
    pageLead: 'Upload je <strong>kerncijfers non-life PDF</strong>. Het dashboard zet de gegevens automatisch om in een duidelijke analyse van productie, verval, progressie en schade. Dit dashboard werkt met de PDF kerncijfers nonlife die je hebt gedownload vanuit Salesforce (je moet de PDF effectief downloaden als bestand, afdrukken als PDF werkt niet), zowel op groepsniveau, koepelniveau alsook voor de kerncijfers AM, CDR of CD.',
    uploadTitle: 'Sleep je PDF hierheen', uploadHint: 'of klik om een bestand te kiezen', importPdf: 'Importeer', downloadCsv: 'Download CSV', exportPdf: 'Exporteer PDF', pdfBusy: 'PDF wordt gemaakt…', pdfOptionsTitle: 'PDF secties', pdfNoSections: 'Selecteer minstens één PDF-sectie.', noPdf: 'Klaar om je kerncijfers te verwerken', processing: '⏳ PDF verwerken…',
    success: n => '✅ PDF geladen & verwerkt: ' + n + ' datarijen. Percentages en schade-totalen komen rechtstreeks uit de PDF.', error: '❌ Fout bij verwerken PDF: ',
    broker: 'Makelaar', koepelnummer: 'koepelnummer', groepsnummer: 'groepsnummer', vs: 'vs', main: 'Hoofd', sub: 'Sub', lowerPositive: 'daling is positief', lowerBetter: 'schade: lager is beter', viewModeLabel: 'Weergave', viewAll: 'Hoofd- en subcategorieën', viewMainOnly: 'Hoofdcategorieën', viewSubOnly: 'Subcategorieën', previousYears: 'Vorige jaren', drillDown: 'Alles inklappen', drillDownActive: 'Alles uitklappen', importControlTitle: 'Importcontrole', importControlSub: 'Snelle controle of de PDF correct werd geïnterpreteerd', importPeriods: 'Aantal periodes gevonden', importLatestPeriod: 'Laatste periode gevonden', importTotalProd: 'TOTAAL NON LIFE productie', importTotalSchade: 'TOTAAL NON LIFE schade', importSpPct: 'S/P % correct gelezen', importBroker: 'Makelaar/koepelnummer', yes: 'Ja', no: 'Nee', topCompactTitle: 'PDF import & controle', topShow: 'Toon importinformatie', topHide: 'Verberg importinformatie', topOk: 'Importcontrole OK', topAttention: n => n + ' aandachtspunt' + (n === 1 ? '' : 'en'), topPeriodsShort: 'periodes', topLatestShort: 'laatste',
    tabSamenvatting: 'Samenvatting', tab360: '360-view', tabProductie: 'Productie', tabVerval: 'Verval', tabProgressie: 'Progressie', tabSchade: 'Schade', tabPortefeuille: 'Portefeuille', tabKpis: "KPI's", tabDetail: 'Detail', kpiSelectorLabel: "KPI's", kpiSelectorAll: "Alle KPI's", kpiSelectorCount: n => n + " KPI-sectie" + (n === 1 ? '' : 's'), kpiOverviewEmpty: 'Selecteer minstens één KPI-sectie.',
    prodTitle: 'Productie', vervalTitle: 'Verval', progTitle: 'Progressie', schadeTitle: 'Schade', portefeuilleTitle: 'Portefeuille: verdiende premie', detailTitle: 'Hoofd- en subcategorieën',
    prodNote: 'De gegevens hieronder tonen per hoofdcategorie eerst de hoofdrij en daaronder alle subcategorieën uit de CSV.', portefeuilleNote: 'De grafieken hieronder tonen de verdiende premie op TOTAAL NON LIFE-niveau: eerst de drie meest recente volledige jaren, daarnaast de laatste periode vorig jaar tegenover de laatste periode dit jaar.', portefeuilleSub: (a,b) => 'Verdiende premie TOTAAL NON LIFE. Volledige jaren apart; laatste periode: ' + a + ' versus ' + b + '.', portefeuilleYears: 'Voorbije 3 jaar', portefeuilleComparison: 'Laatste periode J vs J-1', portefeuilleEmpty: 'Geen portefeuillegegevens gevonden.', vorigJaar: 'Vorig jaar', huidigJaar: 'Dit jaar', vervalNote: 'De gegevens hieronder tonen per hoofdcategorie eerst de hoofdrij en daaronder alle subcategorieën uit de CSV, inclusief verval door klant en maatschappij.', progNote: 'Progressie wordt getoond als productie - verval + transformatie, per hoofdcategorie en subcategorie zoals aangeleverd in de CSV.', schadeNote: 'Interpretatie schade: een daling van schadegevallen, schadelast of S/P is positief en wordt groen weergegeven, een stijging is negatief.',
    comparison: (a,b) => 'Vergelijking ' + a + ' versus ' + b + '.', schadeComparison: (a,b) => 'Vergelijking ' + a + ' versus ' + b + '. Voor schade zijn lagere waarden beter: dalende schadelast en dalende S/P worden positief getoond.',
    noProd: 'Geen productiegegevens gevonden.', noVerval: 'Geen vervalgegevens gevonden.', noProg: 'Geen progressiegegevens gevonden.', noSchade: 'Geen schadegegevens gevonden.',
    productie: 'Productie', verval: 'Verval', progressie: 'Progressie', schadelast: 'Schadelast', schade: 'Schade', productiepremie: 'Productiepremie', aantalZaken: 'Aantal zaken', aantalProductiezaken: 'Aantal productiezaken', vervalpremie: 'Vervalpremie', aantalVerval: 'Aantal verval', klantMaatschappij: 'Klant / maatschappij', aantalVervallenZaken: 'Aantal vervallen zaken', vervalKlant: 'Verval door klant', vervalMaatschappij: 'Verval door maatschappij', progressiepremie: 'Progressiepremie', aantalProgressiezaken: 'Aantal progressiezaken', transformatie: 'Transformatie', spNietAfgetopt: 'S/P niet afgetopt', afgetopteSchadelast: 'Afgetopte schadelast', spAfgetopt: 'S/P afgetopt', aantalSchadegevallen: 'Aantal schadegevallen', verdiendePremie: 'Verdiende premie', categorie: 'Categorie', aantal: 'Aantal', spAftop: 'S/P aftop', detailProductie: 'Productie', detailSchade: 'Schade', totaalPrefix: 'Totaal · ', productionPieTitle: 'Verdeling productie', productionPieSub: p => 'Totale productiepremie per tak voor ' + p + '.', productionPieEmpty: 'Geen productiegegevens gevonden voor de verdeling.', vervalPieTitle: 'Verdeling vervalpremie', vervalPieSub: p => 'Totale vervalpremie per tak voor ' + p + '.', vervalPieEmpty: 'Geen vervalgegevens gevonden voor de verdeling.', progressiePieTitle: 'Verdeling progressie', progressiePieSub: p => 'Totale progressiepremie per tak voor ' + p + '.', progressiePieEmpty: 'Geen progressiegegevens gevonden voor de verdeling.', schadePieTitle: 'Verdeling schadelast', schadePieSub: p => 'Totale schadelast per tak voor ' + p + '.', schadePieEmpty: 'Geen schadegegevens gevonden voor de verdeling.',
    labels: {'Auto':'Auto','Auto Vloten':'Vloten','Auto Niet Vloten':'Niet Vloten','Particulieren':'Particulieren','Particulieren Brand':'Brand','Particulieren BA':'BA','Particulieren Overige':'Overige','Ondernemingen':'Ondernemingen','Ondernemingen Brand':'Brand','Ondernemingen BA':'BA','Ondernemingen Overige':'Overige','Arbeidsongevallen':'Arbeidsongevallen','Rechtsbijstand':'Rechtsbijstand','Rechtsbijstand Stand Alone':'Rechtsbijstand','TOTAAL NON LIFE':'TOTAAL NON LIFE'}
  },
  fr: {
    pageTitle: 'Du PDF à une vision claire',
    pageLead: 'Téléchargez votre <strong>PDF chiffres clés non-vie</strong>. Le tableau de bord transforme automatiquement les données en une analyse claire de la production, de la chute, de la progression et des sinistres. Ce tableau de bord utilise le PDF des chiffres clés non-vie téléchargé depuis Salesforce (vous devez effectivement télécharger le PDF en tant que fichier ; l’impression au format PDF ne fonctionne pas), tant au niveau du groupe et de la coupole que pour les chiffres clés AM, CDR ou CD.',
    uploadTitle: 'Glissez votre PDF ici', uploadHint: 'ou cliquez pour choisir un fichier', importPdf: 'Importer', downloadCsv: 'Télécharger CSV', exportPdf: 'Exporter PDF', pdfBusy: 'Création du PDF…', pdfOptionsTitle: 'Sections PDF', pdfNoSections: 'Sélectionnez au moins une section PDF.', noPdf: 'Prêt à traiter vos chiffres clés', processing: '⏳ Traitement du PDF…',
    success: n => '✅ PDF chargé & traité : ' + n + ' lignes de données. Les pourcentages et totaux sinistres proviennent directement du PDF.', error: '❌ Erreur lors du traitement du PDF : ',
    broker: 'Courtier', koepelnummer: 'n° coupole', groepsnummer: 'n° groupe', vs: 'vs', main: 'Principal', sub: 'Sous-cat.', lowerPositive: 'baisse positive', lowerBetter: 'sinistres : plus bas est meilleur', viewModeLabel: 'Affichage', viewAll: 'Tout', viewMainOnly: 'Catégories principales', viewSubOnly: 'Sous-catégories', previousYears: 'Années précédentes', drillDown: 'Tout replier', drillDownActive: 'Tout déplier', importControlTitle: 'Contrôle import', importControlSub: 'Contrôle rapide de l’interprétation du PDF', importPeriods: 'Nombre de périodes', importLatestPeriod: 'Dernière période trouvée', importTotalProd: 'TOTAL NON VIE production', importTotalSchade: 'TOTAL NON VIE sinistres', importSpPct: 'S/P % lu correctement', importBroker: 'Courtier/n° coupole', yes: 'Oui', no: 'Non', topCompactTitle: 'Import PDF & contrôle', topShow: 'Afficher les informations import', topHide: 'Masquer les informations import', topOk: 'Contrôle import OK', topAttention: n => n + ' point' + (n === 1 ? '' : 's') + ' d’attention', topPeriodsShort: 'périodes', topLatestShort: 'dernière',
    tabSamenvatting: 'Résumé', tab360: 'Vue 360', tabProductie: 'Production', tabVerval: 'Chute', tabProgressie: 'Progression', tabSchade: 'Sinistres', tabPortefeuille: 'Portefeuille', tabKpis: 'KPI', tabDetail: 'Détail', kpiSelectorLabel: 'KPI', kpiSelectorAll: 'Tous les KPI', kpiSelectorCount: n => n + ' section' + (n === 1 ? '' : 's') + ' KPI', kpiOverviewEmpty: 'Sélectionnez au moins une section KPI.',
    prodTitle: 'Production', vervalTitle: 'Chute', progTitle: 'Progression', schadeTitle: 'Sinistres', portefeuilleTitle: 'Portefeuille : prime acquise', detailTitle: 'Catégories principales et sous-catégories',
    prodNote: 'Les données ci-dessous affichent d’abord la ligne principale par catégorie, puis toutes les sous-catégories du CSV.', portefeuilleNote: 'Les graphiques ci-dessous affichent la prime acquise au niveau TOTAL NON VIE : d’abord les trois dernières années complètes, puis la dernière période de l’année passée face à la dernière période de cette année.', portefeuilleSub: (a,b) => 'Prime acquise TOTAL NON VIE. Années complètes séparées ; dernière période : ' + a + ' versus ' + b + '.', portefeuilleYears: '3 dernières années', portefeuilleComparison: 'Dernière période A vs A-1', portefeuilleEmpty: 'Aucune donnée portefeuille trouvée.', vorigJaar: 'Année passée', huidigJaar: 'Cette année', vervalNote: 'Les données ci-dessous affichent d’abord la ligne principale par catégorie, puis toutes les sous-catégories du CSV, y compris la chute client et compagnie.', progNote: 'La progression est affichée comme production - chute + transformation, par catégorie principale et sous-catégorie telle que fournie dans le CSV.', schadeNote: 'Interprétation sinistres : une baisse du nombre de sinistres, de la charge sinistre ou du S/P est positive et s’affiche en vert. Une hausse est négative. Les données ci-dessous affichent d’abord la ligne principale par catégorie, puis toutes les sous-catégories du CSV.',
    comparison: (a,b) => 'Comparaison ' + a + ' versus ' + b + '.', schadeComparison: (a,b) => 'Comparaison ' + a + ' versus ' + b + '. Pour les sinistres, des valeurs plus basses sont meilleures : une baisse de la charge sinistre et du S/P est positive.',
    noProd: 'Aucune donnée de production trouvée.', noVerval: 'Aucune donnée de chute trouvée.', noProg: 'Aucune donnée de progression trouvée.', noSchade: 'Aucune donnée sinistres trouvée.',
    productie: 'Production', verval: 'Chute', progressie: 'Progression', schadelast: 'Charge sinistre', schade: 'Sinistres', productiepremie: 'Prime production', aantalZaken: 'Nombre affaires', aantalProductiezaken: 'Nombre affaires production', vervalpremie: 'Prime chute', aantalVerval: 'Nombre affaires chute', klantMaatschappij: 'Client / compagnie', aantalVervallenZaken: 'Nombre affaires chute', vervalKlant: 'Prime chute client', vervalMaatschappij: 'Prime chute compagnie', progressiepremie: 'Prime progression', aantalProgressiezaken: 'Nombre progression', transformatie: 'Prime transformation', spNietAfgetopt: 'S/P non écrêté', afgetopteSchadelast: 'Charge sinistre écrêtée', spAfgetopt: 'S/P écrêté', aantalSchadegevallen: 'Nombre sinistres', verdiendePremie: 'Prime acquise', categorie: 'Catégorie', aantal: 'Nombre', spAftop: 'S/P écrêté', detailProductie: 'Production', detailSchade: 'Sinistres', totaalPrefix: 'Total · ', productionPieTitle: 'Répartition production', productionPieSub: p => 'Prime production totale par branche pour ' + p + '.', productionPieEmpty: 'Aucune donnée de production trouvée pour la répartition.', vervalPieTitle: 'Répartition chute', vervalPieSub: p => 'Prime chute totale par branche pour ' + p + '.', vervalPieEmpty: 'Aucune donnée de chute trouvée pour la répartition.', progressiePieTitle: 'Répartition progression', progressiePieSub: p => 'Prime progression totale par branche pour ' + p + '.', progressiePieEmpty: 'Aucune donnée de progression trouvée pour la répartition.', schadePieTitle: 'Répartition charge sinistre', schadePieSub: p => 'Charge sinistre totale par branche pour ' + p + '.', schadePieEmpty: 'Aucune donnée sinistres trouvée pour la répartition.',
    labels: {'Auto':'Auto','Auto Vloten':'Flottes','Auto Niet Vloten':'Non flottes','Particulieren':'Particuliers','Particulieren Brand':'Incendie','Particulieren BA':'RC','Particulieren Overige':'Autres','Ondernemingen':'Entreprises','Ondernemingen Brand':'Incendie','Ondernemingen BA':'RC','Ondernemingen Overige':'Autres','Arbeidsongevallen':'Accidents de travail','Rechtsbijstand':'Protection juridique','Rechtsbijstand Stand Alone':'Protection juridique','TOTAAL NON LIFE':'TOTAL NON VIE'}
  }
};

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
function exportCopyLabel() { return currentLang === 'fr' ? 'Copier' : 'Kopiëren'; }
function updateStaticLanguage() {
  document.documentElement.lang = currentLang; document.title = 'Dashboard VIVIUM Non-Life';
  setText('languageLabel', currentLang === 'fr' ? 'Langue' : 'Taal / Langue'); setText('pageTitle', msg('pageTitle')); setHtml('pageLead', msg('pageLead')); setText('uploadTitle', msg('uploadTitle')); setText('uploadHint', msg('uploadHint')); setText('downloadCsvBtn', msg('downloadCsv')); setText('exportPdfBtn', msg('exportPdf'));
  setText('heroEyebrow', currentLang === 'fr' ? 'Chiffres clés non-vie' : 'Kerncijfers non-life'); setText('heroBenefitAnalysis', currentLang === 'fr' ? 'Analyse automatique' : 'Automatische analyse'); setText('heroBenefitCompare', currentLang === 'fr' ? 'Comparaison directe' : 'Direct vergelijkbaar'); setText('heroBenefitSafe', currentLang === 'fr' ? 'Sécurisé' : 'Veilig'); setText('heroUploadButton', currentLang === 'fr' ? 'Sélectionner le PDF' : 'PDF selecteren'); setText('heroUploadMeta', 'PDF · NL of FR');
  setText('pdfSelectAll', currentLang === 'fr' ? 'Tout sélectionner' : 'Alles selecteren');
  setText('pdfSelectNone', currentLang === 'fr' ? 'Tout désélectionner' : 'Niets selecteren');
  setText('pdfOptionsTitle', msg('pdfOptionsTitle')); setText('pdfOptSummary', msg('tabSamenvatting')); setText('pdfOpt360', msg('tab360')); setText('pdfOptProductie', msg('tabProductie')); setText('pdfOptVerval', msg('tabVerval')); setText('pdfOptSchade', msg('tabSchade')); setText('pdfOptDistributions', currentLang === 'fr' ? 'Répartitions' : 'Verdelingen'); setText('pdfOptDetail', msg('tabDetail'));
  setText('tabSamenvatting', msg('tabSamenvatting')); setText('tab360', msg('tab360')); setText('tabProductie', msg('tabProductie')); setText('tabVerval', msg('tabVerval')); setText('tabProgressie', msg('tabProgressie')); setText('tabSchade', msg('tabSchade')); setText('tabPortefeuille', msg('tabPortefeuille')); setText('tabKpis', msg('tabKpis')); setText('tabDetail', msg('tabDetail'));
  setText('kpiCheckSamenvatting', msg('tabSamenvatting')); setText('kpiCheckProductie', msg('tabProductie')); setText('kpiCheckVerval', msg('tabVerval')); setText('kpiCheckProgressie', msg('tabProgressie')); setText('kpiCheckSchade', msg('tabSchade')); setText('kpiCheckPortefeuille', msg('tabPortefeuille')); updateKpiSelectorLabel();
  setText('viewModeLabel', msg('viewModeLabel')); setText('viewAllBtn', msg('viewAll')); setText('viewMainBtn', msg('viewMainOnly')); setText('viewSubBtn', msg('viewSubOnly')); setText('previousYearsToggleLabel', msg('previousYears')); setText('drillToggleBtn', drillMode ? msg('drillDownActive') : msg('drillDown')); updateViewDropdownLabel(); setText('topCompactTitle', msg('topCompactTitle')); if (lastData && dashboardCurrentPeriod) { renderImportControl(lastData, dashboardCurrentPeriod); renderTopCompactBar(); updateTopInfoToggleButton(); }
  setText('summaryTitle', msg('tabSamenvatting')); setText('view360Title', msg('tab360')); setText('view360MainBtn', msg('viewMainOnly')); setText('view360SubBtn', msg('viewSubOnly')); setText('view360AllBtn', msg('viewAll')); setText('prodTitle', msg('prodTitle')); setText('vervalTitle', msg('vervalTitle')); setText('progTitle', msg('progTitle')); setText('schadeTitle', msg('schadeTitle')); setText('portefeuilleTitle', msg('portefeuilleTitle')); setText('kpiOverviewTitle', msg('tabKpis')); setText('detailTitle', msg('detailTitle')); setText('productionPieTitle', msg('productionPieTitle'));
  updateSectionPeriodInline(dashboardPreviousPeriod, dashboardCurrentPeriod);
  setText('prodNote', msg('prodNote')); setText('vervalNote', msg('vervalNote')); setText('progNote', msg('progNote')); setText('schadeNote', msg('schadeNote')); setText('portefeuilleNote', msg('portefeuilleNote'));
  document.querySelectorAll('.exportCopyText, .blockExportCopy span').forEach(el => { el.textContent = exportCopyLabel(); });
  document.querySelectorAll('.blockExportCopy').forEach(el => { el.title = currentLang === 'fr' ? 'Copier comme image' : 'Kopiëren als afbeelding'; });
  const toggleStyleId = 'toggleBubbleLanguageStyle';
  let toggleStyle = document.getElementById(toggleStyleId);
  if (!toggleStyle) {
    toggleStyle = document.createElement('style');
    toggleStyle.id = toggleStyleId;
    document.head.appendChild(toggleStyle);
  }
  toggleStyle.textContent = currentLang === 'fr'
    ? "#dashboard.drillMode .section.active .cat:not(.totalNonLife) .catHead::after,#dashboard:not(.drillMode) .section.active .cat:not(.totalNonLife).manualClosed .catHead::after,#dashboard.drillMode #portefeuille.section.active .portfolioCategoryBlock:not(.portfolioTotalBlock) .portfolioCategoryHead::after,#dashboard:not(.drillMode) #portefeuille.section.active .portfolioCategoryBlock:not(.portfolioTotalBlock).manualClosed .portfolioCategoryHead::after{content:'Cliquez pour ouvrir'}#dashboard.drillMode .section.active .cat.drillOpen .catHead::after,#dashboard:not(.drillMode) .section.active .cat:not(.totalNonLife):not(.manualClosed) .catHead::after,#dashboard.drillMode #portefeuille.section.active .portfolioCategoryBlock.drillOpen .portfolioCategoryHead::after,#dashboard:not(.drillMode) #portefeuille.section.active .portfolioCategoryBlock:not(.portfolioTotalBlock):not(.manualClosed) .portfolioCategoryHead::after{content:'Cliquez pour fermer'}"
    : "#dashboard.drillMode .section.active .cat:not(.totalNonLife) .catHead::after,#dashboard:not(.drillMode) .section.active .cat:not(.totalNonLife).manualClosed .catHead::after,#dashboard.drillMode #portefeuille.section.active .portfolioCategoryBlock:not(.portfolioTotalBlock) .portfolioCategoryHead::after,#dashboard:not(.drillMode) #portefeuille.section.active .portfolioCategoryBlock:not(.portfolioTotalBlock).manualClosed .portfolioCategoryHead::after{content:'Klik om te openen'}#dashboard.drillMode .section.active .cat.drillOpen .catHead::after,#dashboard:not(.drillMode) .section.active .cat:not(.totalNonLife):not(.manualClosed) .catHead::after,#dashboard.drillMode #portefeuille.section.active .portfolioCategoryBlock.drillOpen .portfolioCategoryHead::after,#dashboard:not(.drillMode) #portefeuille.section.active .portfolioCategoryBlock:not(.portfolioTotalBlock):not(.manualClosed) .portfolioCategoryHead::after{content:'Klik om te sluiten'}";
  const status = $('status'); if (status && (!csvResult || status.textContent.includes('Nog geen PDF') || status.textContent.includes('Aucun PDF') || status.textContent.includes('Klaar om') || status.textContent.includes('Prêt à'))) status.textContent = msg('noPdf');
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
const pendingCategoryExpansion = new Map();
function setLanguage(lang) {
  document.querySelectorAll('.section[id]').forEach(section => {
    if (!pendingCategoryExpansion.has(section.id)) {
      const saved = captureCategoryExpansionState(section);
      if (saved.length) pendingCategoryExpansion.set(section.id, saved);
    }
  });
  currentLang = lang === 'fr' ? 'fr' : 'nl';
  const sel = $('languageSelect');
  if (sel) sel.value = currentLang;
  updateFormatters();
  updateStaticLanguage();
  renderBrokerInfo();
  if (lastData) {
    build(lastData);

    applyDashboardDisplayModes();
    setStatus(msg('success', lastData.length));
  }
}

function hasManualClosedCategories() {
  return !!document.querySelector('.cat.manualClosed,.portfolioCategoryBlock.manualClosed');
}

function categoryExpansionBlocks(section) {
  return Array.from(section?.querySelectorAll('.cat:not(.totalNonLife),.portfolioCategoryBlock:not(.portfolioTotalBlock)') || []);
}
function categoryExpansionKey(block, index) {
  return `${index}:${block.dataset.categoryKey || ''}`;
}
function captureCategoryExpansionState(section) {
  return categoryExpansionBlocks(section).map((block, index) => ({
    key: categoryExpansionKey(block, index),
    drillOpen: block.classList.contains('drillOpen'),
    manualClosed: block.classList.contains('manualClosed')
  }));
}
function restoreCategoryExpansionState(section, savedState) {
  if (!savedState?.length) return;
  const byKey = new Map(savedState.map(state => [state.key, state]));
  categoryExpansionBlocks(section).forEach((block, index) => {
    const state = byKey.get(categoryExpansionKey(block, index));
    if (!state) return;
    block.classList.toggle('drillOpen', state.drillOpen);
    block.classList.toggle('manualClosed', state.manualClosed);
  });
}

function applyDashboardDisplayModes() {
  const dash = $('dashboard');
  if (!dash) return;
  dash.classList.toggle('view-main-only', viewMode === 'main');
  dash.classList.toggle('view-sub-only', viewMode === 'sub');
  dash.classList.toggle('drillMode', !!drillMode);
  document.querySelectorAll('[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewMode));
  const previousYearsToggle = $('previousYearsToggle');
  if (previousYearsToggle) previousYearsToggle.checked = !!previousYearsMode;
  updateViewDropdownLabel();
  const drillBtn = $('drillToggleBtn');
  const manualClosedInAllMode = !drillMode && hasManualClosedCategories();
  if (drillBtn) {
    drillBtn.classList.toggle('active', !!drillMode || manualClosedInAllMode);
    drillBtn.textContent = (drillMode || manualClosedInAllMode) ? msg('drillDownActive') : msg('drillDown');
  }
  if (!drillMode) document.querySelectorAll('.cat.drillOpen,.portfolioCategoryBlock.drillOpen').forEach(cat => cat.classList.remove('drillOpen'));
  if (drillMode) document.querySelectorAll('.cat.manualClosed,.portfolioCategoryBlock.manualClosed').forEach(cat => cat.classList.remove('manualClosed'));
}
function setViewMode(mode) {
  viewMode = ['all', 'main', 'sub'].includes(mode) ? mode : 'all';
  applyDashboardDisplayModes();
  markDashboardSectionsDirty('portefeuille');
  if (lastData && activeTabId() === 'portefeuille') {
    renderDashboardSection('portefeuille');
    formatDisplayedPeriods($('portefeuille'));
    triggerMotionRefresh($('portefeuille'));
  }
}
function setPreviousYearsMode(on) {
  previousYearsMode = !!on;
  applyDashboardDisplayModes();
  if (lastData && dashboardPreviousPeriod && dashboardCurrentPeriod) {
    markDashboardSectionsDirty('productie', 'verval', 'progressie', 'schade', 'kpiOverzicht');
    const active = activeTabId();
    if (['productie', 'verval', 'progressie', 'schade', 'kpiOverzicht'].includes(active)) {
      const expansionState = captureCategoryExpansionState($(active));
      renderDashboardSection(active);
      restoreCategoryExpansionState($(active), expansionState);
      formatDisplayedPeriods($(active));
      triggerMotionRefresh($(active));
    }
  }
}
function updateViewDropdownLabel() {
  const label = $('viewDropdownMain');
  if (!label) return;
  label.textContent = viewMode === 'main' ? msg('viewMainOnly') : viewMode === 'sub' ? msg('viewSubOnly') : msg('viewAll');
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
  "TOTAAL NON LIFE": ["TOTAAL NON LIFE", "TOTAL NON VIE"]
};

const SUBCATEGORY_PARENT = {
  "Auto Vloten": "Auto",
  "Auto Niet Vloten": "Auto",
  "Particulieren Brand": "Particulieren",
  "Particulieren BA": "Particulieren",
  "Particulieren Overige": "Particulieren",
  "Ondernemingen Brand": "Ondernemingen",
  "Ondernemingen BA": "Ondernemingen",
  "Ondernemingen Overige": "Ondernemingen"
};

const GENERIC_FR_SUBCATEGORY = {
  "incendie": "Brand",
  "rc": "BA",
  "autres": "Overige"
};

function normText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
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
  const downloadTitle = options.downloadTitle || 'Download als PNG';
  const copyTitle = options.copyTitle || (currentLang === 'fr' ? 'Copier comme image' : 'Kopiëren als afbeelding');
  return `<div class="${classes}"${target} aria-label="${esc(label)}"><button type="button" class="blockExportBtn blockExportDownload" title="${esc(downloadTitle)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button><button type="button" class="blockExportBtn blockExportCopy" title="${esc(copyTitle)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span style="font-size:11px;font-weight:950;padding-left:4px">${esc(exportCopyLabel())}</span></button></div>`;
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
  if (target === 'topKpis') {
    const active = document.querySelector('.tab.active');
    const tabTitle = active?.innerText || "KPI's";
    return { block: $('kpis'), title: `KPI's ${tabTitle}` };
  }
  const allTargets = {
    productieAll: { id: 'productie', blockId: 'prodGrouped', titleId: 'prodTitle', fallback: 'Productie' },
    vervalAll: { id: 'verval', blockId: 'vervalGrouped', titleId: 'vervalTitle', fallback: 'Verval' },
    progressieAll: { id: 'progressie', blockId: 'progGrouped', titleId: 'progTitle', fallback: 'Progressie' },
    schadeAll: { id: 'schade', blockId: 'schadeGrouped', titleId: 'schadeTitle', fallback: 'Schade' },
    portefeuilleAll: { id: 'portefeuille', blockId: 'portefeuilleCharts', titleId: 'portefeuilleTitle', fallback: 'Portefeuille' },
    view360All: { id: 'view360', blockId: 'view360Content', titleId: 'view360Title', fallback: '360-view' },
    kpiOverviewAll: { id: 'kpiOverzicht', blockId: 'kpiOverviewGroups', titleId: 'kpiOverviewTitle', fallback: "KPI's" },
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
  const block = button.closest('.cat') || button.closest('.portfolioCategoryBlock') || button.closest('.insightItem') || button.closest('.portfolioPieCard') || button.closest('.view360AnalysisBlock') || button.closest('.kpiOverviewBlock');
  return { block, title: block?.querySelector('.catTitle,h3,h2,.view360AnalysisTitle h3')?.innerText || 'dashboard_blok' };
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
  const toggleViewDropdown = e => {
    e.preventDefault();
    e.stopPropagation();
    const wrap = $('viewDropdownWrap');
    if (!wrap) return;
    const open = !wrap.classList.contains('open');
    wrap.classList.toggle('open', open);
    $('viewDropdownBtn')?.setAttribute('aria-expanded', String(open));
  };
  $('viewDropdownMain')?.addEventListener('click', toggleViewDropdown);
  $('viewDropdownBtn')?.addEventListener('click', toggleViewDropdown);
  $('viewDropdownMenu')?.addEventListener('click', e => e.stopPropagation());
  document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => {
    setViewMode(btn.dataset.view);
    $('viewDropdownWrap')?.classList.remove('open');
    $('viewDropdownBtn')?.setAttribute('aria-expanded', 'false');
  }));
  $('previousYearsToggle')?.addEventListener('click', e => e.stopPropagation());
  $('previousYearsToggle')?.addEventListener('change', e => setPreviousYearsMode(e.target.checked));
  const toggleKpiSelector = e => {
    e.preventDefault();
    e.stopPropagation();
    const wrap = $('kpiSelectorWrap');
    if (!wrap) return;
    const open = !wrap.classList.contains('open');
    $('viewDropdownWrap')?.classList.remove('open');
    $('viewDropdownBtn')?.setAttribute('aria-expanded', 'false');
    wrap.classList.toggle('open', open);
    $('kpiSelectorBtn')?.setAttribute('aria-expanded', String(open));
  };
  $('kpiSelectorMain')?.addEventListener('click', toggleKpiSelector);
  $('kpiSelectorBtn')?.addEventListener('click', toggleKpiSelector);
  $('kpiSelectorMenu')?.addEventListener('click', e => e.stopPropagation());
  document.querySelectorAll('.kpiOverviewCheck').forEach(input => input.addEventListener('change', () => {
    kpiOverviewVisibility[input.dataset.kpiSection] = input.checked;
    updateKpiSelectorLabel();
    markDashboardSectionsDirty('kpiOverzicht');
    if (activeTabId() === 'kpiOverzicht') renderDashboardSection('kpiOverzicht');
  }));
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
    const analysisBtn = e.target.closest('[data-view360-analysis]');
    if (analysisBtn) {
      e.preventDefault();
      const scrollY = window.scrollY;
      const requestedMode = analysisBtn.dataset.view360Analysis;
      view360AnalysisMode = ['all', 'main', 'sub'].includes(requestedMode) ? requestedMode : 'all';
      document.querySelectorAll('[data-view360-analysis]').forEach(btn => btn.classList.toggle('active', btn.dataset.view360Analysis === view360AnalysisMode));
      render360View();
      requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' }));
      return;
    }
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
    if (!section || !['productie','verval','progressie','schade','detail'].includes(section.id)) return;
    toggleDashboardBlockVisibility(cat, '.p-18');
  });
$('kpis')?.addEventListener('click', e => {
    const spToggle = e.target.closest('.kpiSpToggle');
    if (spToggle) {
      e.preventDefault();
      e.stopPropagation();
      const key = spToggle.dataset.kpiKey || '';
      showCappedSpKpis = !showCappedSpKpis;
      cappedSpKpiKeys = new Set();
      updateTopKpisForActiveTab();
      return;
    }
    const card = e.target.closest('.kpi[data-kpi-cat]');
    if (!card) return;
    jumpToKpiCategory(card.dataset.kpiCat);
  });
  $('kpis')?.addEventListener('keydown', e => {
    if (e.target.closest('.kpiSpToggle')) return;
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
  const schadeRows = rowsOf(data, 'SCHADE');
  const schadeTotalRow = schadeRows.length ? (totalRow(data, 'SCHADE', latest) || {}) : {};
  const hasSchadeTotal = !!schadeTotalRow[cols.hoofd];
  const spOk = inspectSpPercentages(data).ok;
  const issueFlags = [periods.length > 0, latest !== '-', hasProdTotal, hasSchadeTotal, spOk];
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
  if (!lastData || !dashboardCurrentPeriod) {
    bar.classList.add('hidden');
    document.body.classList.remove('topInfoReady','topInfoCollapsed');
    placeLanguageSwitch();
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
  const title = currentLang === 'fr' ? 'Importer un PDF' : 'Importeer PDF';
  btn.textContent = msg('importPdf');
  btn.title = title;
  btn.setAttribute('aria-label', title);
}

function openPdfPicker() {
  const input = $('pdfFile');
  if (!input) return;
  input.value = '';
  input.click();
}

function setTopInfoCollapsed(collapsed) {
  topInfoCollapsed = !!collapsed;
  document.body.classList.toggle('topInfoCollapsed', topInfoCollapsed);
  renderTopCompactBar();
}

function setStatus(msg, warn = false) {
  const s = $('status');
  s.textContent = msg;
  s.className = 'status' + (warn ? ' warn' : '');
}

// ─── PDF verwerking ───────────────────────────────────────────────────────────
let pdfImportGeneration = 0;
$('pdfFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const generation = ++pdfImportGeneration;
  pendingCategoryExpansion.clear();
  csvResult = '';
  $('fileName').textContent = file.name;
  $('dashboard').classList.add('hidden');
  $('brokerInfo').classList.add('hidden');
  $('importControl')?.classList.add('hidden');
  $('topCompactBar')?.classList.add('hidden');
  document.body.classList.remove('topInfoReady','topInfoCollapsed');
  topInfoCollapsed = false;
  brokerInfo = { label: "koepelnummer", number: "", name: "" };
  updateView360BrokerInline();
  lastData = null;
  $('downloadCsvBtn').classList.add('hidden');
  $('exportPdfWrap')?.classList.add('hidden');
  setStatus(msg('processing'));
  try {
    const csv = await pdfToCsv(file, generation);
    if (generation !== pdfImportGeneration) return;
    csvResult = csv;
    const data = parseCSV(csvResult);
    lastData = data;
    build(data);
    setStatus(msg('success', data.length));
    setTopInfoCollapsed(true);
    $('downloadCsvBtn').classList.remove('hidden');
    $('exportPdfWrap')?.classList.remove('hidden');
    // Na import terug naar helemaal bovenaan. De importblokken zijn dan ingeklapt.
    window.setTimeout(() => { if (generation === pdfImportGeneration) window.scrollTo({ top: 0, behavior: 'smooth' }); }, 180);
  } catch (err) {
    if (generation !== pdfImportGeneration) return;
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

function brokerDisplayName() {
  if (!brokerInfo || (!brokerInfo.number && !brokerInfo.name)) return '';
  return brokerInfo.number
    ? `${brokerInfo.name || ''} (${brokerInfo.number})`.trim()
    : (brokerInfo.name || '');
}
function updateView360BrokerInline() {
  const el = $('view360BrokerInline');
  if (el) el.textContent = brokerDisplayName();
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
    const displayName = brokerDisplayName();
    $('brokerName').textContent = displayName;
    const latestPeriod = String(dashboardCurrentPeriod || '').trim().replace(/[\/.\-]+/g, ' ');
    const periodEl = $('brokerPeriod');
    if (periodEl) {
      periodEl.textContent = latestPeriod
        ? `${currentLang === 'fr' ? 'Données ultimo' : 'Gegevens ultimo'}: ${latestPeriod}`
        : '';
    }
    $('brokerInfo').classList.remove('hidden');
  } else {
    $('brokerInfo').classList.add('hidden');
    $('importControl')?.classList.add('hidden');
  }
  updateView360BrokerInline();
}

async function pdfToCsv(file, generation = pdfImportGeneration) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(new Uint8Array(buffer)).promise;
  let fullCsvRows = [];
  fullCsvRows.push("Type,Hoofdcategorie,Subcategorie,Periode,Aantal Prod,Premie Prod,Aantal Verval,Premie Verval,Verval Klant,Verval Mij,Transformatie,Aantal Progr,Premie Progr,Portefeuille,Uitgegeven Premie,Verdiende Premie,Aantal Schades,Schadelast,S/P %,Afgetopte Schadelast,S/P Afgetopt %");

  let currentCategory = "";
  let currentSubCategory = "";

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    let pageRows = [];

    textContent.items.forEach(item => {
      let y = Math.round(item.transform[5]), x = item.transform[4], text = item.str.trim();
      if (!text) return;
      let foundRow = pageRows.find(r => Math.abs(r.y - y) < 7);
      if (foundRow) foundRow.items.push({ x, text });
      else pageRows.push({ y, items: [{ x, text }] });
    });

    if (generation !== pdfImportGeneration) { await pdf.destroy(); return ''; }
    extractBrokerInfoFromRows(pageRows);

    pageRows.sort((a, b) => b.y - a.y).forEach(row => {
      row.items.sort((a, b) => a.x - b.x);
      let rowText = row.items.map(i => i.text).join(" ").trim();

      const matchedCategory = getCategoryMatch(rowText, currentCategory);
      if (matchedCategory) {
        currentCategory = matchedCategory.hoofd;
        currentSubCategory = matchedCategory.sub;
        return;
      }

      const datePattern = /(0[1-9]|1[0-2])[- ](20\d{2})/;
      if (datePattern.test(rowText) && currentCategory !== "") {
        const dateIndex = row.items.findIndex(i => datePattern.test(i.text));
        let cells = row.items.slice(dateIndex).map(i => i.text.replace(/\./g, '').replace(/,/g, '.').replace('%', ''));

        let finalRow = Array(21).fill('""');
        const isSchade = row.items.some(i => i.text.includes("S/P")) || (p > 1);

        finalRow[0] = isSchade ? '"SCHADE"' : '"PRODUCTIE"';
        finalRow[1] = `"${currentCategory}"`;
        finalRow[2] = `"${currentSubCategory}"`;
        finalRow[3] = `"${cells[0]}"`;

        if (!isSchade) {
          let offset = 4;
          for (let i = 1; i < cells.length; i++) if (i + offset - 1 < 14) finalRow[i + offset - 1] = `"${cells[i]}"`;
        } else {
          let offset = 14;
          for (let i = 1; i < cells.length; i++) if (i + offset - 1 < 21) finalRow[i + offset - 1] = `"${cells[i]}"`;
        }
        fullCsvRows.push(finalRow.join(","));
      }
    });
  }
  await pdf.destroy();
  if (fullCsvRows.length < 2) throw new Error(currentLang === 'fr' ? 'PDF ne contient pas de couche de texte. Utilisez uniquement les chiffres clés téléchargés depuis Salesforce.' : 'PDF bevat geen tekstlaag. Gebruik enkel de kerncijfers gedownload vanuit salesforce.');
  return fullCsvRows.join("\n");
}

// ─── CSV download ─────────────────────────────────────────────────────────────
$('downloadCsvBtn').addEventListener('click', () => {
  const blob = new Blob(["\uFEFF" + csvResult], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Analyse_Kerncijfers.csv";
  a.click();
});


// ─── PDF export: naam/kantoor + KPI's + samenvatting over 4 A4 landscape-pagina's ─────────
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
    fallback.innerHTML = `<div><div class="label">Kerncijfers Non-Life</div><div class="brokerName">Dashboard</div></div>`;
    header.appendChild(fallback);
  }
  return header;
}

function normalizePdfSummaryBars(page, targetMaxHeight) {
  page.querySelectorAll('.prodBarGrid').forEach(grid => {
    const bars = Array.from(grid.querySelectorAll('.prodBarStick'));
    const heights = bars.map(bar => parseFloat(String(bar.style.height || '').replace('px', ''))).filter(v => Number.isFinite(v) && v > 0);
    const maxRaw = Math.max(1, ...heights);
    bars.forEach(bar => {
      const raw = parseFloat(String(bar.style.height || '').replace('px', ''));
      if (!Number.isFinite(raw) || raw <= 0) return;
      bar.style.height = `${Math.max(2, Math.round(raw / maxRaw * targetMaxHeight))}px`;
    });
  });
}
function buildPdfTestPage(summaryItems, includeHeader = false, includeKpis = false) {
  const page = document.createElement('div');
  page.className = 'pdfExportPage pdfTestPage' + (includeKpis ? ' pdfTestPageWithKpis' : '');

  if (includeHeader) page.appendChild(buildPdfHeader());
  if (includeKpis && lastKpiContext?.summary?.length) {
    const kpis = document.createElement('div');
    kpis.className = 'kpis pdfSummaryKpis';
    kpis.innerHTML = kpiCardsHtml(lastKpiContext.summary, lastKpiContext.prevP || dashboardPreviousPeriod, lastKpiContext.currP || dashboardCurrentPeriod, { interactive: false, allowSpToggle: false });
    page.appendChild(kpis);
  }

  const summaryWrap = document.createElement('div');
  summaryWrap.className = 'insightSummary card full';
  const grid = document.createElement('div');
  grid.className = 'insightGrid';
  summaryItems.forEach(item => grid.appendChild(item.cloneNode(true)));
  summaryWrap.appendChild(grid);
  page.appendChild(summaryWrap);
  normalizePdfSummaryBars(page, includeKpis ? 66 : 96);

  return page;
}

function pdfTestSectionLabel(sectionType) {
  if (sectionType === 'verval') return msg('tabVerval') || 'Verval';
  if (sectionType === 'schade') return msg('tabSchade') || 'Schade';
  return msg('tabProductie') || 'Productie';
}

function addPdfTestSectionLabel(clone, sectionType) {
  const title = clone.querySelector('.catTitle');
  if (!title || title.querySelector('.pdfTestSectionName')) return;
  const label = document.createElement('span');
  label.className = 'pdfTestSectionName';
  label.textContent = pdfTestSectionLabel(sectionType);
  title.appendChild(label);
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

function preparePdfTestCategoryBlock(block, sectionType) {
  const clone = block.cloneNode(true);
  clone.classList.remove('manualClosed', 'drillOpen');
  clone.querySelectorAll('.blockExportActions').forEach(el => el.remove());
  addPdfTestSectionLabel(clone, sectionType);

  if (sectionType === 'verval') {
    clone.querySelectorAll('.p-18 > .split').forEach(el => el.remove());
    clone.querySelectorAll('.vervalExtraDetails').forEach(el => el.remove());
    clone.querySelectorAll('.miniGrid').forEach(grid => {
      Array.from(grid.children).forEach((child, idx) => {
        if (!child.classList.contains('miniCard') || ![0, 1].includes(idx)) child.remove();
      });
    });
  }

  if (sectionType === 'schade') {
    clone.querySelectorAll('.p-18 > .split').forEach(el => el.remove());
    clone.querySelectorAll('.miniGrid').forEach(grid => {
      Array.from(grid.children).forEach((child, idx) => {
        if (!child.classList.contains('miniCard') || ![1, 3, 4].includes(idx)) child.remove();
      });
    });
  }

  return clone;
}

function buildPdfTestCategoryPage(blocks, sectionType = 'productie') {
  const page = document.createElement('div');
  page.className = `pdfExportPage pdfTestPage pdfTestCategoryPage pdfTest${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)}Page`;
  const grid = document.createElement('div');
  grid.className = 'pdfTestCategoryGrid';
  blocks.forEach(block => {
    const clone = preparePdfTestCategoryBlock(block, sectionType);
    grid.appendChild(clone);
  });
  page.appendChild(grid);
  return page;
}

async function buildPdfTestCategoryPages(root, sourceId, sectionType = 'productie') {
  const source = $(sourceId);
  const sourceBlocks = source ? Array.from(source.querySelectorAll(':scope > .cat')) : [];
  const measurePage = buildPdfTestCategoryPage([], sectionType);
  root.appendChild(measurePage);
  await new Promise(resolve => requestAnimationFrame(resolve));
  const grid = measurePage.querySelector('.pdfTestCategoryGrid');
  const styles = getComputedStyle(grid);
  const gap = parseFloat(styles.rowGap || styles.gap || '0') || 0;
  const maxHeight = grid.clientHeight;
  let currentBlocks = [];
  let currentHeight = 0;
  const pages = [];

  sourceBlocks.forEach(block => {
    const clone = preparePdfTestCategoryBlock(block, sectionType);
    grid.appendChild(clone);
    const h = clone.offsetHeight;
    clone.remove();
    const needed = currentBlocks.length ? currentHeight + gap + h : h;
    if (currentBlocks.length && needed > maxHeight) {
      pages.push(buildPdfTestCategoryPage(currentBlocks, sectionType));
      currentBlocks = [block];
      currentHeight = h;
    } else {
      currentBlocks.push(block);
      currentHeight = needed;
    }
  });
  if (currentBlocks.length) pages.push(buildPdfTestCategoryPage(currentBlocks, sectionType));
  measurePage.remove();
  pages.forEach(page => root.appendChild(page));
}

function preparePdfTestDetailCatBlock(block) {
  const clone = block.cloneNode(true);
  clone.classList.remove('manualClosed', 'drillOpen');
  clone.querySelectorAll('.blockExportActions').forEach(el => el.remove());
  clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  return clone;
}

function buildPdfTestDetailPage(section, blocks) {
  const page = document.createElement('div');
  page.className = 'pdfExportPage pdfTestPage pdfTestDetailPage';
  const frame = document.createElement('div');
  frame.className = 'pdfTestDetailFrame';
  const detail = section.cloneNode(false);
  detail.removeAttribute('id');
  const titleRow = section.querySelector(':scope > .detailSectionTitleRow');
  if (titleRow) {
    const title = titleRow.cloneNode(true);
    title.querySelectorAll('.blockExportActions').forEach(el => el.remove());
    detail.appendChild(title);
  }
  blocks.forEach(block => detail.appendChild(preparePdfTestDetailCatBlock(block)));
  frame.appendChild(detail);
  page.appendChild(frame);
  return page;
}

async function buildPdfTestDetailPages(root) {
  const sections = Array.from(document.querySelectorAll('#categoryDetails > .detailSectionBlock'));
  for (const section of sections) {
    const sourceBlocks = Array.from(section.querySelectorAll(':scope > .cat'));
    const measurePage = buildPdfTestDetailPage(section, []);
    root.appendChild(measurePage);
    await new Promise(resolve => requestAnimationFrame(resolve));
    const frame = measurePage.querySelector('.pdfTestDetailFrame');
    const detail = measurePage.querySelector('.detailSectionBlock');
    const maxHeight = frame.clientHeight;
    const baseHeight = detail.offsetHeight;
    let currentBlocks = [];
    let currentHeight = baseHeight;
    const pages = [];

    sourceBlocks.forEach(block => {
      const clone = preparePdfTestDetailCatBlock(block);
      detail.appendChild(clone);
      const h = clone.offsetHeight;
      clone.remove();
      const needed = currentBlocks.length ? currentHeight + 8 + h : currentHeight + h;
      if (currentBlocks.length && needed > maxHeight) {
        pages.push(buildPdfTestDetailPage(section, currentBlocks));
        currentBlocks = [block];
        currentHeight = baseHeight + h;
      } else {
        currentBlocks.push(block);
        currentHeight = needed;
      }
    });

    if (currentBlocks.length || !sourceBlocks.length) pages.push(buildPdfTestDetailPage(section, currentBlocks));
    measurePage.remove();
    pages.forEach(page => root.appendChild(page));
  }
}

function pdfDistributionModeTitle(mode) {
  if (mode === 'portfolio') return currentLang === 'fr' ? 'Répartition prime acquise' : 'Verdeling verdiende premie';
  const map = {
    productie: msg('productionPieTitle'),
    verval: msg('vervalPieTitle'),
    schade: msg('schadePieTitle')
  };
  return map[mode] || '';
}

function pdfDistributionCenterText(mode) {
  if (mode === 'portfolio') return msg('verdiendePremie');
  if (mode === 'verval') return msg('verval');
  if (mode === 'schade') return msg('schadelast');
  return msg('productie');
}

function pdfDistributionTotalLabel(mode) {
  if (mode === 'portfolio') return currentLang === 'fr' ? 'Total prime acquise' : 'Totale verdiende premie';
  return pieComparisonTotalLabel(mode);
}

function pdfDistributionEmptyText(mode) {
  if (mode === 'portfolio') return msg('portefeuilleEmpty');
  const emptyKeyByMode = { productie: 'productionPieEmpty', verval: 'vervalPieEmpty', schade: 'schadePieEmpty' };
  return msg(emptyKeyByMode[mode] || 'productionPieEmpty');
}

function pdfDistributionItems(data, mode, period) {
  const raw = mode === 'portfolio'
    ? getPortfolioPieItems(data, period)
    : getProductionPieItems(data, period, mode);
  return raw.map((x, i) => ({ ...x, color: x.color || pieSegmentColor(x.key, i) }));
}

function pdfDistributionPeriods(data, mode, currP) {
  if (mode === 'portfolio') {
    const yearItems = getPortfolioYearItems(data, 'TOTAAL NON LIFE', currP);
    return { prev: yearItems.length ? yearItems[yearItems.length - 1].period : '', curr: currP };
  }
  return { prev: getPreviousFullYearPeriodForPie(data, currP, mode), curr: currP };
}

function buildPdfDistributionChart(data, mode, period, kind) {
  const chart = document.createElement('div');
  chart.className = 'pdfDistributionChart';
  const titlePrefix = pdfDistributionModeTitle(mode);
  const periodTitle = kind === 'prev'
    ? pieComparisonPanelTitle('prevFull', period)
    : pieComparisonPanelTitle('curr', period);
  chart.innerHTML = `<h3>${esc(titlePrefix)}<br><span class="small">${esc(periodTitle)}</span></h3>`;

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'pdfDistributionCanvasWrap';
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 340;
  canvasWrap.appendChild(canvas);
  chart.appendChild(canvasWrap);

  const total = document.createElement('div');
  total.className = 'pdfDistributionTotal';
  chart.appendChild(total);

  const legend = document.createElement('div');
  legend.className = 'pieLegend pdfDistributionLegend';
  chart.appendChild(legend);

  const items = pdfDistributionItems(data, mode, period);
  renderStaticPieLegend(legend, items, pdfDistributionEmptyText(mode));
  drawPortfolioPie(canvas, period, items, -1, pdfDistributionCenterText(mode));
  const totalValue = items.reduce((sum, x) => sum + x.value, 0);
  total.innerHTML = `${esc(pdfDistributionTotalLabel(mode))}<b>${euro.format(totalValue)}</b>`;
  return chart;
}

function buildPdfDistributionPage(data, modes, currP, pageTitle) {
  const page = document.createElement('div');
  page.className = 'pdfExportPage pdfTestPage pdfDistributionPage';
  const title = document.createElement('div');
  title.className = 'pdfDistributionTitle';
  title.innerHTML = `<h2>${esc(pageTitle)}</h2><span>${esc(currentLang === 'fr' ? 'Répartitions' : 'Verdelingen')}</span>`;
  page.appendChild(title);
  const grid = document.createElement('div');
  grid.className = 'pdfDistributionGrid';
  modes.forEach(mode => {
    const periods = pdfDistributionPeriods(data, mode, currP);
    grid.appendChild(buildPdfDistributionChart(data, mode, periods.prev, 'prev'));
    grid.appendChild(buildPdfDistributionChart(data, mode, periods.curr, 'curr'));
  });
  page.appendChild(grid);
  return page;
}

function buildPdfDistributionPages(root, data, currP) {
  root.appendChild(buildPdfDistributionPage(data, ['productie', 'verval'], currP, currentLang === 'fr' ? 'Répartitions production et chute' : 'Verdelingen productie en verval'));
  root.appendChild(buildPdfDistributionPage(data, ['schade', 'portfolio'], currP, currentLang === 'fr' ? 'Répartitions sinistres et prime acquise' : 'Verdelingen schade en verdiende premie'));
}

function preparePdf360Block(block) {
  const clone = block.cloneNode(true);
  clone.classList.remove('view360Collapsed');
  clone.querySelectorAll('.view360CollapseToggle').forEach(button => button.replaceWith(document.createTextNode(button.querySelector('.view360BlockLabel')?.textContent || button.textContent)));
  clone.querySelectorAll('.blockExportActions').forEach(el => el.remove());
  clone.querySelectorAll('canvas[id]').forEach(canvas => {
    const source = document.getElementById(canvas.id);
    if (!source) return;
    const img = document.createElement('img');
    img.src = source.toDataURL('image/png');
    img.alt = '';
    img.width = source.width;
    img.height = source.height;
    canvas.replaceWith(img);
  });
  clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  return clone;
}

function buildPdf360Page(blocks) {
  const page = document.createElement('div');
  page.className = 'pdfExportPage pdfTestPage pdfTest360Page';
  const frame = document.createElement('div');
  frame.className = 'view360Frame';
  blocks.forEach(block => frame.appendChild(preparePdf360Block(block)));
  page.appendChild(frame);
  return page;
}

async function buildPdf360Pages(root) {
  render360View();
  await new Promise(resolve => requestAnimationFrame(resolve));
  const source = $('view360Content');
  const sourceBlocks = source ? Array.from(source.children).filter(el => !el.classList.contains('hidden')).flatMap(block =>
    block.classList.contains('view360GroupedBlock')
      ? Array.from(block.querySelector(':scope > .view360CollapseBody').children)
      : [block]
  ) : [];
  if (!sourceBlocks.length) return;

  const measurePage = buildPdf360Page([]);
  root.appendChild(measurePage);
  await new Promise(resolve => requestAnimationFrame(resolve));
  const frame = measurePage.querySelector('.view360Frame');
  const styles = getComputedStyle(frame);
  const gap = parseFloat(styles.rowGap || styles.gap || '0') || 0;
  const maxHeight = frame.clientHeight;
  let currentBlocks = [];
  let currentHeight = 0;
  const pages = [];

  sourceBlocks.forEach(block => {
    const clone = preparePdf360Block(block);
    frame.appendChild(clone);
    const h = clone.offsetHeight;
    clone.remove();
    const needed = currentBlocks.length ? currentHeight + gap + h : h;
    if (currentBlocks.length && needed > maxHeight) {
      pages.push(buildPdf360Page(currentBlocks));
      currentBlocks = [block];
      currentHeight = h;
    } else {
      currentBlocks.push(block);
      currentHeight = needed;
    }
  });
  if (currentBlocks.length) pages.push(buildPdf360Page(currentBlocks));
  measurePage.remove();
  pages.forEach(page => root.appendChild(page));
}

function selectAllPdfSections(selected) {
  document.querySelectorAll('#pdfOptionsMenu .pdfSectionCheck').forEach(input => {
    input.checked = !!selected;
  });
}
function selectedPdfSections() {
  return new Set(Array.from(document.querySelectorAll('.pdfSectionCheck'))
    .filter(input => input.checked)
    .map(input => input.value));
}

async function exportSummaryPdf() {
  if (!lastData) return;
  const mainBtn = $('exportPdfBtn');
  const optionsBtn = $('pdfOptionsBtn');
  const optionsWrap = $('pdfOptionsWrap');
  const oldText = mainBtn ? mainBtn.textContent : '';
  try {
    const selected = selectedPdfSections();
    if (!selected.size) {
      alert(msg('pdfNoSections'));
      return;
    }
    if (optionsWrap) optionsWrap.classList.remove('open');
    if (optionsBtn) optionsBtn.setAttribute('aria-expanded', 'false');
    if (mainBtn) mainBtn.disabled = true;
    if (optionsBtn) optionsBtn.disabled = true;
    if (mainBtn) mainBtn.textContent = msg('pdfBusy');
    document.body.classList.add('pdfExportBusy');

    if (selected.has('summary')) renderDashboardSection('samenvatting');
    if (selected.has('view360')) renderDashboardSection('view360');
    if (selected.has('productie')) renderDashboardSection('productie');
    if (selected.has('verval')) renderDashboardSection('verval');
    if (selected.has('schade')) renderDashboardSection('schade');
    if (selected.has('detail')) renderDashboardSection('detail');
    const summary = $('insightSummary');
    const items = summary ? Array.from(summary.querySelectorAll('.insightItem')) : [];
    if (selected.has('summary') && items.length < 4) throw new Error(currentLang === 'fr' ? 'Résumé incomplet.' : 'Samenvatting is nog niet volledig opgebouwd.');

    {
      const root = document.createElement('div');
      root.className = 'pdfExportRoot';
      if (selected.has('summary')) {
        root.appendChild(buildPdfTestPage(items.slice(0, 2), true, true));
        root.appendChild(buildPdfTestPage(items.slice(2, 4)));
      }
      document.body.appendChild(root);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (selected.has('productie')) await buildPdfTestCategoryPages(root, 'prodGrouped', 'productie');
      if (selected.has('verval')) await buildPdfTestCategoryPages(root, 'vervalGrouped', 'verval');
      if (selected.has('schade')) await buildPdfTestCategoryPages(root, 'schadeGrouped', 'schade');
      if (selected.has('distributions')) buildPdfDistributionPages(root, lastData, dashboardCurrentPeriod);
      if (selected.has('detail')) await buildPdfTestDetailPages(root);
      if (selected.has('view360')) await buildPdf360Pages(root);
      addPdfTestPageNumbers(root);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const pages = Array.from(root.querySelectorAll('.pdfTestPage'));
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          windowWidth: pages[i].scrollWidth,
          windowHeight: pages[i].scrollHeight
        });
        if (i > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST');
      }
      root.remove();
      const name = brokerInfo?.name || $('brokerName')?.textContent || 'Dashboard';
      pdf.save(`${makeSafeFilePart(name)}_samenvatting.pdf`);
      return;
    }

  } catch (err) {
    console.error(err);
    alert((currentLang === 'fr' ? 'Impossible de créer le PDF : ' : 'PDF kon niet worden gemaakt: ') + err.message);
  } finally {
    const root = document.querySelector('.pdfExportRoot');
    if (root) root.remove();
    const testRoot = document.querySelector('.pdfTestScreenshotRoot');
    if (testRoot) testRoot.remove();
    document.body.classList.remove('pdfExportBusy');
    if (mainBtn) { mainBtn.disabled = false; mainBtn.textContent = oldText || msg('exportPdf'); }
    if (optionsBtn) optionsBtn.disabled = false;
  }
}

$('exportPdfBtn')?.addEventListener('click', exportSummaryPdf);
$('pdfOptionsBtn')?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  const wrap = $('pdfOptionsWrap');
  if (!wrap) return;
  const open = !wrap.classList.contains('open');
  wrap.classList.toggle('open', open);
  $('pdfOptionsBtn')?.setAttribute('aria-expanded', open ? 'true' : 'false');
});
$('pdfOptionsMenu')?.addEventListener('click', e => e.stopPropagation());
document.addEventListener('click', () => {
  const wrap = $('pdfOptionsWrap');
  if (wrap?.classList.contains('open')) {
    wrap.classList.remove('open');
    $('pdfOptionsBtn')?.setAttribute('aria-expanded', 'false');
  }
  const viewWrap = $('viewDropdownWrap');
  if (viewWrap?.classList.contains('open')) {
    viewWrap.classList.remove('open');
    $('viewDropdownBtn')?.setAttribute('aria-expanded', 'false');
  }
  const kpiWrap = $('kpiSelectorWrap');
  if (kpiWrap?.classList.contains('open')) {
    kpiWrap.classList.remove('open');
    $('kpiSelectorBtn')?.setAttribute('aria-expanded', 'false');
  }
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
  const targetSlot = activeSection?.id === 'view360'
    ? null
    : activeSection?.querySelector(':scope > .card .titleExportRow > .sectionToolbarSlot');
  const fallback = $('dashboardToolbarHome');
  const target = targetSlot || fallback;
  if (target && toolbar.parentElement !== target) target.appendChild(toolbar);
  toolbar.classList.toggle('contextualToolbar', !!targetSlot);
  toolbar.classList.toggle('kpiToolbar', activeSection?.id === 'kpiOverzicht');
  toolbar.classList.toggle('hideViewDropdown', ['samenvatting', 'view360', 'detail'].includes(activeSection?.id || ''));
  toolbar.classList.toggle('hidePreviousYears', !['productie', 'verval', 'progressie', 'schade', 'kpiOverzicht'].includes(activeSection?.id || ''));
  toolbar.classList.toggle('hideDrillButton', ['samenvatting', 'view360'].includes(activeSection?.id || ''));
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
function triggerKpiMotion(wrapper = document.querySelector('.kpiExportWrap')) {
  if (!wrapper || motionIsReduced() || document.body.classList.contains('pdfExportBusy')) return;
  wrapper.classList.remove('motionActive');
  void wrapper.offsetWidth;
  wrapper.classList.add('motionActive');
  window.clearTimeout(wrapper._motionTimer);
  wrapper._motionTimer = window.setTimeout(() => wrapper.classList.remove('motionActive'), 950);
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  setActiveTabColor(b);
  $(b.dataset.tab).classList.add('active');
  moveDashboardToolbarToActiveSection();
  if (lastData && dashboardCurrentPeriod) {
    renderDashboardSection(b.dataset.tab);
    updateTopKpisForActiveTab();
    renderActivePie(lastData, dashboardCurrentPeriod);
    formatDisplayedPeriods($(b.dataset.tab));
  }
  triggerMotionRefresh($(b.dataset.tab));
  // Geen automatische scrollpositie-wijziging bij tabwissel.
}));
setActiveTabColor(document.querySelector('.tab.active') || document.getElementById('tabSamenvatting'));
document.querySelector('.hero .panel')?.prepend($('uploadLogo'));
placeLanguageSwitch();
moveDashboardToolbarToActiveSection();

// ─── Dashboard logica (volledig uit dashboard.html) ───────────────────────────
const cols = {
  type: 'Type', hoofd: 'Hoofdcategorie', sub: 'Subcategorie', periode: 'Periode',
  prodAantal: 'Aantal Prod', prodPremie: 'Premie Prod',
  vervalAantal: 'Aantal Verval', vervalPremie: 'Premie Verval',
  vervalKlant: 'Verval Klant', vervalMij: 'Verval Mij',
  trans: 'Transformatie', progAantal: 'Aantal Progr', progPremie: 'Premie Progr',
  portefeuille: 'Portefeuille', uitgegeven: 'Uitgegeven Premie', verdiend: 'Verdiende Premie',
  schadeAantal: 'Aantal Schades', schadelast: 'Schadelast', sp: 'S/P %',
  schadeCap: 'Afgetopte Schadelast', spCap: 'S/P Afgetopt %'
};

const dataIndexCache = new WeakMap();
function emptyDataIndex() {
  return {
    rowsByType: new Map(),
    rowsByTypePeriod: new Map(),
    rowsByTypeHead: new Map(),
    rowsByTypePeriodHead: new Map(),
    rowsByTypePeriodSub: new Map(),
    rowsByTypePeriodHeadSub: new Map(),
    mainRowsByType: new Map(),
    mainRowsByTypePeriod: new Map(),
    mainRowsByTypePeriodHead: new Map(),
    categoryRowsByType: new Map(),
    totalRowsByTypePeriod: new Map()
  };
}
function dataIndexKey(...parts) {
  return parts.map(part => normKey(part)).join('|');
}
function getDataIndex(data) {
  if (!Array.isArray(data)) return emptyDataIndex();
  const cached = dataIndexCache.get(data);
  if (cached) return cached;
  const index = emptyDataIndex();
  const push = (map, key, row) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  };
  data.forEach(row => {
    const type = String(row[cols.type] || '').trim().toUpperCase();
    if (!type) return;
    const period = String(row[cols.periode] || '').trim();
    const head = String(row[cols.hoofd] || '').trim();
    const sub = String(row[cols.sub] || '').trim();
    push(index.rowsByType, type, row);
    push(index.rowsByTypePeriod, `${type}|${period}`, row);
    if (head) {
      push(index.rowsByTypeHead, dataIndexKey(type, head), row);
      push(index.rowsByTypePeriodHead, dataIndexKey(type, period, head), row);
    }
    if (sub) push(index.rowsByTypePeriodSub, dataIndexKey(type, period, sub), row);
    if (head && sub) push(index.rowsByTypePeriodHeadSub, dataIndexKey(type, period, head, sub), row);
    if (head && sub && normKey(head) === normKey(sub)) {
      push(index.mainRowsByType, type, row);
      push(index.mainRowsByTypePeriod, dataIndexKey(type, period), row);
      push(index.mainRowsByTypePeriodHead, dataIndexKey(type, period, head), row);
      if (!isTotalNonLife(row)) push(index.categoryRowsByType, type, row);
    }
    if (isTotalNonLife(row)) push(index.totalRowsByTypePeriod, dataIndexKey(type, period), row);
  });
  dataIndexCache.set(data, index);
  return index;
}
function rowsOfPeriod(data, type, period) {
  return getDataIndex(data).rowsByTypePeriod.get(`${type}|${String(period || '').trim()}`) || [];
}
function rowsOfHead(data, type, head) {
  return getDataIndex(data).rowsByTypeHead.get(dataIndexKey(type, head)) || [];
}
function rowsOfPeriodHead(data, type, period, head) {
  return getDataIndex(data).rowsByTypePeriodHead.get(dataIndexKey(type, period, head)) || [];
}
function rowsOfPeriodSub(data, type, period, sub) {
  return getDataIndex(data).rowsByTypePeriodSub.get(dataIndexKey(type, period, sub)) || [];
}
function rowsOfPeriodHeadSub(data, type, period, head, sub) {
  return getDataIndex(data).rowsByTypePeriodHeadSub.get(dataIndexKey(type, period, head, sub)) || [];
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

function n(v) {
  if (v == null || v === '') return 0;
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
  ['summary', 'view360', 'prod', 'verval', 'prog', 'schade', 'portefeuille', 'kpiOverview', 'detail'].forEach(key => {
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
function isTotalNonLife(r) { return String(r[cols.hoofd] || '').trim().toUpperCase() === 'TOTAAL NON LIFE' && String(r[cols.sub] || '').trim().toUpperCase() === 'TOTAAL NON LIFE' }
function mainRows(data, type) { return getDataIndex(data).mainRowsByType.get(type) || [] }
function categoryRows(data, type) { return getDataIndex(data).categoryRowsByType.get(type) || [] }
function totalRow(data, type, periode) {
  const periodRows = rowsOfPeriod(data, type, periode);
  const candidates = getDataIndex(data).totalRowsByTypePeriod.get(dataIndexKey(type, periode)) || [];
  const fallbackCandidates = periodRows.filter(r => String(r[cols.hoofd] || '').trim().toUpperCase() === 'TOTAAL NON LIFE' || String(r[cols.sub] || '').trim().toUpperCase() === 'TOTAAL NON LIFE');
  const all = candidates.length ? candidates : fallbackCandidates;
  const start = type === 'SCHADE' ? 14 : 4;
  const hasNumericData = r => r && r._cells && r._cells.slice(start).some(x => String(x ?? '').trim() !== '' && n(x) !== 0);
  return all.slice().reverse().find(hasNumericData) || all[all.length - 1] || {};
}
function totalNumber(row, field, cellIndex) {
  const byName = n(row[field]);
  if (byName !== 0) return byName;
  if (row && row._cells && row._cells[cellIndex] !== undefined) return n(row._cells[cellIndex]);
  return byName;
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
function nonTotalRows(data, type) { return rowsOf(data, type).filter(r => !isTotalNonLife(r) && String(r[cols.hoofd] || '').trim().toUpperCase() !== 'TOTAAL NON LIFE' && String(r[cols.sub] || '').trim().toUpperCase() !== 'TOTAAL NON LIFE') }
function groupedCats(data, type, period) { return [...new Set(nonTotalRows(data, type).filter(r => r[cols.periode] === period).map(r => r[cols.hoofd]).filter(Boolean))] }
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
  rechtsbijstand: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRAD/AP8A/6C9p5MAAAAHdElNRQfqBB0JEhPfY7FEAAAAEGNhTnYAAAF+AAABDgAAATEAAABadYj8OwAAF6xJREFUeNqVm3mQXdV95z/nnHvf60W9SGpJjSSEJISEkBUwXgCZJdhxgHEw2LHB4KXK8aQqizNJqhw7sZNJOVOTFIknkzgZXMlUxhkPOI4dkYQxGMZsIcggJEAGYgSRWNQ0ktDW6lZ3v/fuPec3f5x77j1vaSFuFfTTfe/ec37b97ce5ZwTpRQiAkD8Ob4Wut95CYD43wqCiL8nAq74R+dbFKBUtU55T4fvVNtvuhbsuH+6vYbvyr/Oubem6q2IlmovIiAiOCmIRhAHVqRkQry3kjClQPwfrRRKgdF+w1pVjNBqAUZEb1SARGxWBYekg/VKKZKFuNiLkwrV9ZIgYSfgnOBEir9Uf4v/KukXC6pqWRHnGVPcM1phtEIpwWiFVgqjBVcwSJca061N3ezoTTzQrQG9iFxI6rFqWydYB9YJuZVS0p4QjTGV9BSVGYioDlMRxAm2YGBQ10QrjKkYYxTF+1RPjThTOk5rAj1tKZK4LSQeE+9coVqJ37QKopIOiQWCuzZeiVEc5M6R50LuHFpBohWJ8UxItEJrVTI1ZkQvBvS8FzMgVpdSSuX/VLlhEbDOkVshdxQSB2MUNeOlHWtJl2qqigGqY4uRTbRtVZyQWb+mVl4TEhOYUJlFt0moLjxo+/eZmIAUxukidffEC7n1Eq+l2ttsqT2wkNOQiHJVLYxq8xCxoRSfFTgHWW7JckFrqJlKIzxWvBVIttOqnHMSiI6Jjz+LVCqfOyHLvSQERS3RJIlu225MWFDpmBkxWQGMOiXetlEVNKr6RW6FZuYQEdJEkUaM0D1MojcD8F6gJDQQryq7jYkPKtjMBK0V/XWDVl1K3K660GXoquv704OVB8JIqwpz69eGVm7JrFRvEwVao3VPx9Z1L+lUCY/IPSRvPRi1rJAkmr7UdHNYpI3tgXileuwimEFEfMfjbRgRxxoKQLyLrKcGox2trHCjibclJQoHpbts21O0DSWRXknHZoIvz6wjs0JmITGaeqq7wK3aWDeb21W+k2eqA2K7wrpyQwuaCF5IzcxilCJNIoDsCYzVvhIRQfXYsRTE507IrNDKhTQx1FPdpUpt225DwU6eey0zJniSyuP4RyLT6xQ93bAYv9VoqKeGRssiuQAel9AKHfGxpwl0oT4F2ouXfisXjNHUCuJ7Sbf7C+n6XinFzHzOrhdOIuJ416ZRhgaTTkH3fnGI3MqcpfpN2L/RinpqaGYeF4LGKapgKUB8+JR0LFNIvpC+dYW70dRT0yZtKQy2N9CqtqUC8bPzGV/+5gHuf+oEks9z42XjfPWz6xns06XJLXjFABG0S0mXdzFGURNNM3coBKU0ygCiIjyoHtKqw0AqxPc270TRV9Ola6lIVKiFxd8hPEVi4Ln9M/zw6SP80efW8Huf2ci9u1u8Mtkg0R0ZI+20okK0F0Qu5e/DakEwCkgSTWI0mYXc+bhFpLezqXRaqgTGiiuDnVqqvasr0tt4wXZnfxrhFbG+0gqkwdGpeaZmFIlJSIwqM8eY8FLQUqm9tIFNNxrEd+qpRinIco9jbgEQTUqXh/KZXIj0HBitqSWeR9JuRG9JdCBAKU9gy8KWdUPcfPVK/vOdk2BTfuPGcTasrmMLEAuGE0uXTiyVyv6FKHYRhahYtT0TGk1LbsHoAhN0lDzF9QAnYK23+2buyCz01RNM7EglIHWxaAh9pUDzAhNEvPZMz2YcODjH3olpXpmc5uAJy+RJw95DFiUZm1dq1o4Z1o4Pcd7ZQ2xcPchZS+rU6xpRujJ7EZx0mkHhKcqcor0KECLQ+WaOOKGeau8eO4KkpFTpQvre7YHWGqNUe3Cigq6A1vDmsQaNzLJ4qEZmhenZFpNHmuzZN8VTLxxj/2STqVNN+tOcsZE6Q0MDPLMP/tsvn8tcM+f3vvkiLq/z7P55pmYP4iRhxbBiy9mGLetHOH/dKKtXDDLQl9DKhKmZFmOjNZYM10riK2X0AijxAZ9b1BLDXCMns76uILrgXEilnXMiBfC1ckczc7QsDETS79R+EBIFt//Da/ztA8cYGk2wrXlmpufIMmFoQLNpdT/vvmAp79q4lNUr+hnqT2jlwi99fR/NXJHbFkP9mr/4/Pn0JTA1k/HS63Ps+slRnvrJG7zy+nEaGQyNjLFoZDHNDBpzs3zl1rV85OqV5I6O+KEKpzqDpkbT4pyjr6apJ1VtAops0DrIraOVOxqZoLRmoNYR6kYAFD4en25xz85j/O4dB2g2Wvz+rWdz+TsWM760zsiiOn2pxmhvXrkDrYQ9+2e4+Q/3MTRg+dYXNrHp7CGMVhRelpaFU/MZx47PMXlkjrt3TvON++bYsiblq58e5/ItI/T3J4hbONnpjCetE+aaObVE0ZdqUqPLCDEJ7sGFOh5QT3TPdLYMZQWswOLhOrVEYcjprycICT913gjWeYt0Iljrnws5/FmjdQb7E5YtrnHO8n4S7euGzbyqHwz2JYysHmH96mHu2tVkbKTB7Kxl9dI6S4ZTWjk4LW31htNdPkPUWOuwWjwgFnilQxEzMCGUnySmOuKsRHZ3fLrFnQ9M8v4LR/nYtsX8/aNHeeNoC4WglRQFzirnsU6Ya1myvFW5xgBkUYHE1wThxy/P8sCeY/ynGxezbCTj7x4+zHzTYaW3cHp9DldqlK9ahbWK57V3M1J4Ae/6QmGmHfwq6pWCeqLYtXeGFydb3PL+cT5x9Vkcm3M89m/T1BNKtxYzzwq0Cr9sHbjShj2jSrvExyPbd0wzOjTArT+9ghu3jXHv7hleOtj0z0eCaCulR+uVQsNHiEIo21XxjA7St0UFNzEqCmTbjUopVWpBo2W5a8dxtp43ynvPH2HLukVcdsEI33t8htl5hybEFlVFOFHBJg259QwP4W+pLQUVLx9s8oOnT3HzFUtZvbTGjZcvx6QJ9+w8iY4SqFgw3RpR/cr7f1VWqoMW6BD3h0jJ6HahVwlFVP4W2LNvlidenOWT71/O2FDKUH/CJ69awt6JBj/aO4tFVSFo8SKjC3MDsmaOtdJmUoEW64Ttjx3DuSYfes8wKMXa8X6uuXiIf/zRIQ4dbxU9g1hGHVFq8a+YDmOUrzZLVfPQwf87FxoS3RYUZ2pOIMsdf/fIUcaXaK7eOoxCMBret3mYzatT7nj4KKfmrLe3DtXMcykLqjaoYmSTRsObJzK27zjCNRcPsmqszlwGLae4/tJRDp+Y5/7dx9v3VmR8ElEvHe9V+IpyWecIGiARYZ01+15qZRTsn5znh7uPcsNlYywfrXl7drCoP+Hmy0fY8ZMpnt5/qqzP6UKrrEAzF0QUYMqFggcCSA088uw00/OOj71vGTUDugDMC9cNcfkFI9z12DFm5myprbThQWdtotKCUL5zUV6jw/NOfJ2v5xUQs/DX9+w8QZoI171nlFYojYsvl13xjhHGRxT/tONNtDhPQPFa56CVCdZpRHRpdoIqNeXkrOXv/3WGbVuWsHXtYMmYRAvDA4ZPXT3OS5OOx39yqgzUyvwhKrFVAB7hQEfNQUQKBkiUbqtuNxI0wijh6FSL+3Yd5bpLlrJuRZ+vHRTVndzB2EjKR7eN8dCeBgeOeFsNWqYUWOvAWmxmsVbKTTkBK4qH9szwwsQMN185SmIUuavU1Tph25YhLjwn5dsPHmFmzvqqUowjHQTHCVagL9BbeYFIRVRUIIvNI7zgwWdO8uZJx01XrfB1Al2Bo2eS5obLllIzwr1PnvR2Vu5EaLZysE3Ic5wTagaSAtBm5zPueOB1Nq0yvGfjIg/KxaNOILMwNJDysSuXsOP5N3hy7wkWvCI8iFhSFH4LgVBgQGk/bfKuMqrwgpOzOd99eIJtF9TYum7Qd3CLenwtUdRTRS2BjasG+NAli7l75wzHZ6wPigqVa2UWQ44S78u18kTWE8Wz+2fYvW+aW65eythwUr4v0f531sF8BldcOMrm1Yb7nniDzEoX0LbxIQhPAiS0R1FJ4IlEnOlUoZA+bv/RIXY8f4xr3jnKX2/f520oMSSJwRgN+F6iwzF9qskLE/P8w6NH+IVrV5Tbs1ZItVfMPPdb1xqOnmjyP//5NeabTV7cf5z//uYcY0N1PnTFChYPpzStJ+TY1DyL+mvc/psXMzOXlQFU3HOMiQ/3JCYqqiElJVYsgP2+Jy8453ho1yEkb/Hyqyd4Zf+bKOXQaYpK+1AmRdBFm7uJUwl5K+WfdxzmpqvG6OtLMEb7NlqtjkPRyB1N6wOk/ROnePiZKZYuVjy4+xBrzxrl41euZLDPYDQcOzLLXQ+8xHfufY4LN43z2Y9cxE9tXEqa6rZWfFvxpCMULSE3SuqSOOYPHZjAOVeohFNg0GxZ28+Tz+d8/bcuY/WKAZSCNO4A44HQOuHQ8Qafve3f2LS6jk4M1nlVFoE0qWFUTjP3qbdTwtkrB1l3Vj+fvm4lP3/lCvrqCf2pYvLwDD/80QR33PsiE4eP8u7Ny9j97AQPPv4a11y+kZuuOY+tG5fSP1D3WOTag5/SrceCLwTrW2OF+ugibG37bdQUzYEPXLKSv/3+Ph7YdZAvfGoLtUSVjAqewAHOOf7P/QeZmcu54Ypx3y0u3p3njppyaHynCYHMwehQjS9+ci0XbRihbuDhx1/hnof+nSd+/AaZM3xg21r+y+ffy4Xnr+D4iTl+8OjLfPeHr3Dvo6+wYfUAV713NVdfso4tG5cXmlZqeRkflIFZqGYrRaLDDSXFQEKlNVqpUqWcwIY1o/ziRy/gz777MotHBvnMtWcz0J+UrkopmG9YvvP/Jvgfd73Kf7x+DZdtHqkWF2hmOUa1wAnWuipwUYr/cNk4NQO3/c1T/OWdO9m6foTP3LCZn73iXDauGyNJDFaEc1aP8qufvJibrjufHXte5/uPvMj/vusJtt/zDHf++S2sPXtJVMSNvFpA/ggxk0C8Ur6E3JZXlJsTEuUnPT734fWcmoev3bmPB58+xs9tW8E5430IiomjLe7dOcXjz0/xiZ9Zxec/ugajtYfYgpOtVgst86BSDEI98UmRZ7hf/LWD01xw3jjfuu1ahocHvCYWabtRhb0DwyMDXHvVRj74vnP5/oN7+crXHmFmNivtu7PJa12k/m0mQNVrcCLtEVYRAIS8vr+e8IVbz+Vdm4b55g8m+JNv76XVnEPEkdYG2bh+OV//tfO45t1LMUaTuahDoxQ2t9S0xanUl68NNIsCixUQC7iMgbrQV0+xtors4j6AE4WVMJhhWDzUR2J8LqEVXeYMvqVOVKNQFBmqn67wK1hXFA+p4oCgLk78xJfSmg9eMs7lFy1j4vA8h47PISKMjfazavkAQ/0JFF3moH5OKKTnGEg1VoRWy5EH7CgY4JzgbAvEohXUTGU+ZQKjFROTJ7hz+24+9uGLOH/DMoqhFDQebFuuigGC+lvnfGAVpd2JUt4PG+39fZ4LtaQ9He58EXikN0azbtUi1q9e5O9JMcFho2pQgUZlyGyFvpohz4W5Rk4zL/CjsE1twJgEpdOyVpjgqzkt6xu5R45M8+Xb7ufVyaPcfMOF1LXvWiudIkq15fuBCFukwNpUWa/yDKCYyVMk2jdDnZiqjxbpUAc8FAypSltaKlMqe31FFGgKJue5Q0mOy4VmKyueDVNfXvuSJCG3Vd5+/6P7ee2NaW69YSunZlt8+WsP8uKBo9z+1eu5YMPyUiAhrc9cFboHRuSFKbVNkAQTUCrM4Sky6yeyakWu2TnU2N6eopwkK5kQuduQ6akiJdYabG4R18IVBZP+GiV3c6uwVhjqN5w4McXsXAtj+jlw6CR/cPtDTByZ4uiRWXY9N8Gf/u51XPLONWRWqCeKQ8caJGnC0KK0XDwWWJ67QgiqHMT0kWAhOV0OGQlZ5qiZHqlhZ72ZECtU5hF+YrS354lDM+x67jBTMw2MFnY+d5B9kzO0nOGhJw/QapzCWsfQYI13bjmLlcsWce6aEb537wlePzTD5uEBbvq5rczMNvjj//UUffU6f/rb1/Czl28o449W7njupTdYuazO2Gg/WglWVW4vaEc9qYgPMJ8EhFUKP11hFM3c5/iJiaA3ljq9r7KugGJ+LuMb39nD3f8ywezMPIlqARnolLrpo88onv7xJHuefRXnck41GmxYP87tX/kg2y5eg06HeOTJSS7aPE46kPKrn76UVeNLSGsp1155ru8z4Pd45OgsDz/+Mu9/33oG+msl4cELeukXw5a6sn+I5gNC5cYYhbZCK3MkHX1BT7yqEF51s0PEN1nvuPsFvnX/v/Prt1zMle9cQX9Nl1Of3rpU0V/w/chDR0/xZ9v3cuDwHJe9Y4yPfGAD3/6/z3P91es5d81itDH8/HWbsTZUdv0MkCBs/8GLHJtucP0HNhf5SHC9CuscVoTUdKo/1ZicgB9odkLm/PhZKxcG6oYkYMFpJB845O1d8dqBE3z8i99numnZtmUFBodDI6Eb73JEcmzusM6B0mhT44XXMy46d4S//NKlvHl8jlt+4y4u3rqC237rgwwu6o8ASEqQe2L3a/zi79zNjddt4fd/7aeLrLS6Gi1bqn8t0V2zhEkpQ+Xdg1FCYrxvbrQcg306KiVJz6JpbBgCLFpU4xPXbuLYVAOcwznnJzV04tNulyMu91xH0Magdco5Z6WctdQ3Ps85eylf+uUr+NIf38dtf/0YX/6lKxkeqpNZb6paCTufPcyX/uRf2LxxGb/yqfeitK5qA8pjgwdJyoGpzqGpYlCycFtUI3Gt3M8DpomhrxawPcojo/paOQ+FByWtIC0isrJaJL5mFz63sU5RjrxCMQRpFc5Ztt/zPP/1rx7n0otW8cXPXcLmDctpNjPueXg/f/hXu1l/zjBf++KVnLNqlFYupSgEYa5hizmB3tIHUFK0SWLfXTIh84XOvrohjVWrxzygottM4smsKqyOF4/gRbWX4kIwkyjhkSde5g++8a9MTTf4+LVbeHVihseefoMP/8wGvvAL72Z8bFHZ2AkMnm/5jnA91dSMLqZIQ5EnaKu0j8r6DMqDWG6r8TjrhP560pbWdmBjmyEsOCdccklVQxUd7wodnWpq1c8Dv37oJH/zvWfYft/zrBgb4Vc+dSnXXLGOWi3xNYAo5Wtkvs1fSxT1RJOGEdqy6aOq+ocU51ji/YbMKbeOzDqaRd7e35eWat1ZgeqsQlcMOF2noZuZ/teqmPCq3mC0IreO1w9OUe+rs3h0sGNwy6/Ryh2tzJJoqCWadCHVD6yWeC6W9sML5VR4YAKK/lqC6mifxaSykPQ5E0/SW2vifB7l8w0hyuoKHjczR6Mgvp7qYoBa95wWDUwomqPSNvVVFkOLVnlidFH9kcK2ItWNAsbOompJeNS9bceO3pxqC6WjxCbE71GVvWRMM3M0M0tivOQT/dbj84KgrLWykGsrBycc5chslnuw6asZ0kSf0UmydrafRkV6MKKzrFXtK3z2QZt1jsT4SLay+Xg4shJACJQE3uLUmEQd4WLgMHOeCbkV0kRTr+m20plEz55uXj+cTwhEeFzsnjztVeAN93MrNFoWEGpGkZaSp2u+SXUSXrwx4XRXMAWo5usiaWTWYRt+BM2E5Cl6tmvzER6GDk3YXCfD2s4WBcaWqi9+lC9zxakR7+YSU0m9rUkaAVMY8S29TC8N6BXxhU34wkZ1ZKaVu2Ko0g8qJ0aV42pv1wMEHsUpRlsZLJpfVkrKA1SlvZ/JkZnOWOSMj80J1WBikcSEmeLcSnRwShd2qNtPebCwOsffhT34Qw9VdNrKvEvWUJ4H8Mfn2sHuTM8LlWuJvypVDGpyGs5V2lCd74vPDNpC+v6sX0hB26OwLuUIR/TimeXivzBAHVLaTpDrdWyu3PZp85cOBrydK64TBk/ReYYwfA6bqDYc19uqjUpROyzHV7RvXBgVjsYVhRt1hup+Jhrwts4Ox1XGCLUCM+J5wyDBoCXhu9JbSFUuq8rm/u26yEy1rmp4ZSVH9QK5sKszOy36thhwJqfG4yAoDl7C8dkyuow/l/IPBQopY/QQhKmYcGKXVsiDjv7f22DEwmeH34LgEifa5gjanynNIwK/UDiNbncxUbVFjP6+LuLcONmpnqA3onbuq1cYXND5/wG4ke/XmYiL1gAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyNi0wNC0yOVQwOToxNzo0NyswMDowMHtoUawAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjYtMDQtMjlUMDk6MTc6NDcrMDA6MDAKNekQAAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDI2LTA0LTI5VDA5OjE4OjE5KzAwOjAwtPTmewAAAABJRU5ErkJggg=="
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
function totalRowsFor(data, type, prevP, currP) {
  const rows = [totalRow(data, type, prevP), totalRow(data, type, currP)]
    .filter(r => r && r[cols.hoofd]);
  const seen = new Set();
  return rows.filter(r => {
    const key = `${r[cols.type]}|${r[cols.hoofd]}|${r[cols.sub]}|${r[cols.periode]}|${(r._cells || []).join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
  const schadeRows = rowsOf(data, 'SCHADE');
  const schadeTotalRow = schadeRows.length ? (totalRow(data, 'SCHADE', latest) || {}) : {};
  const hasSchadeTotal = !!schadeTotalRow[cols.hoofd];
  const spInspection = inspectSpPercentages(data);
  const spOk = spInspection.ok;
  const brokerOk = !!((brokerInfo && brokerInfo.number) || (brokerInfo && brokerInfo.name));
  const yes = msg('yes'), no = msg('no');
  const periodDetail = periods.length ? '' : detailList('Geen periodes gevonden. Controleer of de PDF-tabellen correct zijn uitgelezen.', []);
  const latestDetail = latest !== '-' ? '' : detailList('Geen laatste periode bepaald omdat er geen geldige periodes gevonden zijn.', []);
  const prodDetail = hasProdTotal ? '' : detailList(`Niet gevonden: PRODUCTIE / TOTAAL NON LIFE voor periode ${latest}.`, [
    `Aantal productie-rijen: ${rowsOf(data, 'PRODUCTIE').length}`,
    `Gevonden periodes: ${periods.join(', ') || '-'}`
  ]);
  const schadeDetail = hasSchadeTotal ? '' : detailList(`Niet gevonden: SCHADE / TOTAAL NON LIFE voor periode ${latest}.`, [
    `Aantal schade-rijen: ${schadeRows.length}`,
    `Gevonden periodes: ${periods.join(', ') || '-'}`
  ]);
  const spDetail = spOk ? '' : detailList('S/P-controle niet geslaagd. Mogelijke oorzaken: ontbrekende schade-rijen, ontbrekende percentages of niet-numeriek gelezen waarden.', spInspection.issues);
  box.innerHTML = `<div class="importControlHead"><div class="importControlTitle">${esc(msg('importControlTitle'))}</div><div class="importControlSub">${esc(msg('importControlSub'))}</div></div>` +
    `<div class="importGrid">` +
    importCheckHtml(msg('importPeriods'), String(periods.length), periods.length > 0, periodDetail) +
    importCheckHtml(msg('importLatestPeriod'), latest, latest !== '-', latestDetail) +
    importCheckHtml(msg('importTotalProd'), hasProdTotal ? yes : no, hasProdTotal, prodDetail) +
    importCheckHtml(msg('importTotalSchade'), hasSchadeTotal ? yes : no, hasSchadeTotal, schadeDetail) +
    importCheckHtml(msg('importSpPct'), spOk ? yes : no, spOk, spDetail) +
    importCheckHtml(msg('importBroker'), brokerOk ? yes : no, brokerOk) +
    `</div>`;
  box.classList.remove('hidden');
}

function build(data) {
  const prodM = mainRows(data, 'PRODUCTIE'), schadeM = mainRows(data, 'SCHADE');
  if (!prodM.length) throw new Error(currentLang === 'fr' ? 'aucune catégorie principale production trouvée' : 'geen productie-hoofdcategorieën gevonden waarbij Hoofdcategorie = Subcategorie');
  const [prevP, currP] = latestMonthPair(prodM);
  const prodCatsRows = categoryRows(data, 'PRODUCTIE');
  const schadeCatsRows = categoryRows(data, 'SCHADE');
  const cats = [...new Set(prodCatsRows.filter(r => r[cols.periode] === currP).map(r => r[cols.hoofd]))];
  const schadeCats = [...new Set(schadeCatsRows.filter(r => r[cols.periode] === currP).map(r => r[cols.hoofd]))];
  const totalProdPrev = totalRow(data, 'PRODUCTIE', prevP), totalProdCurr = totalRow(data, 'PRODUCTIE', currP);
  const totalSchadePrev = totalRow(data, 'SCHADE', prevP), totalSchadeCurr = totalRow(data, 'SCHADE', currP);
  if (!totalProdCurr[cols.hoofd]) throw new Error(`geen TOTAAL NON LIFE-rij gevonden voor PRODUCTIE ${currP}`);
  if (rowsOf(data, 'SCHADE').length && !totalSchadeCurr[cols.hoofd]) throw new Error(`geen TOTAAL NON LIFE-rij gevonden voor SCHADE ${currP}`);
  $('dashboard').classList.remove('hidden');
  applyDashboardDisplayModes();
  dashboardPreviousPeriod = prevP;
  dashboardCurrentPeriod = currP;
  renderBrokerInfo();
  renderImportControl(data, currP);
  ['prodSub', 'vervalSub', 'progSub', 'detailSub'].forEach(id => $(id).textContent = msg('comparison', prevP, currP));
  $('schadeSub').textContent = msg('schadeComparison', prevP, currP);
  $('portefeuilleSub').textContent = msg('portefeuilleSub', prevP, currP);
  updateSectionPeriodInline(prevP, currP);
  lastKpiContext = {
    summary: summaryKpiItems(totalProdPrev, totalProdCurr, totalSchadePrev, totalSchadeCurr),
    prevP,
    currP
  };
  resetDashboardSectionRendering();
  renderDashboardSection(activeTabId());
  updateTopKpisForActiveTab();
  dashboardPreviousPeriod = prevP;
  dashboardCurrentPeriod = currP;
  renderActivePie(data, currP);
  formatDisplayedPeriods($(activeTabId()));
  triggerMotionRefresh();
}


function getCategoryValue(data, type, key, period, field, cellIndex) {
  if (key === 'TOTAAL NON LIFE') return totalNumber(totalRow(data, type, period), field, cellIndex);
  const aliases = portfolioCategoryAliases(key).map(normKey);
  const candidates = [...new Set(aliases.flatMap(alias => [
    ...rowsOfPeriodSub(data, type, period, alias),
    ...rowsOfPeriodHead(data, type, period, alias)
  ]))];
  const withData = candidates.slice().reverse().find(r => n(r[field]) !== 0 || (r._cells && cellIndex != null && n(r._cells[cellIndex]) !== 0));
  const row = withData || candidates[candidates.length - 1] || {};
  const byName = n(row[field]);
  if (byName !== 0) return byName;
  if (row && row._cells && cellIndex != null && row._cells[cellIndex] !== undefined) return n(row._cells[cellIndex]);
  return 0;
}
function signedPct(d) { return `${d >= 0 ? '+' : ''}${pct.format(d)}%`; }
function trendList(data, type, field, cellIndex, prevP, currP, keys, valueType = 'money') {
  return keys.map(key => {
    const oldVal = getCategoryValue(data, type, key, prevP, field, cellIndex);
    const newVal = getCategoryValue(data, type, key, currP, field, cellIndex);
    return { key, label: portfolioCategoryLabel(key), oldVal, newVal, d: valueType === 'pct' ? ppDelta(oldVal, newVal) : yoy(oldVal, newVal), absChange: newVal - oldVal, ppChange: newVal - oldVal, valueType };
  }).filter(x => x.oldVal !== 0 || x.newVal !== 0);
}
function addEarnedPremiumContext(data, items, currP) {
  const totalEarned = Math.abs(getCategoryValue(data, 'SCHADE', 'TOTAAL NON LIFE', currP, cols.verdiend, 15));
  return items.map(item => {
    const earnedPremium = Math.abs(getCategoryValue(data, 'SCHADE', item.key, currP, cols.verdiend, 15));
    const earnedShare = totalEarned ? earnedPremium / totalEarned : 0;
    return { ...item, earnedPremium, earnedShare };
  });
}
function insightValueFmt(x) {
  return x.valueType === 'pct' ? `${pct.format(x.oldVal)}% → ${pct.format(x.newVal)}%` : `${euro.format(x.oldVal)} → ${euro.format(x.newVal)}`;
}

function joinInsightParts(parts) {
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + (currentLang === 'fr' ? ' et ' : ' en ') + parts[parts.length - 1];
}
function movementMagnitude(x, opts = {}) {
  return opts.diffMode === 'pp' ? (x.ppChange ?? (x.newVal - x.oldVal)) : x.d;
}
function materialItems(items, opts = {}) {
  const withoutOther = opts.excludeOther === false ? items : items.filter(x => !isOtherCategory(x.key) && !isOtherCategory(x.label));
  if (opts.disableMaterial) return withoutOther;
  const hasEarnedPremium = items.some(x => (x.earnedPremium || 0) > 0);
  const minShare = opts.minShare ?? 0.02;
  const topEarned = new Set(items
    .filter(x => (x.earnedPremium || 0) > 0)
    .sort((a, b) => (b.earnedPremium || 0) - (a.earnedPremium || 0))
    .slice(0, opts.materialLimit ?? 6)
    .map(x => x.key));
  return withoutOther.filter(x => !hasEarnedPremium || (x.earnedShare || 0) >= minShare || topEarned.has(x.key));
}
function isOtherCategory(value) {
  const k = String(value || '').toLowerCase();
  return k.includes('overige') || k.includes('autres') || k.includes('other');
}
function movementText(x, valueType = 'money') {
  if (valueType === 'pct') {
    return `<span class="insightStrong">${esc(x.label)}</span> (${pct.format(x.oldVal)}% > ${pct.format(x.newVal)}%)`;
  }
  return `<span class="insightStrong">${esc(x.label)}</span> (${signedPct(x.d)})`;
}
function movementNames(items, valueType = 'money') {
  return joinInsightParts(items.map(x => movementText(x, valueType)));
}
function spSeverityGroups(items, mode, opts = {}) {
  const lowerBetter = opts.lowerBetter ?? true;
  const minPp = opts.minPp ?? 1;
  const relevant = materialItems(items, { ...opts, disableMaterial: true }).filter(x => {
    const movement = movementMagnitude(x, { diffMode: 'pp' });
    const isMatch = mode === 'good' ? (lowerBetter ? movement < 0 : movement > 0) : (lowerBetter ? movement > 0 : movement < 0);
    return isMatch && Math.abs(movement) >= minPp;
  }).sort((a, b) => Math.abs(movementMagnitude(b, { diffMode: 'pp' })) - Math.abs(movementMagnitude(a, { diffMode: 'pp' })));
  return {
    light: relevant.filter(x => Math.abs(movementMagnitude(x, { diffMode: 'pp' })) <= 5),
    noticeable: relevant.filter(x => {
      const abs = Math.abs(movementMagnitude(x, { diffMode: 'pp' }));
      return abs > 5 && abs <= 10;
    }),
    strong: relevant.filter(x => Math.abs(movementMagnitude(x, { diffMode: 'pp' })) > 10)
  };
}
function spSeverityText(items, mode, opts = {}) {
  const groups = spSeverityGroups(items, mode, opts);
  const parts = [];
  const add = (bucket, nlLabel, frLabel) => {
    if (!bucket.length) return;
    const label = currentLang === 'fr' ? frLabel : nlLabel;
    const direction = mode === 'good'
      ? (currentLang === 'fr' ? 'amelioration' : 'verbetering')
      : (currentLang === 'fr' ? 'deterioration' : 'verslechtering');
    parts.push(currentLang === 'fr'
      ? `${label} ${direction} chez ${movementNames(bucket, 'pct')}.`
      : `${label} ${direction} bij ${movementNames(bucket, 'pct')}.`);
  };
  add(groups.strong, 'Sterke', 'Forte');
  add(groups.noticeable, 'Merkbare', 'Marquee');
  add(groups.light, 'Lichte', 'Legere');
  return parts.join(' ');
}
function moneySeverityGroups(items, mode, opts = {}) {
  const lowerBetter = !!opts.lowerBetter;
  const minPct = opts.minPct ?? 1;
  const relevant = materialItems(items, { ...opts, disableMaterial: true }).filter(x => {
    const movement = x.d || 0;
    const isMatch = mode === 'good' ? (lowerBetter ? movement < 0 : movement > 0) : (lowerBetter ? movement > 0 : movement < 0);
    return isMatch && Math.abs(movement) >= minPct;
  }).sort((a, b) => Math.abs(b.d || 0) - Math.abs(a.d || 0));
  return {
    light: relevant.filter(x => Math.abs(x.d || 0) <= 5),
    noticeable: relevant.filter(x => {
      const abs = Math.abs(x.d || 0);
      return abs > 5 && abs <= 10;
    }),
    strong: relevant.filter(x => Math.abs(x.d || 0) > 10)
  };
}
function moneySeverityText(items, mode, opts = {}) {
  const groups = moneySeverityGroups(items, mode, opts);
  const parts = [];
  const metric = opts.metric || (opts.lowerBetter ? 'verval' : 'productie');
  const add = (bucket, nlLabel, frLabel) => {
    if (!bucket.length) return;
    const label = currentLang === 'fr' ? frLabel : nlLabel;
    if (currentLang === 'fr') {
      const direction = mode === 'good' ? 'positive' : 'moins positive';
      parts.push(`${label} evolution ${direction} pour ${movementNames(bucket, 'money')}.`);
    } else {
      const direction = mode === 'good'
        ? (opts.lowerBetter ? `${metric}daling` : `${metric}stijging`)
        : (opts.lowerBetter ? `${metric}stijging` : `${metric}daling`);
      parts.push(`${label} ${direction} bij ${movementNames(bucket, 'money')}.`);
    }
  };
  add(groups.strong, 'Sterke', 'Forte');
  add(groups.noticeable, 'Merkbare', 'Marquee');
  add(groups.light, 'Lichte', 'Legere');
  return parts.join(' ');
}
function executiveMoneyText(label, prev, curr, d, items, opts = {}) {
  const lowerBetter = !!opts.lowerBetter;
  const metric = opts.metric || (lowerBetter ? 'verval' : 'productie');
  const positive = lowerBetter ? d < 0 : d > 0;
  const neutral = Math.abs(d) < 0.05;
  const goodText = moneySeverityText(items, 'good', { lowerBetter, metric, minPct: opts.minPct ?? 1 });
  const badText = moneySeverityText(items, 'bad', { lowerBetter, metric, minPct: opts.minPct ?? 1 });
  if (currentLang === 'fr') {
    const verb = neutral ? 'reste stable' : lowerBetter ? (d < 0 ? 'diminue' : 'augmente') : (d > 0 ? 'progresse' : 'recule');
    const driver = goodText
      ? goodText
      : `Aucun mouvement clairement positif ne ressort par branche.`;
    const watch = badText
      ? badText
      : `Aucun mouvement moins positif marque ne ressort par branche.`;
    return `${label} ${verb} a <span class="insightStrong">${euro.format(curr)}</span> (<span class="${cls(d, lowerBetter)}">${signedPct(d)}</span> vs ${euro.format(prev)} en ${opts.prevP || 'periode precedente'}). ${driver} ${watch}`;
  }
  const verb = neutral ? 'blijft stabiel' : lowerBetter ? (d < 0 ? 'daalt' : 'stijgt') : (d > 0 ? 'groeit' : 'daalt');
  const driver = goodText
    ? goodText
    : `Er zijn geen duidelijke positieve bewegingen per tak.`;
  const watch = badText
    ? badText
    : `Er is geen uitgesproken minder positieve beweging per tak.`;
  return `${label} ${verb} naar <span class="insightStrong">${euro.format(curr)}</span> (<span class="${cls(d, lowerBetter)}">${signedPct(d)}</span> vs ${euro.format(prev)} in ${opts.prevP || 'vorige periode'}). ${driver} ${watch}`;
}
function executivePctText(label, prev, curr, d, items, opts = {}) {
  const lowerBetter = opts.lowerBetter ?? true;
  const positive = lowerBetter ? d < 0 : d > 0;
  const neutral = Math.abs(d) < 0.05;
  const goodText = spSeverityText(items, 'good', { lowerBetter, minPp: opts.minPp ?? 1 });
  const badText = spSeverityText(items, 'bad', { lowerBetter, minPp: opts.minPp ?? 1 });
  if (currentLang === 'fr') {
    const verb = neutral ? 'reste stable' : positive ? 's ameliore' : 'se deteriore';
    const driver = goodText
      ? goodText
      : `Aucune amelioration claire ne ressort par branche.`;
    const watch = badText
      ? badText
      : `Aucune evolution S/P moins positive marquee ne ressort par branche.`;
    return `${label.replace(' total', '')} ${verb} globalement de <span class="${cls(d, lowerBetter)}">${pct.format(prev)}% -> ${pct.format(curr)}%</span>. ${driver} ${watch}`;
  }
  const verb = neutral ? 'blijft stabiel' : positive ? 'verbetert' : 'verslechtert';
  const driver = goodText
    ? goodText
    : `Er is geen duidelijke verbetering per tak.`;
  const watch = badText
    ? badText
    : `Er is geen uitgesproken minder positieve S/P-evolutie per tak.`;
  return `${label.replace(' totaal', '')} ${verb} globaal van <span class="${cls(d, lowerBetter)}">${pct.format(prev)}% -> ${pct.format(curr)}%</span>. ${driver} ${watch}`;
}
function categoryIcon(key) {
  const k = String(key || '');
  let iconKey = '';
  if (k.startsWith('Auto')) iconKey = 'auto';
  else if (k.startsWith('Particulieren') || k.startsWith('Particuliers')) iconKey = 'particulieren';
  else if (k.startsWith('Ondernemingen') || k.startsWith('Entreprises')) iconKey = 'ondernemingen';
  else if (k.startsWith('Arbeidsongevallen') || k.startsWith('Accidents de travail')) iconKey = 'arbeidsongevallen';
  else if (k.startsWith('Rechtsbijstand') || k.startsWith('Protection juridique')) iconKey = 'rechtsbijstand';
  return iconKey && CATEGORY_ICONS[iconKey] ? `<img class="catMiniIconImg" src="${CATEGORY_ICONS[iconKey]}" alt="" />` : '';
}
function trendBoxesHtml(items, opts = {}) {
  const threshold = opts.threshold ?? 5;
  const lowerBetter = !!opts.lowerBetter;
  const riseTitle = opts.riseTitle || (currentLang === 'fr' ? 'Hausses' : 'Stijgingen');
  const fallTitle = opts.fallTitle || (currentLang === 'fr' ? 'Baisses' : 'Dalingen');
  const hideDelta = !!opts.hideDelta;
  const noText = opts.noText || (currentLang === 'fr' ? 'Pas de mouvements marqués par branche.' : 'Geen uitgesproken bewegingen per tak.');
  const relevantItems = materialItems(items, opts);
  const ups = relevantItems.filter(x => movementMagnitude(x, opts) >= threshold).sort((a,b) => movementMagnitude(b, opts) - movementMagnitude(a, opts));
  const downs = relevantItems.filter(x => movementMagnitude(x, opts) <= -threshold).sort((a,b) => movementMagnitude(a, opts) - movementMagnitude(b, opts));
  const fmtItem = x => x.valueType === 'pct'
    ? `<li><span class="trendCatName"><span class="catMiniIcon">${categoryIcon(x.key)}</span>${esc(x.label)}</span>: <span class="${cls(movementMagnitude(x, opts), lowerBetter)}">${pct.format(x.oldVal)}% &gt; ${pct.format(x.newVal)}%</span></li>`
    : (hideDelta
      ? `<li><span class="trendCatName"><span class="catMiniIcon">${categoryIcon(x.key)}</span>${esc(x.label)}</span>: <span class="${cls(x.d, lowerBetter)}">${insightValueFmt(x)}</span> (${signedPct(x.d)})</li>`
      : `<li><span class="trendCatName"><span class="catMiniIcon">${categoryIcon(x.key)}</span>${esc(x.label)}</span>: <span class="${cls(x.d, lowerBetter)}">${signedPct(x.d)}</span> (${insightValueFmt(x)})</li>`);

  if (!ups.length && !downs.length) {
    return `<div class="insightTrendBoxes"><div class="insightTrendBox neutral"><h4>• ${currentLang === 'fr' ? 'Stable' : 'Stabiel'}</h4><ul><li>${noText}</li></ul></div></div>`;
  }

  const riseIcon = opts.riseIcon || '↗';
  const fallIcon = opts.fallIcon || '↘';

  // Bepaal volgorde: dalingen eerst of stijgingen eerst
  const firstGroup  = opts.downsFirst ? downs : ups;
  const secondGroup = opts.downsFirst ? ups   : downs;
  const firstTitle  = opts.downsFirst ? fallTitle  : riseTitle;
  const secondTitle = opts.downsFirst ? riseTitle  : fallTitle;
  const firstIcon   = opts.downsFirst ? fallIcon   : riseIcon;
  const secondIcon  = opts.downsFirst ? riseIcon   : fallIcon;
  const firstClass  = opts.downsFirst
    ? (opts.invertColors ? 'up'   : 'down')
    : (opts.invertColors ? 'down' : 'up');
  const secondClass = opts.downsFirst
    ? (opts.invertColors ? 'down' : 'up')
    : (opts.invertColors ? 'up'   : 'down');

  const firstHtml = firstGroup.length
    ? `<div class="trendSubTitle ${firstClass}">${firstIcon} ${firstTitle}</div><ul>${firstGroup.map(fmtItem).join('')}</ul>`
    : '';
  const secondHtml = secondGroup.length
    ? `<div class="trendSubTitle ${secondClass}">${secondIcon} ${secondTitle}</div><ul>${secondGroup.map(fmtItem).join('')}</ul>`
    : '';

  const title = currentLang === 'fr' ? 'Mouvements par branche' : 'Bewegingen per tak';
  return `<div class="insightTrendBoxes"><div class="insightTrendBox combined"><h4>${title}</h4>${firstHtml}${secondHtml}</div></div>`;
}
// ─── Productie-staafdiagram voor samenvatting ─────────────────────────────────
// Toont per categorie twee overlappende horizontale balken:
//   – vorig jaar: Vivium blauw (#003b71)
//   – dit jaar:   Vivium oranje (#f58220)
// Hover op een balk toont het exacte bedrag als tooltip.
function compactCategoryLabelParts(label) {
  const value = String(label || '').trim();
  const normalized = value.toLowerCase()
    .replace(/[\u2013\u2014\u00ad-]/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const isFr = currentLang === 'fr';

  if (normalized.includes('auto') && (normalized.includes('vloten') || normalized.includes('flottes')) && !(normalized.includes('niet') || normalized.includes('non'))) {
    return ['Auto', isFr ? '(flottes)' : '(vloten)'];
  }
  if (normalized.includes('auto') && (normalized.includes('niet') || normalized.includes('non'))) {
    return ['Auto', isFr ? '(non-flottes)' : '(niet-vloten)'];
  }
  if ((normalized.includes('particulieren') || normalized.includes('particuliers')) && (normalized.includes('brand') || normalized.includes('incendie'))) {
    return ['Particul.', isFr ? '(incendie)' : '(brand)'];
  }
  if ((normalized.includes('particulieren') || normalized.includes('particuliers')) && (normalized.includes('ba') || normalized.includes('rc'))) {
    return ['Particul.', isFr ? '(RC)' : '(BA)'];
  }
  if (normalized === 'particulieren' || normalized === 'particuliers') {
    return ['Particul.'];
  }
  if ((normalized.includes('ondernemingen') || normalized.includes('entreprises')) && (normalized.includes('brand') || normalized.includes('incendie'))) {
    return [isFr ? 'Entrep.' : 'Ondernem.', isFr ? '(incendie)' : '(brand)'];
  }
  if ((normalized.includes('ondernemingen') || normalized.includes('entreprises')) && (normalized.includes('ba') || normalized.includes('rc'))) {
    return [isFr ? 'Entrep.' : 'Ondernem.', isFr ? '(RC)' : '(BA)'];
  }
  if (normalized === 'ondernemingen' || normalized === 'entreprises') {
    return [isFr ? 'Entrep.' : 'Ondernem.'];
  }
  if (normalized.includes('arbeidsongevallen') || normalized.includes('accidents de travail')) {
    return [isFr ? 'AT' : 'AO'];
  }
  if (normalized.includes('rechtsbijstand') || (normalized.includes('rechts') && normalized.includes('bijstand')) || normalized.includes('protection juridique') || (normalized.includes('protect') && normalized.includes('jur'))) {
    return isFr ? ['Protect.', 'juridique'] : ['Rechts-', 'bijstand'];
  }
  return [value];
}
function compactProdBarLabelHtml(label) {
  return compactCategoryLabelParts(label).map(part => `<span>${esc(part)}</span>`).join('');
}
function renderPremiumBarChart(data, prevP, currP, field, lowerIsBetter = false) {
  const cats = [
    'Auto Vloten','Auto Niet Vloten',
    'Particulieren Brand','Particulieren BA',
    'Ondernemingen Brand','Ondernemingen BA',
    'Arbeidsongevallen','Rechtsbijstand'
  ];
  const normV = value => String(value || '').trim().toUpperCase();
  const getValue = (key, period) => {
    const aliases = portfolioCategoryAliases(key).map(normKey);
    const candidates = rowsOfPeriod(data, 'PRODUCTIE', period)
      .filter(row => aliases.includes(normV(row[cols.sub])) || aliases.includes(normV(row[cols.hoofd])));
    const withData = candidates.slice().reverse().find(row => n(row[field]) !== 0);
    return n((withData || candidates[candidates.length - 1] || {})[field]);
  };
  const items = cats.map(key => {
    const prev = getValue(key, prevP);
    const curr = getValue(key, currP);
    return { label: portfolioCategoryLabel(key), prev, curr, d: yoy(prev, curr) };
  }).filter(item => item.prev !== 0 || item.curr !== 0);
  if (!items.length) return '';

  const max = Math.max(1, ...items.flatMap(item => [Math.abs(item.prev), Math.abs(item.curr)]));
  const chartHeight = 120;
  const bars = [], deltas = [], labels = [];
  items.forEach(item => {
    const hPrev = Math.max(2, Math.round(Math.abs(item.prev) / max * chartHeight));
    const hCurr = Math.max(2, Math.round(Math.abs(item.curr) / max * chartHeight));
    const direction = lowerIsBetter ? -item.d : item.d;
    const deltaClass = direction > 0 ? 'pos' : direction < 0 ? 'neg' : 'neu';
    bars.push(`<div class="prodBarCol"><div class="prodBarPair">
      <div class="prodBarStick prevPeriod" style="height:${hPrev}px" data-amount="${euro.format(item.prev)}" data-period="${esc(prevP)}" onmouseenter="showProdBarTip(event,this)" onmouseleave="hideProdBarTip()"></div>
      <div class="prodBarStick currPeriod" style="height:${hCurr}px" data-amount="${euro.format(item.curr)}" data-period="${esc(currP)}" onmouseenter="showProdBarTip(event,this)" onmouseleave="hideProdBarTip()"></div>
    </div></div>`);
    deltas.push(`<div class="prodBarDeltaCol ${deltaClass}">${item.d >= 0 ? '+' : ''}${pct.format(item.d)}%</div>`);
    labels.push(`<div class="prodBarLabelCol" title="${esc(item.label)}">${compactProdBarLabelHtml(item.label)}</div>`);
  });
  const swatch = (color, opacity) => `<span class="prodBarSwatch" style="background:${color};opacity:${opacity}"></span>`;
  return `<div class="prodBarChart">
    <div class="prodBarLegend"><span>${swatch('#003b71', '.85')}${esc(prevP)}</span><span>${swatch('#f58220', '1')}${esc(currP)}</span></div>
    <div class="prodBarGrid">${bars.join('')}</div>
    <div class="prodBarDeltaRow">${deltas.join('')}</div>
    <div class="prodBarLabelRow">${labels.join('')}</div>
  </div>`;
}
function renderProdBarChart(data, prevP, currP) {
  return renderPremiumBarChart(data, prevP, currP, cols.prodPremie);
}

// ─── Verval-staafdiagram voor samenvatting ───────────────────────────────────
// Dezelfde grafiek, met omgekeerde kleurinterpretatie: lager verval is beter.
function renderVervalBarChart(data, prevP, currP) {
  return renderPremiumBarChart(data, prevP, currP, cols.vervalPremie, true);
}


// ─── S/P-staafdiagrammen voor samenvatting ───────────────────────────────────
// Zelfde categorieën en opbouw als productie/verval, maar tooltip en as tonen percentages.
// Bij S/P is een daling positief en een stijging negatief.
function renderSpBarChart(data, prevP, currP, field, cellIndex) {
  const VIVIUM_BLUE   = '#003b71';
  const VIVIUM_ORANGE = '#f58220';
  const cats = [
    'Auto Vloten','Auto Niet Vloten',
    'Particulieren Brand','Particulieren BA',
    'Ondernemingen Brand','Ondernemingen BA',
    'Arbeidsongevallen','Rechtsbijstand'
  ];

  const normV = v => String(v || '').trim().toUpperCase();
  const getVal = key => {
    const aliases = portfolioCategoryAliases(key).map(normKey);
    const get = period => {
      const src = rowsOfPeriod(data, 'SCHADE', period);
      const candidates = src.filter(r => aliases.includes(normV(r[cols.sub])) || aliases.includes(normV(r[cols.hoofd])));
      const withData = candidates.slice().reverse().find(r => totalNumber(r, field, cellIndex) !== 0);
      return totalNumber(withData || candidates[candidates.length - 1] || {}, field, cellIndex);
    };
    return { prev: get(prevP), curr: get(currP) };
  };

  const items = cats.map(key => {
    const { prev, curr } = getVal(key);
    const d = ppDelta(prev, curr);
    return { key, label: portfolioCategoryLabel(key), prev, curr, d };
  }).filter(x => x.prev !== 0 || x.curr !== 0);

  if (!items.length) return '';

  const max = Math.max(1, ...items.flatMap(x => [Math.abs(x.prev), Math.abs(x.curr)]));
  const CHART_H = 120;
  const barHtml = [];
  const deltaHtml = [];
  const labelHtml = [];

  items.forEach(x => {
    const hPrev = Math.max(2, Math.round(Math.abs(x.prev) / max * CHART_H));
    const hCurr = Math.max(2, Math.round(Math.abs(x.curr) / max * CHART_H));
    const dClass = x.d > 0 ? 'neg' : x.d < 0 ? 'pos' : 'neu';
    const dSign = x.d >= 0 ? '+' : '';

    barHtml.push(`<div class="prodBarCol">
      <div class="prodBarPair">
        <div class="prodBarStick prevPeriod"
             style="height:${hPrev}px"
             data-amount="${pct.format(x.prev)}%"
             data-period="${esc(prevP)}"
             onmouseenter="showProdBarTip(event,this)"
             onmouseleave="hideProdBarTip()"></div>
        <div class="prodBarStick currPeriod"
             style="height:${hCurr}px"
             data-amount="${pct.format(x.curr)}%"
             data-period="${esc(currP)}"
             onmouseenter="showProdBarTip(event,this)"
             onmouseleave="hideProdBarTip()"></div>
      </div>
    </div>`);

    deltaHtml.push(`<div class="prodBarDeltaCol ${dClass}">${dSign}${pct.format(x.d)}%</div>`);
    labelHtml.push(`<div class="prodBarLabelCol" title="${esc(x.label)}">${compactProdBarLabelHtml(x.label)}</div>`);
  });

  const swatch = (color, op) => `<span class="prodBarSwatch" style="background:${color};opacity:${op}"></span>`;
  const legendPrev = `${swatch(VIVIUM_BLUE, '.85')}${esc(prevP)}`;
  const legendCurr = `${swatch(VIVIUM_ORANGE, '1')}${esc(currP)}`;

  return `<div class="prodBarChart">
    <div class="prodBarLegend"><span>${legendPrev}</span><span>${legendCurr}</span></div>
    <div class="prodBarGrid">${barHtml.join('')}</div>
    <div class="prodBarDeltaRow">${deltaHtml.join('')}</div>
    <div class="prodBarLabelRow">${labelHtml.join('')}</div>
  </div>`;
}

function showProdBarTip(e, el) {
  const tip = document.getElementById('prodBarTooltip');
  if (!tip) return;
  if (tip.parentElement !== document.body) document.body.appendChild(tip);
  tip.innerHTML = `<strong>${esc(fmtPeriod(el.dataset.period || ''))}</strong><span class="muted">${esc(el.dataset.amount || '')}</span>`;
  tip.style.position = 'fixed';
  tip.style.transform = 'translate(12px,12px)';
  tip.style.display = 'block';
  tip.style.left = e.clientX + 'px';
  tip.style.top  = e.clientY + 'px';
}
function hideProdBarTip() {
  const tip = document.getElementById('prodBarTooltip');
  if (tip) tip.style.display = 'none';
}

const ICON_SUMMARY_PROD = `<svg class="insightIconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
const ICON_SUMMARY_VERVAL = `<svg class="insightIconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`;
const ICON_SUMMARY_SP = `<svg class="insightIconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
const ICON_SP_CAPPED = `<svg class="insightIconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M8.5 12h7"/></svg>`;

function renderInsightSummary(data, prevP, currP) {
  const box = $('insightSummary');
  if (!box) return;
  const keys = ['Auto Vloten','Auto Niet Vloten','Particulieren Brand','Particulieren BA','Particulieren Overige','Ondernemingen Brand','Ondernemingen BA','Ondernemingen Overige','Arbeidsongevallen','Rechtsbijstand'];
  const prodPrev = getCategoryValue(data, 'PRODUCTIE', 'TOTAAL NON LIFE', prevP, cols.prodPremie, 5);
  const prodCurr = getCategoryValue(data, 'PRODUCTIE', 'TOTAAL NON LIFE', currP, cols.prodPremie, 5);
  const prodD = yoy(prodPrev, prodCurr);
  const prodItems = addEarnedPremiumContext(data, trendList(data, 'PRODUCTIE', cols.prodPremie, 5, prevP, currP, keys, 'money'), currP);
  const spPrev = getCategoryValue(data, 'SCHADE', 'TOTAAL NON LIFE', prevP, cols.sp, 18);
  const spCurr = getCategoryValue(data, 'SCHADE', 'TOTAAL NON LIFE', currP, cols.sp, 18);
  const spD = ppDelta(spPrev, spCurr);
  const spCapPrev = getCategoryValue(data, 'SCHADE', 'TOTAAL NON LIFE', prevP, cols.spCap, 20);
  const spCapCurr = getCategoryValue(data, 'SCHADE', 'TOTAAL NON LIFE', currP, cols.spCap, 20);
  const spCapD = ppDelta(spCapPrev, spCapCurr);
  const spItems = addEarnedPremiumContext(data, trendList(data, 'SCHADE', cols.sp, 18, prevP, currP, keys, 'pct'), currP);
  const spCapItems = addEarnedPremiumContext(data, trendList(data, 'SCHADE', cols.spCap, 20, prevP, currP, keys, 'pct'), currP);
  const vervalPrev = getCategoryValue(data, 'PRODUCTIE', 'TOTAAL NON LIFE', prevP, cols.vervalPremie, 7);
  const vervalCurr = getCategoryValue(data, 'PRODUCTIE', 'TOTAAL NON LIFE', currP, cols.vervalPremie, 7);
  const vervalD = yoy(vervalPrev, vervalCurr);
  const vervalItems = addEarnedPremiumContext(data, trendList(data, 'PRODUCTIE', cols.vervalPremie, 7, prevP, currP, keys, 'money'), currP);
  const summaryBlockExportActions = exportActionsHtml({
    classes: 'summaryExportActions',
    label: 'Samenvattingblok exporteren'
  });
  // Staafdiagram: gedeeld voor beide talen
  const prodBarChart = renderProdBarChart(data, prevP, currP);
  const vervalBarChart = renderVervalBarChart(data, prevP, currP);
  const spBarChart = renderSpBarChart(data, prevP, currP, cols.sp, 18);
  const spCapBarChart = renderSpBarChart(data, prevP, currP, cols.spCap, 20);

  if (currentLang === 'fr') {
    const prodText = executiveMoneyText('La production', prodPrev, prodCurr, prodD, prodItems, {metric:'production', prevP});
    const vervalText = executiveMoneyText('La chute', vervalPrev, vervalCurr, vervalD, vervalItems, {lowerBetter:true, metric:'chute', prevP});
    const spText = executivePctText('Le S/P total', spPrev, spCurr, spD, spItems, {minPp:1, prevP});
    const spCapText = executivePctText('Le S/P ecrete total', spCapPrev, spCapCurr, spCapD, spCapItems, {minPp:1, prevP});
    box.innerHTML = `<div id="insightSummaryExport" class="insightSummaryExport"><div class="insightGrid">
      <div class="insightItem">
        ${summaryBlockExportActions}
        <div class="insightItemHeader"><div class="insightItemIcon">${ICON_SUMMARY_PROD}</div><h3>Production</h3></div>
        <p>${prodText}</p>
        ${trendBoxesHtml(prodItems, {riseTitle:'Hausses', fallTitle:'Baisses', riseIcon:'↗', fallIcon:'↘', threshold:1, disableMaterial:true})}
        ${prodBarChart}
      </div>
      <div class="insightItem">
        ${summaryBlockExportActions}
        <div class="insightItemHeader"><div class="insightItemIcon">${ICON_SUMMARY_VERVAL}</div><h3>Chute</h3></div>
        <p>${vervalText}</p>
        ${trendBoxesHtml(vervalItems, {riseTitle:'Chute en hausse', fallTitle:'Chute en baisse', riseIcon:'↗', fallIcon:'↘', downsFirst:true, invertColors:true, lowerBetter:true, threshold:1, disableMaterial:true})}
        ${vervalBarChart}
      </div>
      <div class="insightItem">
        ${summaryBlockExportActions}
        <div class="insightItemHeader"><div class="insightItemIcon">${ICON_SUMMARY_SP}</div><h3>S/P</h3></div>
        <p>${spText}</p>
        ${trendBoxesHtml(spItems, {lowerBetter:true, riseTitle:'S/P en hausse', fallTitle:'S/P en baisse', threshold:1, diffMode:'pp', hideDelta:true, downsFirst:true, invertColors:true, riseIcon:'↗', fallIcon:'↘', disableMaterial:true})}
        ${spBarChart}
      </div>
      <div class="insightItem">
        ${summaryBlockExportActions}
        <div class="insightItemHeader"><div class="insightItemIcon">${ICON_SP_CAPPED}</div><h3>S/P &eacute;cr&ecirc;t&eacute;</h3></div>
        <p>${spCapText}</p>
        ${trendBoxesHtml(spCapItems, {lowerBetter:true, riseTitle:'S/P écrêté en hausse', fallTitle:'S/P écrêté en baisse', threshold:1, diffMode:'pp', hideDelta:true, downsFirst:true, invertColors:true, riseIcon:'↗', fallIcon:'↘', disableMaterial:true})}
        ${spCapBarChart}
      </div>
    </div></div>`;
  } else {
    const prodText = executiveMoneyText('Productie', prodPrev, prodCurr, prodD, prodItems, {metric:'productie', prevP});
    const vervalText = executiveMoneyText('Verval', vervalPrev, vervalCurr, vervalD, vervalItems, {lowerBetter:true, metric:'verval', prevP});
    const spText = executivePctText('S/P totaal', spPrev, spCurr, spD, spItems, {minPp:1, prevP});
    const spCapText = executivePctText('Afgetopte S/P', spCapPrev, spCapCurr, spCapD, spCapItems, {minPp:1, prevP});
    box.innerHTML = `<div id="insightSummaryExport" class="insightSummaryExport"><div class="insightGrid">
      <div class="insightItem">
        ${summaryBlockExportActions}
        <div class="insightItemHeader"><div class="insightItemIcon">${ICON_SUMMARY_PROD}</div><h3>Productie</h3></div>
        <p>${prodText}</p>
        ${trendBoxesHtml(prodItems, {riseTitle:'Stijgingen', fallTitle:'Dalingen', riseIcon:'↗', fallIcon:'↘', threshold:1, disableMaterial:true})}
        ${prodBarChart}
      </div>
      <div class="insightItem">
        ${summaryBlockExportActions}
        <div class="insightItemHeader"><div class="insightItemIcon">${ICON_SUMMARY_VERVAL}</div><h3>Verval</h3></div>
        <p>${vervalText}</p>
        ${trendBoxesHtml(vervalItems, {riseTitle:'Verval stijgt', fallTitle:'Verval daalt', riseIcon:'↗', fallIcon:'↘', downsFirst:true, invertColors:true, lowerBetter:true, threshold:1, disableMaterial:true})}
        ${vervalBarChart}
      </div>
      <div class="insightItem">
        ${summaryBlockExportActions}
        <div class="insightItemHeader"><div class="insightItemIcon">${ICON_SUMMARY_SP}</div><h3>S/P</h3></div>
        <p>${spText}</p>
        ${trendBoxesHtml(spItems, {lowerBetter:true, riseTitle:'S/P stijgt', fallTitle:'S/P daalt', threshold:1, diffMode:'pp', hideDelta:true, downsFirst:true, invertColors:true, riseIcon:'↗', fallIcon:'↘', disableMaterial:true})}
        ${spBarChart}
      </div>
      <div class="insightItem">
        ${summaryBlockExportActions}
        <div class="insightItemHeader"><div class="insightItemIcon">${ICON_SP_CAPPED}</div><h3>Afgetopte S/P</h3></div>
        <p>${spCapText}</p>
        ${trendBoxesHtml(spCapItems, {lowerBetter:true, riseTitle:'S/P afgetopt stijgt', fallTitle:'S/P afgetopt daalt', threshold:1, diffMode:'pp', hideDelta:true, downsFirst:true, invertColors:true, riseIcon:'↗', fallIcon:'↘', disableMaterial:true})}
        ${spCapBarChart}
      </div>
    </div></div>`;
  }
  box.classList.remove('hidden');
  requestAnimationFrame(() => requestAnimationFrame(equalizeSummaryRows));
}

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


function summaryKpiItems(totalProdPrev, totalProdCurr, totalSchadePrev, totalSchadeCurr) {
  return [
    { l: msg('productie'), v: n(totalProdCurr[cols.prodPremie]), o: n(totalProdPrev[cols.prodPremie]), type: 'money' },
    { l: msg('verval'), v: n(totalProdCurr[cols.vervalPremie]), o: n(totalProdPrev[cols.vervalPremie]), type: 'money', invert: true },
    { l: msg('progressie'), v: n(totalProdCurr[cols.progPremie]), o: n(totalProdPrev[cols.progPremie]), type: 'money', zeroCompare: true },
    { l: 'S/P', v: totalNumber(totalSchadeCurr, cols.sp, 18), o: totalNumber(totalSchadePrev, cols.sp, 18), type: 'pct', invert: true },
    { l: msg('spAfgetopt'), v: totalNumber(totalSchadeCurr, cols.spCap, 20), o: totalNumber(totalSchadePrev, cols.spCap, 20), type: 'pct', invert: true }
  ];
}

function activeTabId() {
  return document.querySelector('.tab.active')?.dataset?.tab || 'samenvatting';
}

function resetDashboardSectionRendering() {
  dashboardRenderedSections.clear();
  dashboardDirtySections.clear();
}

function markDashboardSectionsDirty(...sectionIds) {
  sectionIds.flat().filter(Boolean).forEach(id => dashboardDirtySections.add(id));
}

function renderDashboardSection(sectionId, force = false) {
  if (!lastData || !dashboardPreviousPeriod || !dashboardCurrentPeriod) return;
  if (!force && dashboardRenderedSections.has(sectionId) && !dashboardDirtySections.has(sectionId)) return;
  const prevP = dashboardPreviousPeriod;
  const currP = dashboardCurrentPeriod;
  switch (sectionId) {
    case 'samenvatting':
      renderInsightSummary(lastData, prevP, currP);
      break;
    case 'productie':
      renderProductieGrouped(lastData, prevP, currP);
      break;
    case 'verval':
      renderVervalGrouped(lastData, prevP, currP);
      break;
    case 'progressie':
      renderProgressieGrouped(lastData, prevP, currP);
      break;
    case 'schade':
      renderSchadeGrouped(lastData, prevP, currP);
      break;
    case 'portefeuille':
      renderPortefeuille(lastData, prevP, currP);
      break;
    case 'detail': {
      const prodCats = groupedCats(lastData, 'PRODUCTIE', currP);
      const schadeCats = groupedCats(lastData, 'SCHADE', currP);
      renderDetails(lastData, prodCats, schadeCats, prevP, currP);
      break;
    }
    case 'kpiOverzicht':
      renderKpiOverview();
      break;
    case 'view360':
      render360View();
      break;
    default:
      return;
  }
  if (pendingCategoryExpansion.has(sectionId)) {
    restoreCategoryExpansionState($(sectionId), pendingCategoryExpansion.get(sectionId));
    pendingCategoryExpansion.delete(sectionId);
  }
  dashboardRenderedSections.add(sectionId);
  dashboardDirtySections.delete(sectionId);
  applyDashboardDisplayModes();
}

function findMainCategoryRow(data, type, cat, period) {
  const rows = getDataIndex(data).mainRowsByTypePeriodHead.get(dataIndexKey(type, period, cat)) || [];
  return rows[rows.length - 1] || {};
}

function mainCategoryNamesForPeriod(data, type, period) {
  const names = [];
  const periodMainRows = getDataIndex(data).mainRowsByTypePeriod.get(dataIndexKey(type, period)) || [];
  periodMainRows.forEach(r => {
    const name = String(r[cols.hoofd] || '').trim();
    if (!name || isTotalNonLife(r)) return;
    if (!names.some(x => normKey(x) === normKey(name))) names.push(name);
  });
  const preferred = ['AUTO', 'PARTICULIEREN', 'ONDERNEMINGEN', 'ARBEIDSONGEVALLEN', 'RECHTSBIJSTAND STAND ALONE', 'RECHTSBIJSTAND'];
  names.sort((a, b) => {
    const ia = preferred.findIndex(x => normKey(a).includes(normKey(x)) || normKey(x).includes(normKey(a)));
    const ib = preferred.findIndex(x => normKey(b).includes(normKey(x)) || normKey(x).includes(normKey(b)));
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return names.slice(0, 5);
}

function kpiCategoryLabel(cat) {
  const key = normKey(cat);
  if (key.includes('ARBEIDSONGEVALLEN') || key.includes('ACCIDENTS DE TRAVAIL')) return 'A.O.';
  return cat;
}

function categoryKpiItems(data, tab, prevP, currP) {
  const fieldByTab = {
    productie: { sourceType: 'PRODUCTIE', field: cols.prodPremie, type: 'money', invert: false, compareAmountMode: 'previous', metricLabel: msg('productie') },
    verval: { sourceType: 'PRODUCTIE', field: cols.vervalPremie, type: 'money', invert: true, compareAmountMode: 'previous', metricLabel: msg('verval') },
    progressie: { sourceType: 'PRODUCTIE', field: cols.progPremie, type: 'money', invert: false, compareAmountMode: 'previous', metricLabel: msg('progressie') },
    portefeuille: { sourceType: 'SCHADE', field: cols.verdiend, type: 'money', invert: false, compareAmountMode: 'previous', metricLabel: currentLang === 'fr' ? 'PRIME.ACQ' : 'VERD.PREMIE' }
  };

  if (tab === 'schade') {
    const cats = [
      'TOTAAL NON LIFE',
      ...mainCategoryNamesForPeriod(data, 'SCHADE', currP)
        .filter(cat => !normKey(cat).includes('RECHTSBIJSTAND'))
        .slice(0, 4)
    ];
    return cats.map(cat => {
      const isTotal = normKey(cat) === 'TOTAAL NON LIFE';
      const curr = isTotal ? totalRow(data, 'SCHADE', currP) : findMainCategoryRow(data, 'SCHADE', cat, currP);
      const prev = isTotal ? totalRow(data, 'SCHADE', prevP) : findMainCategoryRow(data, 'SCHADE', cat, prevP);
      return {
        l: kpiCategoryLabel(cat),
        jumpCat: cat,
        metricLabel: 'S/P',
        v: totalNumber(curr, cols.sp, 18),
        o: totalNumber(prev, cols.sp, 18),
        v2: totalNumber(curr, cols.spCap, 20),
        o2: totalNumber(prev, cols.spCap, 20),
        type: 'sp-category',
        invert: true,
        dynamicCategory: true,
        showPeriodInLabel: false,
        compareAmountMode: 'previous'
      };
    });
  }

  if (tab === 'detail') {
    const cats = mainCategoryNamesForPeriod(data, 'PRODUCTIE', currP);
    return cats.map(cat => {
      const prodPrev = findMainCategoryRow(data, 'PRODUCTIE', cat, prevP);
      const prodCurr = findMainCategoryRow(data, 'PRODUCTIE', cat, currP);
      const schadePrev = findMainCategoryRow(data, 'SCHADE', cat, prevP);
      const schadeCurr = findMainCategoryRow(data, 'SCHADE', cat, currP);
      return {
        l: kpiCategoryLabel(cat),
        jumpCat: cat,
        metricLabel: msg('productie'),
        v: n(prodCurr[cols.prodPremie]),
        o: n(prodPrev[cols.prodPremie]),
        spPrev: totalNumber(schadePrev, cols.sp, 18),
        sp: totalNumber(schadeCurr, cols.sp, 18),
        spCapPrev: totalNumber(schadePrev, cols.spCap, 20),
        spCap: totalNumber(schadeCurr, cols.spCap, 20),
        type: 'detail-combo',
        dynamicCategory: true,
        showPeriodInLabel: false
      };
    });
  }

  const cfg = fieldByTab[tab];
  if (!cfg) return null;
  return mainCategoryNamesForPeriod(data, cfg.sourceType, currP).map(cat => {
    const curr = findMainCategoryRow(data, cfg.sourceType, cat, currP);
    const prev = findMainCategoryRow(data, cfg.sourceType, cat, prevP);
    return { l: kpiCategoryLabel(cat), jumpCat: cat, metricLabel: cfg.metricLabel, v: n(curr[cfg.field]), o: n(prev[cfg.field]), type: cfg.type, invert: cfg.invert, dynamicCategory: true, showPeriodInLabel: false, compareAmountMode: cfg.compareAmountMode };
  });
}
function kpiOverviewTabConfigs() {
  return [
    { id: 'samenvatting', label: msg('tabSamenvatting') },
    { id: 'productie', label: msg('tabProductie') },
    { id: 'verval', label: msg('tabVerval') },
    { id: 'progressie', label: msg('tabProgressie') },
    { id: 'schade', label: msg('tabSchade') },
    { id: 'portefeuille', label: msg('tabPortefeuille') }
  ];
}
function updateKpiSelectorLabel() {
  const checks = Array.from(document.querySelectorAll('.kpiOverviewCheck'));
  if (!checks.length) return;
  checks.forEach(input => {
    const key = input.dataset.kpiSection;
    input.checked = kpiOverviewVisibility[key] !== false;
  });
  const activeCount = checks.filter(input => input.checked).length;
  const main = $('kpiSelectorMain');
  if (main) main.textContent = activeCount === checks.length ? msg('kpiSelectorAll') : msg('kpiSelectorCount', activeCount);
}
function renderKpiOverview() {
  const target = $('kpiOverviewGroups');
  if (!target) return;
  if (!lastKpiContext || !lastData || !dashboardPreviousPeriod || !dashboardCurrentPeriod) {
    target.innerHTML = '';
    return;
  }
  const prevP = dashboardPreviousPeriod;
  const currP = dashboardCurrentPeriod;
  const configs = kpiOverviewTabConfigs().filter(cfg => kpiOverviewVisibility[cfg.id] !== false);
  target.classList.toggle('previousYearsVisible', previousYearsMode);
  if (!configs.length) {
    target.innerHTML = `<div class="kpiOverviewEmpty">${esc(msg('kpiOverviewEmpty'))}</div>`;
    updateKpiSelectorLabel();
    return;
  }
  target.innerHTML = configs.map(cfg => {
    const items = cfg.id === 'samenvatting' ? lastKpiContext.summary : (categoryKpiItems(lastData, cfg.id, prevP, currP) || lastKpiContext.summary);
    const visibleItems = items && items.length ? items : lastKpiContext.summary;
    const html = previousYearsMode
      ? kpiOverviewCardsWithHistoryHtml(lastData, visibleItems, prevP, currP, (item, index) => kpiOverviewHistoryConfig(cfg.id, item, index))
      : kpiCardsHtml(visibleItems, prevP, currP, { interactive: false, allowSpToggle: false });
    const actions = exportActionsHtml({
      label: currentLang === 'fr' ? `Exporter les KPI ${cfg.label}` : `KPI's ${cfg.label} exporteren`,
      downloadTitle: currentLang === 'fr' ? `Télécharger les KPI ${cfg.label} en PNG` : `Download KPI's ${cfg.label} als PNG`
    });
    return `<div class="kpiOverviewBlock">${actions}<div class="kpiOverviewHead"><h3>${esc(cfg.label)}</h3><span class="small">${esc(fmtPeriod(prevP))} vs ${esc(fmtPeriod(currP))}</span></div><div class="kpis kpiOverviewGrid">${html}</div></div>`;
  }).join('');
  updateKpiSelectorLabel();
}

function kpiOverviewHistoryConfig(sectionId, item, index) {
  if (sectionId === 'samenvatting') {
    const configs = [
      { sourceType: 'PRODUCTIE', field: cols.prodPremie, cellIndex: 5, type: 'money', key: 'TOTAAL NON LIFE' },
      { sourceType: 'PRODUCTIE', field: cols.vervalPremie, cellIndex: 7, type: 'money', key: 'TOTAAL NON LIFE', invert: true },
      { sourceType: 'PRODUCTIE', field: cols.progPremie, cellIndex: 9, type: 'money', key: 'TOTAAL NON LIFE' },
      { sourceType: 'SCHADE', field: cols.sp, cellIndex: 18, type: 'pct', key: 'TOTAAL NON LIFE', invert: true },
      { sourceType: 'SCHADE', field: cols.spCap, cellIndex: 20, type: 'pct', key: 'TOTAAL NON LIFE', invert: true }
    ];
    return configs[index] || configs[0];
  }
  if (sectionId === 'productie') return { sourceType: 'PRODUCTIE', field: cols.prodPremie, cellIndex: 5, type: 'money' };
  if (sectionId === 'verval') return { sourceType: 'PRODUCTIE', field: cols.vervalPremie, cellIndex: 7, type: 'money', invert: true };
  if (sectionId === 'progressie') return { sourceType: 'PRODUCTIE', field: cols.progPremie, cellIndex: 9, type: 'money' };
  if (sectionId === 'portefeuille') return { sourceType: 'SCHADE', field: cols.verdiend, cellIndex: 15, type: 'money' };
  if (sectionId === 'schade') {
    return showCappedSpKpis
      ? { sourceType: 'SCHADE', field: cols.spCap, cellIndex: 20, type: 'pct', invert: true }
      : { sourceType: 'SCHADE', field: cols.sp, cellIndex: 18, type: 'pct', invert: true };
  }
  return null;
}

function kpiOverviewCardsWithHistoryHtml(data, items, prevP, currP, cfgForItem) {
  return (items || []).map((item, index) => {
    const cfg = typeof cfgForItem === 'function' ? cfgForItem(item, index) : cfgForItem;
    if (!cfg) return kpiCardsHtml([item], prevP, currP, { interactive: false, allowSpToggle: false });
    const periods = getFullYearPeriods(data, cfg.sourceType, currP, 3);
    const key = cfg.key || item.jumpCat || item.l;
    const history = periods.map(period => ({
      period,
      value: getCategoryValue(data, cfg.sourceType, key, period, cfg.field, cfg.cellIndex)
    }));
    return kpiCardsHtml([{ ...item, kpiHistory: history }], prevP, currP, { interactive: false, allowSpToggle: false });
  }).join('');
}
function getFullYearPeriods(data, sourceType = 'PRODUCTIE', currentPeriod = '', count = 3) {
  const currentKey = pkey(currentPeriod);
  return [...new Set(rowsOf(data, sourceType)
    .map(r => String(r[cols.periode] || '').trim())
    .filter(p => p.startsWith('12 '))
    .filter(p => !currentKey || pkey(p) < currentKey))]
    .sort((a, b) => pkey(a) - pkey(b))
    .slice(-count);
}
function fullYearLabel(period) {
  const match = String(period || '').match(/\b(20\d{2})\b/);
  return match ? match[1] : fmtPeriod(period);
}
function view360HistoryHtml(data, item, periods, cfg) {
  if (!periods?.length) return '';
  const key = cfg.key || item.jumpCat || item.l;
  const values = periods.map(period => ({
    period,
    value: getCategoryValue(data, cfg.sourceType, key, period, cfg.field, cfg.cellIndex)
  }));
  if (!values.length) return '';
  const title = currentLang === 'fr' ? 'Annees completes' : 'Volledige jaren';
  const rows = values.map((x, i) => {
    const previous = i > 0 ? values[i - 1].value : null;
    const delta = previous ? (cfg.type === 'pct' ? ppDelta(previous, x.value) : yoy(previous, x.value)) : null;
    const deltaText = cfg.type === 'pct' ? `${delta >= 0 ? '+' : ''}${pct.format(delta)} ptn` : `${delta >= 0 ? '+' : ''}${pct.format(delta)}%`;
    const deltaHtml = delta === null ? `<span></span>` : `<span class="view360HistoryDelta ${cls(delta, !!cfg.invert)}">${deltaText}</span>`;
    return `<div class="view360HistoryRow"><span class="view360HistoryYear">${esc(fullYearLabel(x.period))}</span><span class="view360HistoryAmount">${fmt(x.value, cfg.type || 'money')}</span>${deltaHtml}</div>`;
  }).join('');
  return `<div class="view360History"><div class="view360HistoryTitle">${esc(title)}</div>${rows}</div>`;
}
function view360KpiCardsWithHistoryHtml(data, items, prevP, currP, cfgForItem) {
  return (items || []).map((item, index) => {
    const cfg = typeof cfgForItem === 'function' ? cfgForItem(item, index) : cfgForItem;
    if (!cfg) return kpiCardsHtml([item], prevP, currP, { interactive: false, allowSpToggle: false });
    const fullYearPeriods = getFullYearPeriods(data, cfg.sourceType, currP, 3);
    const card = kpiCardsHtml([item], prevP, currP, { interactive: false, allowSpToggle: false });
    const insert = view360HistoryHtml(data, item, fullYearPeriods, cfg);
    return insert ? card.replace(/<\/div>$/, `${insert}</div>`) : card;
  }).join('');
}
function view360ProductionKpiCardsHtml(data, items, prevP, currP) {
  return view360KpiCardsWithHistoryHtml(data, items, prevP, currP, {
    sourceType: 'PRODUCTIE',
    field: cols.prodPremie,
    cellIndex: 5,
    type: 'money'
  });
}
function view360SummaryKpiCardsHtml(data, items, prevP, currP) {
  const configs = [
    { sourceType: 'PRODUCTIE', field: cols.prodPremie, cellIndex: 5, type: 'money', key: 'TOTAAL NON LIFE' },
    { sourceType: 'PRODUCTIE', field: cols.vervalPremie, cellIndex: 7, type: 'money', key: 'TOTAAL NON LIFE', invert: true },
    { sourceType: 'PRODUCTIE', field: cols.progPremie, cellIndex: 9, type: 'money', key: 'TOTAAL NON LIFE' },
    { sourceType: 'SCHADE', field: cols.sp, cellIndex: 18, type: 'pct', key: 'TOTAAL NON LIFE', invert: true },
    { sourceType: 'SCHADE', field: cols.spCap, cellIndex: 20, type: 'pct', key: 'TOTAAL NON LIFE', invert: true }
  ];
  return view360KpiCardsWithHistoryHtml(data, items, prevP, currP, (_item, index) => configs[index] || configs[0]);
}
function view360PiePanelsHtml(prefix, prevTitle, currTitle, tooltipClass = '') {
  return `<div class="portfolioPiePair">
    <div class="portfolioPiePanel">
      <h3>${esc(prevTitle)}</h3>
      <div class="productionPieGrid portfolioPieGrid">
        <div class="pieWrap"><canvas id="${prefix}PrevCanvas" width="990" height="645"></canvas><div id="${prefix}PrevTotal" class="portfolioPieTotal"></div></div>
        <div id="${prefix}PrevLegend" class="pieLegend"></div>
      </div>
    </div>
    <div class="portfolioPiePanel">
      <h3>${esc(currTitle)}</h3>
      <div class="productionPieGrid portfolioPieGrid">
        <div class="pieWrap"><canvas id="${prefix}CurrCanvas" width="990" height="645"></canvas><div id="${prefix}CurrTotal" class="portfolioPieTotal"></div></div>
        <div id="${prefix}CurrLegend" class="pieLegend"></div>
      </div>
    </div>
  </div><div id="${prefix}Tooltip" class="pieTooltip portfolioPieTooltip view360RuntimeTooltip ${tooltipClass}"></div>`;
}
function renderView360ComparisonPies(data, prevP, currP, mode, prefix) {
  const prevItems = getProductionPieItems(data, prevP, mode).map((x, i) => ({ ...x, color: pieSegmentColor(x.key, i) }));
  const currItems = getProductionPieItems(data, currP, mode).map((x, i) => ({ ...x, color: pieSegmentColor(x.key, i) }));
  const emptyKey = mode === 'schade' ? 'schadePieEmpty' : 'productionPieEmpty';
  renderStaticPieLegend($(`${prefix}PrevLegend`), prevItems, msg(emptyKey));
  renderStaticPieLegend($(`${prefix}CurrLegend`), currItems, msg(emptyKey));
  const prevCanvas = $(`${prefix}PrevCanvas`), currCanvas = $(`${prefix}CurrCanvas`);
  if (prevCanvas) prevCanvas.dataset.tooltipId = `${prefix}Tooltip`;
  if (currCanvas) currCanvas.dataset.tooltipId = `${prefix}Tooltip`;
  const centerText = mode === 'schade' ? msg('schadelast') : msg('productie');
  drawPortfolioPie(prevCanvas, prevP, prevItems, -1, centerText);
  drawPortfolioPie(currCanvas, currP, currItems, -1, centerText);
  attachPortfolioPieHover(prevCanvas);
  attachPortfolioPieHover(currCanvas);
  attachPieLegendHover($(`${prefix}PrevLegend`), prevCanvas, `${prefix}Tooltip`);
  attachPieLegendHover($(`${prefix}CurrLegend`), currCanvas, `${prefix}Tooltip`);
  const totalLabel = pieComparisonTotalLabel(mode);
  const prevTotal = prevItems.reduce((sum, x) => sum + x.value, 0);
  const currTotal = currItems.reduce((sum, x) => sum + x.value, 0);
  if ($(`${prefix}PrevTotal`)) $(`${prefix}PrevTotal`).innerHTML = `${totalLabel}: <b>${euro.format(prevTotal)}</b>`;
  if ($(`${prefix}CurrTotal`)) $(`${prefix}CurrTotal`).innerHTML = `${totalLabel}: <b>${euro.format(currTotal)}</b>`;
}
function renderView360ProductionPies(data, prevP, currP) {
  renderView360ComparisonPies(data, prevP, currP, 'productie', 'view360ProdPie');
}
function renderView360SchadePies(data, prevP, currP) {
  renderView360ComparisonPies(data, prevP, currP, 'schade', 'view360SchadePie');
}
function renderView360PortfolioPies(data, currP) {
  const yearItems = getPortfolioYearItems(data, 'TOTAAL NON LIFE', currP);
  const prevFullPeriod = yearItems[yearItems.length - 1]?.period;
  if (!prevFullPeriod || !currP) return;
  const prevItems = getPortfolioPieItems(data, prevFullPeriod);
  const currItems = getPortfolioPieItems(data, currP);
  renderPortfolioPieLegend($('view360PortPiePrevLegend'), prevItems);
  renderPortfolioPieLegend($('view360PortPieCurrLegend'), currItems);
  const prevCanvas = $('view360PortPiePrevCanvas'), currCanvas = $('view360PortPieCurrCanvas');
  if (prevCanvas) prevCanvas.dataset.tooltipId = 'view360PortPieTooltip';
  if (currCanvas) currCanvas.dataset.tooltipId = 'view360PortPieTooltip';
  drawPortfolioPie(prevCanvas, prevFullPeriod, prevItems, -1, msg('verdiendePremie'));
  drawPortfolioPie(currCanvas, currP, currItems, -1, msg('verdiendePremie'));
  attachPortfolioPieHover(prevCanvas);
  attachPortfolioPieHover(currCanvas);
  attachPieLegendHover($('view360PortPiePrevLegend'), prevCanvas, 'view360PortPieTooltip');
  attachPieLegendHover($('view360PortPieCurrLegend'), currCanvas, 'view360PortPieTooltip');
  const totalLabel = currentLang === 'fr' ? 'Total prime acquise' : 'Totale verdiende premie';
  const prevTotal = prevItems.reduce((sum, x) => sum + x.value, 0);
  const currTotal = currItems.reduce((sum, x) => sum + x.value, 0);
  if ($('view360PortPiePrevTotal')) $('view360PortPiePrevTotal').innerHTML = `${totalLabel}: <b>${euro.format(prevTotal)}</b>`;
  if ($('view360PortPieCurrTotal')) $('view360PortPieCurrTotal').innerHTML = `${totalLabel}: <b>${euro.format(currTotal)}</b>`;
}
function schadeKpiMetricItems(items, capped = false) {
  return (items || []).map(x => ({
    ...x,
    metricLabel: capped ? msg('spAfgetopt') : 'S/P',
    v: capped ? x.v2 : x.v,
    o: capped ? x.o2 : x.o,
    type: 'pct',
    invert: true,
    showPeriodInLabel: false,
    dynamicCategory: true
  }));
}
function view360AnalysisConfigs() {
  return [
    {
      id: 'auto',
      title: 'Analyse Auto',
      cats: ['Auto'],
      textLabel: 'Auto',
      catsText: '',
      subtitle: currentLang === 'fr'
        ? 'Auto, avec comparaison des années complètes et de la période courante.'
        : 'Auto, met vergelijking van volledige jaren en huidige periode.'
    },
    {
      id: 'particulieren',
      title: currentLang === 'fr' ? 'Analyse Particuliers' : 'Analyse Particulieren',
      cats: ['Particulieren'],
      textLabel: currentLang === 'fr' ? 'Particuliers' : 'Particulieren',
      catsText: '',
      subtitle: currentLang === 'fr'
        ? 'Particuliers, avec comparaison des années complètes et de la période courante.'
        : 'Particulieren, met vergelijking van volledige jaren en huidige periode.'
    },
    {
      id: 'kmo',
      title: 'Analyse KMO',
      cats: ['Ondernemingen', 'Arbeidsongevallen'],
      textLabel: currentLang === 'fr' ? 'PME' : 'KMO',
      catsText: currentLang === 'fr' ? 'entreprises + accidents de travail' : 'ondernemingen + arbeidsongevallen',
      subtitle: currentLang === 'fr'
        ? 'Entreprises + accidents de travail, avec comparaison des années complètes et de la période courante.'
        : 'Ondernemingen + Arbeidsongevallen, met vergelijking van volledige jaren en huidige periode.'
    }
  ];
}
function view360KmoMetrics() {
  return [
    { key: 'productie', title: msg('productiepremie'), textMetric: currentLang === 'fr' ? 'production' : 'productie', sourceType: 'PRODUCTIE', field: cols.prodPremie, cellIndex: 5, type: 'money', invert: false },
    { key: 'verval', title: msg('vervalpremie'), textMetric: currentLang === 'fr' ? 'chute' : 'verval', sourceType: 'PRODUCTIE', field: cols.vervalPremie, cellIndex: 7, type: 'money', invert: true },
    { key: 'progressie', title: msg('progressiepremie'), textMetric: currentLang === 'fr' ? 'progression' : 'progressie', sourceType: 'PRODUCTIE', field: cols.progPremie, cellIndex: 9, type: 'money', invert: false },
    { key: 'sp', title: 'S/P', textMetric: 'S/P', sourceType: 'SCHADE', field: cols.sp, cellIndex: 18, type: 'pct', invert: true }
  ];
}
function view360SpCapMetric() {
  return { key: 'spCap', title: msg('spAfgetopt'), textMetric: msg('spAfgetopt'), sourceType: 'SCHADE', field: cols.spCap, cellIndex: 20, type: 'pct', invert: true };
}
function view360KmoRows(data, mode, currP, config) {
  const baseCats = config.cats || [];
  const out = [];
  baseCats.forEach(cat => {
    const rows = rowsOfHead(data, 'PRODUCTIE', cat);
    const ordered = orderedSubs(rows, cat);
    const subRows = ordered.filter(sub => sub !== cat);
    const visibleRows = mode === 'main'
      ? [cat]
      : mode === 'sub'
        ? (subRows.length ? subRows : [cat])
        : ordered;
    visibleRows.forEach(sub => {
      const isMain = sub === cat;
      out.push({
        head: cat,
        sub,
        labelHtml: escLabel(sub),
        isMain
      });
    });
  });
  return out;
}
function view360KmoValue(data, row, period, metric) {
  const sourceType = metric.sourceType || 'PRODUCTIE';
  const exactRows = rowsOfPeriodHeadSub(data, sourceType, period, row.head, row.sub);
  const exact = exactRows[exactRows.length - 1];
  const fallback = row.sub === row.head ? findMainCategoryRow(data, sourceType, row.head, period) : {};
  return totalNumber(exact || fallback || {}, metric.field, metric.cellIndex);
}
function view360MetricFormat(value, metric) {
  return metric.type === 'pct' ? `${pct.format(value)}%` : euro.format(value);
}
function view360MetricDelta(oldValue, newValue, metric) {
  return metric.type === 'pct' ? ppDelta(oldValue, newValue) : yoy(oldValue, newValue);
}
function view360DeltaText(delta, metric) {
  return metric.type === 'pct' ? `${delta >= 0 ? '+' : ''}${pct.format(delta)} ptn` : signedPct(delta);
}
function view360EvolutionNoun(delta, metric) {
  const isBetter = metric?.invert ? delta < 0 : delta > 0;
  if (Math.abs(delta) < 0.05) return currentLang === 'fr' ? 'une stabilité' : 'een stabiele evolutie';
  if (currentLang === 'fr') return isBetter ? 'une amélioration' : 'une détérioration';
  if (metric?.type === 'pct') return isBetter ? 'een verbetering' : 'een verslechtering';
  return delta > 0 ? 'een stijging' : 'een daling';
}
function view360Movement(delta) {
  if (Math.abs(delta) < 0.05) return currentLang === 'fr' ? 'stable' : 'stabiel';
  if (currentLang === 'fr') return delta > 0 ? 'hausse' : 'baisse';
  return delta > 0 ? 'stijging' : 'daling';
}
function view360MovementAdj(delta) {
  const movement = view360Movement(delta);
  if (currentLang === 'fr') return movement;
  if (movement === 'stijging') return 'stijgende';
  if (movement === 'daling') return 'dalende';
  return 'stabiele';
}
function view360LowerFirstSmart(text) {
  const s = String(text || '');
  if (/^[A-ZÀ-Ý./&-]{2,}$/.test(s.trim())) return s;
  return s ? s.charAt(0).toLowerCase() + s.slice(1).replace(/\bbA\b/g, 'BA').replace(/\bs\/p\b/gi, 'S/P') : s;
}
function view360MetricTitle(metric) {
  const title = String(metric?.title || '');
  return title.replace(/\bs\/p\b/gi, 'S/P');
}
function view360PctHtml(delta, metric) {
  return `<span class="view360AnalysisPct ${cls(delta, metric?.invert)}">${view360DeltaText(delta, metric)}</span>`;
}
function view360KmoAnalysisText(data, metric, prevP, currP, fullYears, row, config) {
  const years = fullYears.map(period => ({ period, value: view360KmoValue(data, row, period, metric) }));
  const oldest = years[0];
  const newest = years[years.length - 1];
  const prev = view360KmoValue(data, row, prevP, metric);
  const curr = view360KmoValue(data, row, currP, metric);
  const yearDelta = oldest && newest ? view360MetricDelta(oldest.value, newest.value, metric) : 0;
  const periodDelta = view360MetricDelta(prev, curr, metric);
  const verb = d => {
    if (Math.abs(d) < 0.05) return currentLang === 'fr' ? 'reste stable' : 'blijft stabiel';
    if (currentLang === 'fr') return d > 0 ? 'augmente' : 'diminue';
    return d > 0 ? 'stijgt' : 'daalt';
  };
  const rowLabel = displayLabel(row.sub || row.head);
  const rowText = view360LowerFirstSmart(rowLabel);
  const textMetric = metric.textMetric || (metric.title || '').toLowerCase();
  const periodMovement = view360Movement(periodDelta);
  const hasPeriodTrend = Math.abs(periodDelta) >= 0.05;
  if (currentLang === 'fr') {
    const yearPart = oldest && newest ? `${esc(metric.title)} ${esc(rowText)} ${esc(verb(yearDelta))} de ${view360MetricFormat(oldest.value, metric)} en ${esc(fullYearLabel(oldest.period))} à ${view360MetricFormat(newest.value, metric)} en ${esc(fullYearLabel(newest.period))}. ${esc(view360EvolutionNoun(yearDelta, metric))} de ${view360PctHtml(yearDelta, metric)} sur trois ans. ` : '';
    const currentPart = `Ultimo ${esc(fmtPeriod(currP))}, la ${esc(textMetric)} affiche ${view360MetricFormat(curr, metric)} vs ${view360MetricFormat(prev, metric)} en ${esc(fmtPeriod(prevP))} (${view360PctHtml(periodDelta, metric)}).`;
    const periodTrend = hasPeriodTrend ? ` Une tendance à la ${esc(periodMovement)} par rapport à la même période de l'année précédente.` : '';
    const contrast = `${periodTrend}`;
    return `${yearPart}${currentPart}${contrast}`;
  }
  const metricText = view360MetricTitle(metric);
  const evolutionNoun = view360EvolutionNoun(yearDelta, metric);
  const yearPart = oldest && newest ? `${esc(metricText)} ${esc(rowText)} ${esc(verb(yearDelta))} van ${view360MetricFormat(oldest.value, metric)} in ${esc(fullYearLabel(oldest.period))} naar ${view360MetricFormat(newest.value, metric)} in ${esc(fullYearLabel(newest.period))}. ${esc(evolutionNoun.charAt(0).toUpperCase() + evolutionNoun.slice(1))} met ${view360PctHtml(yearDelta, metric)} over drie jaar. ` : '';
  const currentPart = `Ultimo ${esc(fmtPeriod(currP))} staat ${esc(textMetric)} op ${view360MetricFormat(curr, metric)} vs ${view360MetricFormat(prev, metric)} in ${esc(fmtPeriod(prevP))} (${view360PctHtml(periodDelta, metric)}).`;
  const periodTrend = hasPeriodTrend ? ` Een ${esc(view360MovementAdj(periodDelta))} trend tegenover zelfde periode vorig jaar.` : '';
  const contrast = `${periodTrend}`;
  return `${yearPart}${currentPart}${contrast}`;
}
function view360KmoSparklineHtml(values, metric) {
  if (!values || !values.length) return `<div class="view360AnalysisSpark"></div>`;
  const width = 300, height = 112;
  const padX = 32, top = 20, bottom = 42;
  const bottomBaseline = height - 8;
  const nums = values.map(x => Number(x.value) || 0);
  const min = Math.min(...nums, 0);
  const max = Math.max(...nums, 0);
  const range = Math.max(1, max - min);
  const step = values.length > 1 ? (width - padX * 2) / (values.length - 1) : 0;
  const y = value => top + (max - value) / range * (height - top - bottom);
  const points = values.map((x, i) => ({
    x: padX + i * step,
    y: y(Number(x.value) || 0),
    value: Number(x.value) || 0,
    period: x.period
  }));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaBaseY = height - bottom + 8;
  const areaD = points.length
    ? `${d} L${points[points.length - 1].x.toFixed(1)} ${areaBaseY.toFixed(1)} L${points[0].x.toFixed(1)} ${areaBaseY.toFixed(1)} Z`
    : '';
  const labels = points.map(p => {
    const valueY = Math.max(11, p.y - 10);
    return `<text class="view360SparkValue" x="${p.x.toFixed(1)}" y="${valueY.toFixed(1)}" text-anchor="middle">${view360MetricFormat(p.value, metric)}</text>
      <circle class="view360SparkDot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.8"/>
      <text class="view360SparkYear" x="${p.x.toFixed(1)}" y="${bottomBaseline.toFixed(1)}" text-anchor="middle">${esc(fullYearLabel(p.period))}</text>`;
  }).join('');
  const deltaPills = points.slice(0, -1).map((p, i) => {
    const nextPoint = points[i + 1];
    const delta = view360MetricDelta(p.value || 0, nextPoint?.value || 0, metric);
    const text = view360DeltaText(delta, metric);
    const pillWidth = metric.type === 'pct' ? 74 : 62;
    const pillHeight = 19;
    const x = ((p.x + nextPoint.x) / 2) - pillWidth / 2;
    const y = bottomBaseline - 13.2;
    return `<g class="view360SparkDeltaPill ${cls(delta, metric.invert)}"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${pillWidth}" height="${pillHeight}" rx="9.5"/><text x="${(x + pillWidth / 2).toFixed(1)}" y="${(y + 13.2).toFixed(1)}" text-anchor="middle">${esc(text)}</text></g>`;
  }).join('');
  return `<div class="view360AnalysisSpark"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(metric.title)} trend"><path class="view360SparkArea" d="${areaD}"/><path class="view360SparkLine" d="${d}"/>${labels}${deltaPills}</svg></div>`;
}
function view360KmoMetricLabel(metric) {
  if (metric.key === 'productie') return currentLang === 'fr' ? 'PRODUCTION' : 'PRODUCTIE';
  if (metric.key === 'verval') return currentLang === 'fr' ? 'CHUTE' : 'VERVAL';
  if (metric.key === 'progressie') return currentLang === 'fr' ? 'PROGRESSION' : 'PROGRESSIE';
  if (metric.key === 'sp') return 'S/P';
  return String(metric.title || '').toUpperCase();
}
function view360KmoMetricHtml(data, metric, prevP, currP, fullYears, row, config) {
  const yearValues = fullYears.map(period => ({ period, value: view360KmoValue(data, row, period, metric) }));
  const prev = view360KmoValue(data, row, prevP, metric);
  const curr = view360KmoValue(data, row, currP, metric);
  const periodDelta = view360MetricDelta(prev, curr, metric);
  const compareItem = {
    l: view360KmoMetricLabel(metric),
    v: curr,
    o: prev,
    type: metric.type,
    invert: metric.invert,
    zeroCompare: metric.key === 'progressie'
  };
  const label = `<span>${esc(view360KmoMetricLabel(metric))}</span><span class="kpi-period">ULT. ${esc(fmtPeriod(currP))}</span>`;
  const deltaLine = metric.type === 'pct'
    ? `${periodDelta >= 0 ? '+' : ''}${pct.format(periodDelta)}% ${msg('vs')} ${fmtPeriod(prevP)} (${pct.format(n(prev))}%)`
    : `${periodDelta >= 0 ? '+' : ''}${pct.format(periodDelta)}% ${msg('vs')} ${fmtPeriod(prevP)} (${fmt(prev, 'money')})`;
  return `<div class="view360AnalysisMetric ${esc(metric.key)}">
    <div class="label">${label}</div>
    <div class="value">${view360MetricFormat(curr, metric)}</div>
    <div class="delta ${cls(periodDelta, metric.invert)}">${deltaLine}</div>
    ${kpiCompareHtml(compareItem, prevP, currP)}
    ${view360KmoSparklineHtml(yearValues, metric)}
  </div>`;
}
function view360KmoCategoryHtml(data, row, prevP, currP, fullYears, config) {
  const metrics = view360KmoMetrics();
  const prodText = view360KmoAnalysisText(data, metrics[0], prevP, currP, fullYears, row, config);
  const vervalText = view360KmoAnalysisText(data, metrics[1], prevP, currP, fullYears, row, config);
  const progressieText = view360KmoAnalysisText(data, metrics[2], prevP, currP, fullYears, row, config);
  const spText = view360KmoAnalysisText(data, metrics[3], prevP, currP, fullYears, row, config);
  const spCapText = view360KmoAnalysisText(data, view360SpCapMetric(), prevP, currP, fullYears, row, config);
  const narrative = `<p>${prodText} ${vervalText}</p><p>${progressieText}</p><p>${spText} ${spCapText}</p>`;
  return `<div class="view360AnalysisCategory ${row.isMain ? 'mainRow' : 'subRow'}">
    <div class="view360AnalysisCategoryTitle">${row.labelHtml}</div>
    <div class="view360AnalysisGrid">${metrics.map(metric => view360KmoMetricHtml(data, metric, prevP, currP, fullYears, row, config)).join('')}</div>
    <div class="view360AnalysisNarrative">${narrative}</div>
  </div>`;
}
function view360AnalysisModeFor() {
  return ['main', 'sub', 'all'].includes(view360AnalysisMode) ? view360AnalysisMode : 'main';
}
function view360KmoAnalysisHtml(data, prevP, currP, config) {
  const fullYears = getFullYearPeriods(data, 'PRODUCTIE', currP, 3);
  const analysisMode = view360AnalysisModeFor();
  const rows = view360KmoRows(data, analysisMode, currP, config);
  const categoriesHtml = rows.map(row => view360KmoCategoryHtml(data, row, prevP, currP, fullYears, config)).join('');
  return `<div class="view360AnalysisBlock">
    ${exportActionsHtml({ label: config.title })}
    <div class="view360AnalysisHead">
      <div class="view360AnalysisTitle"><h3>${esc(config.title)}</h3><p>${esc(config.subtitle)}</p></div>
    </div>
    <div class="view360AnalysisCategories">${categoriesHtml}</div>
  </div>`;
}
const view360ClosedBlocks = new Set();
function setupView360Collapse(target) {
  const originalBlocks = Array.from(target.children);
  const groups = [
    { start: 3, end: 7, title: currentLang === 'fr' ? 'Production/Chute' : 'Productie/verval' },
    { start: 7, end: 9, title: msg('tabPortefeuille') },
    { start: 9, end: 12, title: msg('tabSchade') }
  ];
  groups.forEach(({ start, end, title }) => {
    const children = originalBlocks.slice(start, end);
    const group = document.createElement('div');
    group.className = 'view360Block view360GroupedBlock';
    group.innerHTML = `<h3>${esc(title)}</h3>`;
    target.insertBefore(group, children[0]);
    children.forEach(block => group.appendChild(block));
  });
  const keys = ['auto', 'particulieren', 'kmo', 'productieVerval', 'portefeuille', 'schade'];
  const slot = document.querySelector('#view360 > .card > .titleExportRow > .sectionToolbarSlot');
  let allButton = $('view360CollapseAll');
  if (!allButton && slot) {
    allButton = document.createElement('button');
    allButton.id = 'view360CollapseAll';
    allButton.type = 'button';
    allButton.className = 'drillBtn';
    slot.appendChild(allButton);
  }
  const blocks = Array.from(target.children);
  const updateAll = () => {
    const anyClosed = blocks.some(block => block.classList.contains('view360Collapsed'));
    if (allButton) {
      allButton.textContent = msg(anyClosed ? 'drillDownActive' : 'drillDown');
      allButton.classList.toggle('active', anyClosed);
    }
  };
  blocks.forEach((block, index) => {
    const key = keys[index];
    const header = block.querySelector(':scope > .view360AnalysisHead, :scope > .portfolioPieHeader, :scope > h3');
    if (!header) return;
    const heading = header.matches('h3') ? header : header.querySelector('h2, h3');
    const title = heading.textContent;
    block.classList.add('view360Collapsible');
    const body = document.createElement('div');
    body.className = 'view360CollapseBody';
    body.id = 'view360Body-' + key;
    Array.from(block.children).forEach(child => {
      if (child !== header && !child.classList.contains('blockExportActions')) body.appendChild(child);
    });
    block.appendChild(body);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'view360CollapseToggle';
    const iconKey = { auto: 'auto', particulieren: 'particulieren', kmo: 'ondernemingen' }[key];
    const icon = iconKey
      ? `<img class="catIcon" src="${CATEGORY_ICONS[iconKey]}" alt="" />`
      : '<span class="view360HeaderIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20h16M6 16V9h3v7m3 0V4h3v12m3 0v-5h3v5"/></svg></span>';
    button.innerHTML = `<span class="catTitle">${icon}<span class="view360BlockLabel">${esc(title)}</span></span><span class="small">${esc(dashboardPreviousPeriod)} → ${esc(dashboardCurrentPeriod)}</span><span class="view360CollapseHint"></span>`;
    button.setAttribute('aria-controls', body.id);
    const newHeader = document.createElement('h3');
    newHeader.className = 'view360BlockHead';
    newHeader.appendChild(button);
    const subtitle = header.querySelector('p');
    if (subtitle) body.prepend(subtitle);
    header.replaceWith(newHeader);
    const setClosed = closed => {
      block.classList.toggle('view360Collapsed', closed);
      button.setAttribute('aria-expanded', String(!closed));
      button.querySelector('.view360CollapseHint').textContent = currentLang === 'fr'
        ? (closed ? 'Cliquez pour ouvrir' : 'Cliquez pour fermer')
        : (closed ? 'Klik om te openen' : 'Klik om te sluiten');
      if (closed) view360ClosedBlocks.add(key);
      else view360ClosedBlocks.delete(key);
    };
    block._setView360Closed = setClosed;
    setClosed(view360ClosedBlocks.has(key));
    button.addEventListener('click', () => {
      setClosed(!block.classList.contains('view360Collapsed'));
      updateAll();
    });
  });
  if (allButton) allButton.onclick = () => {
    const close = !blocks.some(block => block.classList.contains('view360Collapsed'));
    blocks.forEach(block => block._setView360Closed?.(close));
    updateAll();
  };
  updateAll();
}
function render360View() {
  const target = $('view360Content');
  if (!target) return;
  document.querySelectorAll('body > .view360RuntimeTooltip').forEach(el => el.remove());
  if (!lastKpiContext || !lastData || !dashboardPreviousPeriod || !dashboardCurrentPeriod) {
    target.innerHTML = '';
    return;
  }
  const prevP = dashboardPreviousPeriod, currP = dashboardCurrentPeriod;
  const prodItems = categoryKpiItems(lastData, 'productie', prevP, currP) || [];
  const vervalItems = categoryKpiItems(lastData, 'verval', prevP, currP) || [];
  const schadeItems = categoryKpiItems(lastData, 'schade', prevP, currP) || [];
  const prodPrevFull = getPreviousFullYearPeriodForPie(lastData, currP, 'productie') || prevP;
  const schadePrevFull = getPreviousFullYearPeriodForPie(lastData, currP, 'schade') || prevP;
  const portYearItems = getPortfolioYearItems(lastData, 'TOTAAL NON LIFE', currP);
  const portPrevFull = portYearItems[portYearItems.length - 1]?.period || prevP;
  const leftTitle = currentLang === 'fr' ? 'Année complète + période' : 'Vorig volledig jaar + periode';
  const portfolioEvolutionTitle = currentLang === 'fr' ? 'Evolution portefeuille' : 'Portefeuille-evolutie';
  const portPrevVal = getPortfolioValue(lastData, 'TOTAAL NON LIFE', prevP);
  const portCurrVal = getPortfolioValue(lastData, 'TOTAAL NON LIFE', currP);
  const hasPortCompare = portPrevVal !== 0 || portCurrVal !== 0;
  const portPieTitle = currentLang === 'fr' ? 'Répartition prime acquise' : 'Verdeling verdiende premie';
  target.innerHTML = [
    ...view360AnalysisConfigs().map(config => view360KmoAnalysisHtml(lastData, prevP, currP, config)),
    `<div class="view360Block"><h3>${esc(msg('tabSamenvatting'))}</h3><div class="kpis kpiOverviewGrid">${view360SummaryKpiCardsHtml(lastData, lastKpiContext.summary, prevP, currP)}</div></div>`,
    `<div class="view360Block"><h3>${esc(msg('tabProductie'))}</h3><div class="kpis kpiOverviewGrid">${view360ProductionKpiCardsHtml(lastData, prodItems, prevP, currP)}</div></div>`,
    `<div class="portfolioPieCard view360PieCard"><div class="portfolioPieHeader"><h2>${esc(msg('productionPieTitle'))}</h2></div>${view360PiePanelsHtml('view360ProdPie', pieComparisonPanelTitle('prevFull', prodPrevFull), pieComparisonPanelTitle('curr', currP))}</div>`,
    `<div class="view360Block"><h3>${esc(msg('tabVerval'))}</h3><div class="kpis kpiOverviewGrid">${view360KpiCardsWithHistoryHtml(lastData, vervalItems, prevP, currP, { sourceType: 'PRODUCTIE', field: cols.vervalPremie, cellIndex: 7, type: 'money', invert: true })}</div></div>`,
    `<div class="view360PortfolioCard"><h3>${esc(portfolioEvolutionTitle)}</h3><div class="portfolioGrid"><div class="portfolioChartCard"><h3>${esc(leftTitle)}</h3>${portfolioPeriodComparisonBars(lastData, 'TOTAAL NON LIFE', prevP, currP)}</div><div class="portfolioChartCard"><h3>${esc(msg('portefeuilleComparison'))}</h3>${hasPortCompare ? portfolioAmountSummary(prevP, currP, portPrevVal, portCurrVal) : `<div class="portfolioNoData">${msg('portefeuilleEmpty')}</div>`}</div></div></div>`,
    `<div class="portfolioPieCard view360PieCard"><div class="portfolioPieHeader"><h2>${esc(portPieTitle)}</h2></div>${view360PiePanelsHtml('view360PortPie', (currentLang === 'fr' ? 'Année complète précédente · ' : 'Volledig voorgaand jaar · ') + portPrevFull, (currentLang === 'fr' ? 'Dernière période · ' : 'Laatste periode · ') + currP)}</div>`,
    `<div class="view360Block"><h3>S/P</h3><div class="kpis kpiOverviewGrid">${view360KpiCardsWithHistoryHtml(lastData, schadeKpiMetricItems(schadeItems, false), prevP, currP, { sourceType: 'SCHADE', field: cols.sp, cellIndex: 18, type: 'pct', invert: true })}</div></div>`,
    `<div class="view360Block"><h3>${esc(msg('spAfgetopt'))}</h3><div class="kpis kpiOverviewGrid">${view360KpiCardsWithHistoryHtml(lastData, schadeKpiMetricItems(schadeItems, true), prevP, currP, { sourceType: 'SCHADE', field: cols.spCap, cellIndex: 20, type: 'pct', invert: true })}</div></div>`,
    `<div class="portfolioPieCard view360PieCard"><div class="portfolioPieHeader"><h2>${esc(msg('schadePieTitle'))}</h2></div>${view360PiePanelsHtml('view360SchadePie', pieComparisonPanelTitle('prevFull', schadePrevFull), pieComparisonPanelTitle('curr', currP))}</div>`
  ].join('');
  target.querySelectorAll('.view360RuntimeTooltip').forEach(tooltip => document.body.appendChild(tooltip));
  renderView360ProductionPies(lastData, prodPrevFull, currP);
  renderView360PortfolioPies(lastData, currP);
  renderView360SchadePies(lastData, schadePrevFull, currP);
  attachPortfolioBarHover(target);
  setupView360Collapse(target);
}
function updateTopKpisForActiveTab() {
  if (!lastKpiContext || !lastData || !dashboardPreviousPeriod || !dashboardCurrentPeriod) return;
  const tab = activeTabId();
  if (tab === 'samenvatting') {
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
function kpiCompareValueText(value, type) {
  if (type === 'pct' || type === 'sp-category' || type === 'pct-combo' || type === 'pct-combo-plain') return `${pct.format(n(value))}%`;
  if (type === 'num') return num.format(n(value));
  return fmt(n(value), 'money');
}
function kpiCompareBubbleText(x) {
  const delta = n(x.v) - n(x.o);
  if (x.type === 'pct' || x.type === 'sp-category' || x.type === 'pct-combo' || x.type === 'pct-combo-plain') {
    return `Δ ${delta >= 0 ? '+' : ''}${pct.format(delta)} ptn`;
  }
  return `Δ ${delta > 0 ? '+' : delta < 0 ? '-' : ''}${fmt(Math.abs(delta), x.type || 'money')}`;
}
function kpiCompareClass(x) {
  const delta = x.type === 'pct' || x.type === 'sp-category' || x.type === 'pct-combo' || x.type === 'pct-combo-plain'
    ? ppDelta(x.o, x.v)
    : yoy(x.o, x.v);
  return cls(delta, !!x.invert);
}
function kpiCompareHtml(x, prevP, currP) {
  if (x.o === undefined || x.v === undefined) return '';
  const type = x.type === 'sp-category' || x.type === 'pct-combo' || x.type === 'pct-combo-plain' ? 'pct' : (x.type === 'detail-combo' ? 'money' : x.type);
  const prev = n(x.o), curr = n(x.v);
  const history = Array.isArray(x.kpiHistory) ? x.kpiHistory : [];
  const historyValues = history.map(entry => n(entry.value));
  const footer = bubble => x.spToggleHtml ? `<div class="kpiCompareFooter">${bubble}${x.spToggleHtml}</div>` : bubble;
  const historyHtml = (max, zeroBased = false) => {
    if (!history.length) return '';
    const rows = history.map(entry => {
      const value = n(entry.value);
      let track;
      if (zeroBased) {
        const width = Math.min(48, Math.abs(value) / max * 48);
        const widthStyle = value >= 0 ? `left:50%;width:${width}%` : `right:50%;width:${width}%`;
        track = `<div class="kpiCompareZeroTrack"><div class="kpiCompareZeroFill prev" style="${widthStyle}"></div></div>`;
      } else {
        const width = Math.min(100, Math.abs(value) / max * 100);
        track = `<div class="kpiCompareTrack"><div class="kpiCompareFill prev" style="width:${width}%"></div></div>`;
      }
      return `<div class="kpiCompareHistoryLine"><div class="kpiComparePeriod">${esc(fullYearLabel(entry.period))}</div>${track}<div class="kpiCompareAmount">${kpiCompareValueText(value, type)}</div></div>`;
    }).join('');
    return `<div class="kpiCompareHistory">${rows}</div>`;
  };
  if (x.zeroCompare) {
    const max = Math.max(1, Math.abs(prev), Math.abs(curr), ...historyValues.map(Math.abs));
    const prevW = Math.min(48, Math.abs(prev) / max * 48);
    const currW = Math.min(48, Math.abs(curr) / max * 48);
    const currSide = curr >= 0 ? 'pos' : 'neg';
    const prevStyle = prev >= 0 ? `left:50%;width:${prevW}%` : `right:50%;width:${prevW}%`;
    const currStyle = curr >= 0 ? `left:50%;width:${currW}%` : `right:50%;width:${currW}%`;
    const zeroLine = (period, value, widthStyle, clsName) => `<div class="kpiCompareZeroLine"><div class="kpiComparePeriod">${fmtPeriod(period)}</div><div class="kpiCompareZeroTrack"><div class="kpiCompareZeroFill ${clsName}" style="${widthStyle}"></div></div><div class="kpiCompareAmount">${kpiCompareValueText(value, type)}</div></div>`;
    return `<div class="kpiCompare zero"><div class="kpiCompareZeroRows">${zeroLine(prevP, prev, prevStyle, 'prev')}${zeroLine(currP, curr, currStyle, `curr ${currSide}`)}</div>${footer(`<div class="kpiCompareBubble ${kpiCompareClass(x)}">${kpiCompareBubbleText(x)}</div>`)}${historyHtml(max, true)}</div>`;
  }
  const max = Math.max(1, Math.abs(prev), Math.abs(curr), ...historyValues.map(Math.abs));
  const prevW = Math.min(100, Math.abs(prev) / max * 100);
  const currW = Math.min(100, Math.abs(curr) / max * 100);
  const line = (period, value, width, clsName) => `<div class="kpiCompareLine"><div class="kpiComparePeriod">${fmtPeriod(period)}</div><div class="kpiCompareTrack"><div class="kpiCompareFill ${clsName}" style="width:${width}%"></div></div><div class="kpiCompareAmount">${kpiCompareValueText(value, type)}</div></div>`;
  return `<div class="kpiCompare">${line(prevP, prev, prevW, 'prev')}${line(currP, curr, currW, 'curr')}${footer(`<div class="kpiCompareBubble ${kpiCompareClass(x)}">${kpiCompareBubbleText(x)}</div>`)}${historyHtml(max)}</div>`;
}
function animateKpiNumbers(root = $('kpis')) {
  if (motionIsReduced() || document.body.classList.contains('pdfExportBusy')) return;
  const scope = root || document;
  scope.querySelectorAll('.value').forEach(el => {
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

function kpiCardsHtml(items, prevP, currP, options = {}) {
  const interactive = options.interactive !== false;
  const allowSpToggle = options.allowSpToggle !== false;
  return items.map((x, i) => {
    const titleLabel = x.showPeriodInLabel === false ? `${x.metricLabel || x.l} ${x.l}` : `${x.l}`;
    const label = `<span>${esc(titleLabel)}</span><span class="kpi-period">ULT. ${esc(currP)}</span>`;
    const cardClass = 'kpi' + (x.dynamicCategory ? ' dynamicCategoryKpi' : '');
    const kpiAttrs = x.dynamicCategory && interactive ? ` data-kpi-cat="${esc(x.jumpCat || x.l)}" role="button" tabindex="0"` : '';
    const compareHtml = kpiCompareHtml(x, prevP, currP);
    const openCard = `<div class="${cardClass}"${kpiAttrs}>`;

    if (x.type === 'sp-category') {
      const key = normKey(x.l);
      const capped = showCappedSpKpis;
      const value = capped ? x.v2 : x.v;
      const previous = capped ? x.o2 : x.o;
      const toggleLabel = capped ? msg('spAfgetopt') : 'S/P';
      const toggleClass = capped ? ' is-active' : '';
      const toggleHtml = allowSpToggle ? `<button type="button" class="kpiSpToggle${toggleClass}" data-kpi-key="${esc(key)}" title="${esc(capped ? 'Toon S/P' : 'Toon afgetopte S/P')}">${esc(toggleLabel)}</button>` : '';
      const view = { ...x, v: value, o: previous, spToggleHtml: toggleHtml };
      const d = ppDelta(previous, value);
      const metric = capped ? msg('spAfgetopt') : 'S/P';
      const metricDisplay = currentLang === 'fr' ? metric : metric.replace('afgetopt', 'afget.');
      return `${openCard}<div class="label">${label}</div><div class="value">${metricDisplay} ${pct.format(value)}%</div><div class="delta ${cls(d, x.invert)}">${kpiSpDeltaLine(previous, value, prevP)}</div>${kpiCompareHtml(view, prevP, currP)}</div>`;
    }

    if (x.type === 'pct-combo-plain') {
      const spClass = x.v <= x.o ? 'pos' : 'neg';
      const spCapClass = x.v2 <= x.o2 ? 'pos' : 'neg';
      return `${openCard}<div class="label">${label}</div><div class="value">S/P ${pct.format(x.v)}%</div><div class="delta ${spClass}">S/P ${kpiSpDeltaLine(x.o, x.v, prevP)}</div><div class="delta ${spCapClass}">${msg('spAfgetopt')} ${kpiSpDeltaLine(x.o2, x.v2, prevP)}</div>${compareHtml}</div>`;
    }

    if (x.type === 'pct-combo') {
      const d = ppDelta(x.o, x.v);
      const d2 = ppDelta(x.o2, x.v2);
      return `${openCard}<div class="label">${label}</div><div class="value">S/P ${pct.format(x.v)}%<span class="kpi-subvalue">(${pct.format(x.v2)}% ${msg('spAfgetopt').toLowerCase().replace('s/p ', '')})</span></div><div class="delta ${cls(d, x.invert)}">S/P ${kpiSpDeltaLine(x.o, x.v, prevP)}</div><div class="delta ${cls(d2, x.invert)}">${msg('spAfgetopt')} ${kpiSpDeltaLine(x.o2, x.v2, prevP)}</div>${compareHtml}</div>`;
    }

    if (x.type === 'detail-combo') {
      const d = yoy(x.o, x.v);
      const spCapLabel = currentLang === 'fr' ? msg('spAfgetopt') : 'afget.';
      return `${openCard}<div class="label">${label}</div><div class="value">${fmt(x.v, 'money')}</div><div class="delta ${cls(d, false)}">${d >= 0 ? '+' : ''}${pct.format(d)}% ${msg('vs')} ${fmtPeriod(prevP)} (${fmt(x.o, 'money')})</div><div class="delta neu">S/P ${pct.format(x.sp)}% · ${spCapLabel} ${pct.format(x.spCap)}%</div>${kpiCompareHtml(x, prevP, currP)}</div>`;
    }

    const d = x.type === 'pct' ? ppDelta(x.o, x.v) : yoy(x.o, x.v);
    if (x.type === 'pct') {
      return `${openCard}<div class="label">${label}</div><div class="value">${fmt(x.v, x.type)}</div><div class="delta ${cls(d, x.invert)}">${d >= 0 ? '+' : ''}${pct.format(d)}% ${msg('vs')} ${fmtPeriod(prevP)} (${pct.format(n(x.o))}%)</div>${compareHtml}</div>`;
    }
    const amountDelta = x.v - x.o;
    const showPreviousAmount = x.compareAmountMode === 'previous';
    const amountText = showPreviousAmount ? fmt(x.o, x.type) : (x.dynamicCategory ? fmt(amountDelta, x.type) : fmt(x.o, x.type));
    const amountPrefix = (!showPreviousAmount && x.dynamicCategory && amountDelta > 0) ? '+' : '';
    return `${openCard}<div class="label">${label}</div><div class="value">${fmt(x.v, x.type)}</div><div class="delta ${cls(d, x.invert)}">${d >= 0 ? '+' : ''}${pct.format(d)}% ${msg('vs')} ${prevP} <span style="opacity:.7">(${amountPrefix}${amountText})</span></div>${compareHtml}</div>`;
  }).join('');
}

function renderKpis(items, prevP, currP) {
  const target = $('kpis');
  if (!target) return;
  target.innerHTML = kpiCardsHtml(items, prevP, currP);
  animateKpiNumbers(target);
  triggerKpiMotion(target.closest('.kpiExportWrap'));
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
  const max = Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs));
  return `<div class="bars">` + labels.map((l, i) => {
    const delta = options.showDelta ? (options.absolutePctDelta ? barAbsolutePctDeltaTextHtml(a[i], b[i], !!options.invertDelta) : barDeltaTextHtml(a[i], b[i], !!options.invertDelta)) : '';
    return `<div class="barrow"><div class="barlabel">${l}</div><div class="bararea">` +
    `<div class="barline"><div class="period">${la}</div><div class="track"><div class="fill prevPeriod" style="width:${Math.abs(a[i]) / max * 100}%"></div></div><div class="barDeltaSlot"></div><div class="value">${fmt(a[i], type)}</div></div>` +
    `<div class="barline"><div class="period">${lb}</div><div class="track"><div class="fill currPeriod" style="width:${Math.abs(b[i]) / max * 100}%"></div></div><div class="barDeltaSlot">${delta}</div><div class="value">${fmt(b[i], type)}</div></div>` +
    `</div></div>`;
  }).join('') + `</div>`;
}



// ─── Generieke wrapper voor gegroepeerde renders ──────────────────────────────
// Vervangt de identieke boilerplate in renderProductieGrouped, renderVervalGrouped
// en renderProgressieGrouped (alle drie werken op PRODUCTIE-rijen).
function renderGroupedSection(containerId, data, prevP, currP, renderGroupFn, emptyMsgKey) {
  const rows = nonTotalRows(data, 'PRODUCTIE').filter(r => [prevP, currP].includes(r[cols.periode]));
  const totalRows = totalRowsFor(data, 'PRODUCTIE', prevP, currP);
  const cats = groupedCats(data, 'PRODUCTIE', currP);
  const catHtml = cats.map(cat => renderGroupFn(cat, rows, prevP, currP, data)).join('');
  const totalHtml = totalRows.length ? totalBlock(renderGroupFn('TOTAAL NON LIFE', totalRows, prevP, currP, data)) : '';
  if (!catHtml && !totalHtml) { $(containerId).innerHTML = `<div class="note">${msg(emptyMsgKey)}</div>`; return; }
  $(containerId).innerHTML = totalHtml + catHtml;
}

function renderProductieGrouped(data, prevP, currP) {
  renderGroupedSection('prodGrouped', data, prevP, currP, renderProductionGroup, 'noProd');
}
function renderVervalGrouped(data, prevP, currP) {
  renderGroupedSection('vervalGrouped', data, prevP, currP, renderVervalGroup, 'noVerval');
}
function renderProgressieGrouped(data, prevP, currP) {
  renderGroupedSection('progGrouped', data, prevP, currP, renderProgressieGroup, 'noProg');
}
function previousYearsSeries(data, sourceType, cat, ordered, currP, field, cellIndex) {
  const periods = getFullYearPeriods(data, sourceType, currP, 3);
  if (!previousYearsMode || !periods.length) return [];
  const valueFor = (sub, period) => {
    if (normKey(cat) === 'TOTAAL NON LIFE') return totalNumber(totalRow(data, sourceType, period), field, cellIndex);
    const exactRows = rowsOfPeriodHeadSub(data, sourceType, period, cat, sub);
    const row = exactRows[exactRows.length - 1];
    return n(row?.[field]);
  };
  return periods.map(period => ({ period, values: ordered.map(sub => valueFor(sub, period)) }));
}
function previousYearsSeriesForProduction(data, cat, ordered, currP, field, cellIndex) {
  return previousYearsSeries(data, 'PRODUCTIE', cat, ordered, currP, field, cellIndex);
}
function barCompareHtmlWithPreviousYears(labels, a, b, la, lb, type, color, parentCategory, options, previousYears = []) {
  if (!previousYearsMode || !previousYears.length) return barCompareHtml(labels, a, b, la, lb, type, color, parentCategory, options);
  const isPct = type === 'pct';
  const max = Math.max(isPct ? 100 : 1, ...a.map(Math.abs), ...b.map(Math.abs), ...previousYears.flatMap(x => x.values.map(v => Math.abs(v || 0))));
  return `<div class="bars">` + labels.map((l, i) => {
    const delta = options?.showDelta ? (options.absolutePctDelta ? barAbsolutePctDeltaTextHtml(a[i], b[i], !!options.invertDelta) : barDeltaTextHtml(a[i], b[i], !!options.invertDelta)) : '';
    const yearLines = previousYears.map((year, yearIndex) => {
      const value = Number(year.values[i]) || 0;
      const previous = yearIndex > 0 ? Number(previousYears[yearIndex - 1].values[i]) || 0 : null;
      const yearDelta = previous ? (isPct || options?.absolutePctDelta ? ppDelta(previous, value) : yoy(previous, value)) : null;
      const yearDeltaText = isPct || options?.absolutePctDelta ? `${yearDelta >= 0 ? '+' : ''}${pct.format(yearDelta)} ptn` : `${yearDelta >= 0 ? '+' : ''}${pct.format(yearDelta)}%`;
      const yearDeltaHtml = yearDelta === null ? '' : `<span class="previousYearsDelta ${cls(yearDelta, !!options?.invertDelta)}">${yearDeltaText}</span>`;
      return `<div class="barline previousYearLine"><div class="period">${esc(fmtPeriod(year.period))}</div><div class="track"><div class="fill" style="width:${Math.abs(value) / max * 100}%"></div></div><div class="barDeltaSlot">${yearDeltaHtml}</div><div class="value">${fmt(value, type)}</div></div>`;
    }).join('');
    return `<div class="barrow"><div class="barlabel">${l}</div><div class="bararea">` +
    `<div class="barline"><div class="period">${la}</div><div class="track"><div class="fill prevPeriod" style="width:${Math.abs(a[i]) / max * 100}%"></div></div><div class="barDeltaSlot"></div><div class="value">${fmt(a[i], type)}</div></div>` +
    `<div class="barline"><div class="period">${lb}</div><div class="track"><div class="fill currPeriod" style="width:${Math.abs(b[i]) / max * 100}%"></div></div><div class="barDeltaSlot">${delta}</div><div class="value">${fmt(b[i], type)}</div></div>` +
    yearLines +
    `</div></div>`;
  }).join('') + `</div>`;
}
function groupContext(cat, rows, prevP, currP) {
  const catRows = rows.filter(r => r[cols.hoofd] === cat);
  const ordered = orderedSubs(catRows, cat);
  const prevRow = sub => catRows.find(r => r[cols.sub] === sub && r[cols.periode] === prevP) || {};
  const currRow = sub => catRows.find(r => r[cols.sub] === sub && r[cols.periode] === currP) || {};
  const vals = (field, period) => ordered.map(sub => n((period === prevP ? prevRow(sub) : currRow(sub))[field]));
  return {
    catRows,
    ordered,
    labels: labelHtmlFor(ordered, cat),
    prevRow,
    currRow,
    vals,
    head: currRow(cat),
    prevHead: prevRow(cat)
  };
}
function metricHtml(title, valueHtml, delta = '') {
  return `<div class="metric"><b>${title}</b><span class="metric-val">${valueHtml}</span>${delta}</div>`;
}
function miniCardHtml(title, body, extraClass = '') {
  const cls = extraClass ? ` ${extraClass}` : '';
  return `<div class="miniCard${cls}"><h3>${title}</h3>${body}</div>`;
}
function categoryBlockHtml(cat, periodHtml, bodyHtml) {
  return `<div class="cat" data-category-key="${esc(cat)}"><div class="catHead exportableBlockHeader"><div class="catTitle">${catTitleHtml(cat)}</div><div class="small">${periodHtml}</div>${productBlockExportActionsHtml()}</div><div class="p-18">${bodyHtml}</div></div>`;
}
function renderProductionGroup(cat, rows, prevP, currP, data) {
  const { ordered, labels, vals, head, prevHead } = groupContext(cat, rows, prevP, currP);
  const dProd = yoy(n(prevHead[cols.prodPremie]), n(head[cols.prodPremie]));
  const dCnt = yoy(n(prevHead[cols.prodAantal]), n(head[cols.prodAantal]));
  const prodHistory = previousYearsSeriesForProduction(data, cat, ordered, currP, cols.prodPremie, 5);
  const countHistory = previousYearsSeriesForProduction(data, cat, ordered, currP, cols.prodAantal, 6);
  const metrics = `<div class="split split-2">` +
    metricHtml(`${msg('productiepremie')} ${currP}`, euro.format(n(head[cols.prodPremie])), deltaHtml(dProd, n(prevHead[cols.prodPremie]), prevP, 'money')) +
    metricHtml(msg('aantalZaken'), num.format(n(head[cols.prodAantal])), deltaHtml(dCnt, n(prevHead[cols.prodAantal]), prevP, 'num')) +
    `</div>`;
  const cards = `<div class="miniGrid">` +
    miniCardHtml(msg('productiepremie'), barCompareHtmlWithPreviousYears(labels, vals(cols.prodPremie, prevP), vals(cols.prodPremie, currP), prevP, currP, 'money', 'blue', '', { showDelta: true }, prodHistory)) +
    miniCardHtml(msg('aantalProductiezaken'), barCompareHtmlWithPreviousYears(labels, vals(cols.prodAantal, prevP), vals(cols.prodAantal, currP), prevP, currP, 'num', 'blue', '', { showDelta: true }, countHistory)) +
    `</div>`;
  return categoryBlockHtml(cat, `${prevP} → ${currP}`, metrics + cards);
}

function earnedPremiumForVervalRatio(data, key, period) {
  if (!data || !key || !period) return 0;
  if (String(key).trim().toUpperCase() === 'TOTAAL NON LIFE') return getTotalNonLifeValue(data, 'SCHADE', period, cols.verdiend, 15);
  const aliases = portfolioCategoryAliases(key).map(normKey);
  const valueFromRow = row => {
    if (!row) return 0;
    const byName = n(row[cols.verdiend]);
    if (byName !== 0) return byName;
    if (row._cells && row._cells[15] !== undefined) return n(row._cells[15]);
    return 0;
  };
  // Belangrijk: voor de vervalratio moet de verdiende premie van exact dezelfde tak gebruikt worden.
  // Dus voor 'Auto' mag niet per ongeluk 'Auto Vloten' of 'Auto Niet Vloten' genomen worden.
  const exactSub = aliases.flatMap(alias => rowsOfPeriodSub(data, 'SCHADE', period, alias))[0];
  const exactHeadAndSub = aliases.flatMap(alias => rowsOfPeriodHeadSub(data, 'SCHADE', period, alias, alias))[0];
  const row = exactSub || exactHeadAndSub || null;
  return valueFromRow(row);
}
function vervalRatioText(vervalPremie, verdiendePremie, period) {
  const earned = n(verdiendePremie);
  if (!earned) return '';
  const ratio = n(vervalPremie) / earned * 100;
  if (currentLang === 'fr') return `<span class="claimAvgNote">(ratio chute ${pct.format(ratio)}% vs prime acquise ultimo ${esc(period)})</span>`;
  return `<span class="claimAvgNote">(vervalratio ${pct.format(ratio)}% tov verd.premie ${euro.format(earned)} - ult. ${esc(period)})</span>`;
}
function vervalRatioFullPeriods(data, currentPeriod) {
  const currentKey = pkey(currentPeriod);
  const prodPeriods = new Set(rowsOf(data, 'PRODUCTIE').map(r => String(r[cols.periode] || '').trim()).filter(Boolean));
  return getPortfolioPeriods(data)
    .filter(p => String(p).trim().startsWith('12 '))
    .filter(p => prodPeriods.has(p))
    .filter(p => !currentKey || pkey(p) <= currentKey)
    .slice(-3);
}
function vervalPremiumForVervalRatio(data, key, period) {
  if (!data || !key || !period) return 0;
  if (String(key).trim().toUpperCase() === 'TOTAAL NON LIFE') return totalNumber(totalRow(data, 'PRODUCTIE', period), cols.vervalPremie, 7);
  const aliases = portfolioCategoryAliases(key).map(normKey);
  const valueFromRow = row => {
    if (!row) return 0;
    const byName = n(row[cols.vervalPremie]);
    if (byName !== 0) return byName;
    if (row._cells && row._cells[7] !== undefined) return n(row._cells[7]);
    return 0;
  };
  const exactHeadAndSub = aliases.flatMap(alias => rowsOfPeriodHeadSub(data, 'PRODUCTIE', period, alias, alias))[0];
  const exactSub = aliases.flatMap(alias => rowsOfPeriodSub(data, 'PRODUCTIE', period, alias))[0];
  return valueFromRow(exactHeadAndSub || exactSub || null);
}
function vervalRatioForPeriod(data, key, period) {
  const vervalPremie = vervalPremiumForVervalRatio(data, key, period);
  const verdiendePremie = earnedPremiumForVervalRatio(data, key, period);
  return { period, vervalPremie, verdiendePremie, ratio: verdiendePremie ? vervalPremie / verdiendePremie * 100 : 0 };
}
function vervalRatioBarsHtml(data, key, currentPeriod) {
  const items = vervalRatioFullPeriods(data, currentPeriod)
    .map(period => vervalRatioForPeriod(data, key, period))
    .filter(x => x.verdiendePremie || x.vervalPremie);
  if (!items.length) return `<div class="portfolioNoData">${msg('portefeuilleEmpty')}</div>`;
  return `<div class="vervalRatioBars">` + items.map(x => {
    const width = Math.max(2, Math.min(100, Math.abs(x.ratio)));
    return `<div class="vervalRatioLine"><div class="vervalRatioPeriod">${esc(x.period)}</div><div class="vervalRatioTrack"><div class="vervalRatioFill" style="width:${width}%"></div><div class="vervalRatioValue">${pct.format(x.ratio)}% <span class="ratioAmounts">(${euro.format(x.vervalPremie)} vs ${euro.format(x.verdiendePremie)})</span></div></div></div>`;
  }).join('') + `</div>`;
}
function vervalRatioGroupHtml(data, ordered, cat, currentPeriod) {
  if (!data) return `<div class="portfolioNoData">${msg('portefeuilleEmpty')}</div>`;
  const hasSubs = ordered.some(s => s !== cat);
  return `<div class="vervalRatioGroup">` + ordered.map(key => {
    const isMain = key === cat;
    const sectionClass = `${isMain ? 'mainRatioSection' : 'subRatioSection'}${hasSubs ? ' hasSubs' : ''}`;
    const title = categoryRowLabelHtml(key, cat, hasSubs);
    return `<div class="vervalRatioSection ${sectionClass}"><div class="vervalRatioSectionTitle">${title}</div>${vervalRatioBarsHtml(data, key, currentPeriod)}</div>`;
  }).join('') + `</div>`;
}
function renderVervalGroup(cat, rows, prevP, currP, data) {
  const { ordered, labels, vals, head, prevHead } = groupContext(cat, rows, prevP, currP);
  const dVerval = yoy(n(prevHead[cols.vervalPremie]), n(head[cols.vervalPremie]));
  const dCnt = yoy(n(prevHead[cols.vervalAantal]), n(head[cols.vervalAantal]));
  const verdiendePremie = data ? earnedPremiumForVervalRatio(data, cat, currP) : 0;
  const vervalRatioNote = vervalRatioText(head[cols.vervalPremie], verdiendePremie, currP);
  const ratioTitle = currentLang === 'fr' ? 'Chute vs prime acquise' : 'Verval vs verdiende premie';
  const extraTitle = currentLang === 'fr' ? 'Afficher chute client / compagnie' : 'Toon verval door klant / maatschappij';
  const vervalPremieHistory = previousYearsSeriesForProduction(data, cat, ordered, currP, cols.vervalPremie, 7);
  const vervalAantalHistory = previousYearsSeriesForProduction(data, cat, ordered, currP, cols.vervalAantal, 8);
  const vervalKlantHistory = previousYearsSeriesForProduction(data, cat, ordered, currP, cols.vervalKlant, 10);
  const vervalMijHistory = previousYearsSeriesForProduction(data, cat, ordered, currP, cols.vervalMij, 11);
  const metrics = `<div class="split">` +
    metricHtml(`${msg('vervalpremie')} ${currP}`, euro.format(n(head[cols.vervalPremie])), deltaHtml(dVerval, n(prevHead[cols.vervalPremie]), prevP, 'money', true)) +
    metricHtml(msg('aantalVerval'), num.format(n(head[cols.vervalAantal])), deltaHtml(dCnt, n(prevHead[cols.vervalAantal]), prevP, 'num', true)) +
    metricHtml(msg('klantMaatschappij'), `${euro.format(n(head[cols.vervalKlant]))} / ${euro.format(n(head[cols.vervalMij]))}`) +
    `</div>`;
  const extraCards = `<details class="vervalExtraDetails"><summary>${extraTitle}</summary><div class="vervalExtraGrid">` +
    miniCardHtml(msg('vervalKlant'), barCompareHtmlWithPreviousYears(labels, vals(cols.vervalKlant, prevP), vals(cols.vervalKlant, currP), prevP, currP, 'money', 'orange', '', { invertDelta: true }, vervalKlantHistory)) +
    miniCardHtml(msg('vervalMaatschappij'), barCompareHtmlWithPreviousYears(labels, vals(cols.vervalMij, prevP), vals(cols.vervalMij, currP), prevP, currP, 'money', 'orange', '', { invertDelta: true }, vervalMijHistory)) +
    `</div></details>`;
  const cards = `<div class="miniGrid vervalMiniGrid">` +
    miniCardHtml(`${msg('vervalpremie')} ${vervalRatioNote}`, barCompareHtmlWithPreviousYears(labels, vals(cols.vervalPremie, prevP), vals(cols.vervalPremie, currP), prevP, currP, 'money', 'orange', '', { showDelta: true, invertDelta: true }, vervalPremieHistory)) +
    miniCardHtml(ratioTitle, vervalRatioGroupHtml(data, ordered, cat, currP), 'vervalRatioCard') +
    miniCardHtml(msg('aantalVervallenZaken'), barCompareHtmlWithPreviousYears(labels, vals(cols.vervalAantal, prevP), vals(cols.vervalAantal, currP), prevP, currP, 'num', 'orange', '', { showDelta: true, invertDelta: true }, vervalAantalHistory)) +
    extraCards +
    `</div>`;
  return categoryBlockHtml(cat, `${prevP} → ${currP}`, metrics + cards);
}

function renderProgressieGroup(cat, rows, prevP, currP, data) {
  const { ordered, labels, vals, head, prevHead } = groupContext(cat, rows, prevP, currP);
  const dProg = yoy(n(prevHead[cols.progPremie]), n(head[cols.progPremie]));
  const progHistory = previousYearsSeriesForProduction(data, cat, ordered, currP, cols.progPremie, 9);
  const progAantalHistory = previousYearsSeriesForProduction(data, cat, ordered, currP, cols.progAantal, 12);
  const transHistory = previousYearsSeriesForProduction(data, cat, ordered, currP, cols.trans, 13);
  const metrics = `<div class="split split-2">` +
    metricHtml(`${msg('progressiepremie')} ${currP}`, `<span class="${cls(n(head[cols.progPremie]))}">${euro.format(n(head[cols.progPremie]))}</span>`, deltaHtml(dProg, n(prevHead[cols.progPremie]), prevP, 'money')) +
    metricHtml(msg('transformatie'), `<span class="${cls(n(head[cols.trans]))}">${euro.format(n(head[cols.trans]))}</span>`) +
    `</div>`;
  const cards = `<div class="miniGrid">` +
    miniCardHtml(msg('progressiepremie'), barCompareHtmlWithPreviousYears(labels, vals(cols.progPremie, prevP), vals(cols.progPremie, currP), prevP, currP, 'money', 'blue', '', { showDelta: true }, progHistory)) +
    miniCardHtml(msg('aantalProgressiezaken'), barCompareHtmlWithPreviousYears(labels, vals(cols.progAantal, prevP), vals(cols.progAantal, currP), prevP, currP, 'num', 'blue', '', { showDelta: true }, progAantalHistory)) +
    miniCardHtml(msg('transformatie'), barCompareHtmlWithPreviousYears(labels, vals(cols.trans, prevP), vals(cols.trans, currP), prevP, currP, 'money', 'blue', '', { showDelta: true }, transHistory)) +
    `</div>`;
  return categoryBlockHtml(cat, `${prevP} → ${currP}`, metrics + cards);
}

function renderSchadeGrouped(data, prevP, currP) {
  const rows = nonTotalRows(data, 'SCHADE').filter(r => [prevP, currP].includes(r[cols.periode]));
  const totalRows = totalRowsFor(data, 'SCHADE', prevP, currP);
  const cats = [...new Set(rows.filter(r => r[cols.periode] === currP).map(r => r[cols.hoofd]).filter(Boolean))];
  const catHtml = cats.map(cat => renderSchadeGroup(cat, rows, prevP, currP, data)).join('');
  const totalHtml = totalRows.length ? totalBlock(renderSchadeGroup('TOTAAL NON LIFE', totalRows, prevP, currP, data)) : '';
  if (!catHtml && !totalHtml) { $('schadeGrouped').innerHTML = `<div class="note">${msg('noSchade')}</div>`; return }
  $('schadeGrouped').innerHTML = totalHtml + catHtml;
}
function claimAverageText(amount, claimCount) {
  const cnt = n(claimCount);
  if (!cnt) return '';
  const avg = n(amount) / cnt;
  const label = currentLang === 'fr' ? 'moyenne' : 'gemiddeld';
  const suffix = currentLang === 'fr' ? '/sinistre' : '/schade';
  return `<span class="claimAvgNote">(${label} ${euro.format(avg)}${suffix})</span>`;
}
function renderSchadeGroup(cat, rows, prevP, currP, data) {
  const catRows = rows.filter(r => r[cols.hoofd] === cat);
  const subAll = [...new Set(catRows.map(r => r[cols.sub]).filter(Boolean))];
  const ordered = [...subAll.filter(s => s === cat), ...subAll.filter(s => s !== cat)];
  const hasSubs = ordered.some(s => s !== cat);
  const labelHtml = ordered.map(s => categoryRowLabelHtml(s, cat, hasSubs));
  const prevRow = s => catRows.find(r => r[cols.sub] === s && r[cols.periode] === prevP) || {};
  const currRow = s => catRows.find(r => r[cols.sub] === s && r[cols.periode] === currP) || {};
  const vals = (field, period) => ordered.map(s => n((period === prevP ? prevRow(s) : currRow(s))[field]));
  const head = currRow(cat);
  const prevHead = prevRow(cat);
  const dLast  = yoy(n(prevHead[cols.schadelast]), n(head[cols.schadelast]));
  const dSp    = ppDelta(n(prevHead[cols.sp]),      n(head[cols.sp]));
  const dSpCap = ppDelta(n(prevHead[cols.spCap]),   n(head[cols.spCap]));
  const dAantal = yoy(n(prevHead[cols.schadeAantal]), n(head[cols.schadeAantal]));
  const headRight = `${prevP} &rarr; ${currP}`;
  const schadelastTitle = `${msg('schadelast')} ${claimAverageText(head[cols.schadelast], head[cols.schadeAantal])}`;
  const afgetopteSchadelastTitle = `${msg('afgetopteSchadelast')} ${claimAverageText(head[cols.schadeCap], head[cols.schadeAantal])}`;
  const schadelastHistory = previousYearsSeries(data, 'SCHADE', cat, ordered, currP, cols.schadelast, 16);
  const spHistory = previousYearsSeries(data, 'SCHADE', cat, ordered, currP, cols.sp, 18);
  const schadeCapHistory = previousYearsSeries(data, 'SCHADE', cat, ordered, currP, cols.schadeCap, 19);
  const spCapHistory = previousYearsSeries(data, 'SCHADE', cat, ordered, currP, cols.spCap, 20);
  const schadeAantalHistory = previousYearsSeries(data, 'SCHADE', cat, ordered, currP, cols.schadeAantal, 17);
  const verdiendHistory = previousYearsSeries(data, 'SCHADE', cat, ordered, currP, cols.verdiend, 15);
  const metrics = `<div class="split" style="grid-template-columns:repeat(4,1fr)">` +
    metricHtml(`${msg('schadelast')} ${currP}`, euro.format(n(head[cols.schadelast])), deltaHtml(dLast, n(prevHead[cols.schadelast]), prevP, 'money', true)) +
    metricHtml(`S/P ${currP}`, `<span class="${spValueClass(n(head[cols.sp]), spThresholdForLabel(cat, cat))}">${pct.format(n(head[cols.sp]))}%</span>`, deltaHtml(dSp, n(prevHead[cols.sp]), prevP, 'pct', true)) +
    metricHtml(`${msg('spAfgetopt')} ${currP}`, `<span class="${spValueClass(n(head[cols.spCap]), spThresholdForLabel(cat, cat))}">${pct.format(n(head[cols.spCap]))}%</span>`, deltaHtml(dSpCap, n(prevHead[cols.spCap]), prevP, 'pct', true)) +
    metricHtml(msg('aantalSchadegevallen'), num.format(n(head[cols.schadeAantal])), deltaHtml(dAantal, n(prevHead[cols.schadeAantal]), prevP, 'num', true)) +
    `</div>`;
  const cards = `<div class="miniGrid">` +
    miniCardHtml(schadelastTitle, barCompareHtmlWithPreviousYears(labelHtml, vals(cols.schadelast, prevP), vals(cols.schadelast, currP), prevP, currP, 'money', 'red', '', { showDelta: true, invertDelta: true }, schadelastHistory)) +
    miniCardHtml(msg('spNietAfgetopt'), barCompareHtmlWithPreviousYears(labelHtml, vals(cols.sp, prevP), vals(cols.sp, currP), prevP, currP, 'pct', 'purple', cat, { showDelta: true, invertDelta: true, absolutePctDelta: true }, spHistory)) +
    miniCardHtml(afgetopteSchadelastTitle, barCompareHtmlWithPreviousYears(labelHtml, vals(cols.schadeCap, prevP), vals(cols.schadeCap, currP), prevP, currP, 'money', 'red', '', { showDelta: true, invertDelta: true }, schadeCapHistory)) +
    miniCardHtml(msg('spAfgetopt'), barCompareHtmlWithPreviousYears(labelHtml, vals(cols.spCap, prevP), vals(cols.spCap, currP), prevP, currP, 'pct', 'purple', cat, { showDelta: true, invertDelta: true, absolutePctDelta: true }, spCapHistory)) +
    miniCardHtml(msg('aantalSchadegevallen'), barCompareHtmlWithPreviousYears(labelHtml, vals(cols.schadeAantal, prevP), vals(cols.schadeAantal, currP), prevP, currP, 'num', 'red', '', { showDelta: true, invertDelta: true }, schadeAantalHistory)) +
    miniCardHtml(msg('verdiendePremie'), barCompareHtmlWithPreviousYears(labelHtml, vals(cols.verdiend, prevP), vals(cols.verdiend, currP), prevP, currP, 'money', 'blue', '', { showDelta: true }, verdiendHistory)) +
    `</div>`;
  return categoryBlockHtml(cat, headRight, metrics + cards);
}


function getTotalNonLifeValue(data, type, period, field, cellIndex) {
  return totalNumber(totalRow(data, type, period), field, cellIndex);
}
function normKey(v) { return String(v || '').trim().toUpperCase().replace(/\s+/g, ' '); }
function portfolioCategoryAliases(key) {
  return {
    'TOTAAL NON LIFE': ['TOTAAL NON LIFE', 'TOTAL NON VIE'],
    'Auto': ['Auto'],
    'Particulieren': ['Particulieren', 'Particuliers'],
    'Ondernemingen': ['Ondernemingen', 'Entreprises'],
    'Auto Vloten': ['Auto Vloten', 'Auto Flottes'],
    'Auto Niet Vloten': ['Auto Niet Vloten', 'Auto Niet-Vloten', 'Auto Non Flottes', 'Auto Non-Flottes'],
    'Particulieren Brand': ['Particulieren Brand', 'Particuliers Incendie'],
    'Particulieren BA': ['Particulieren BA', 'Particuliers BA', 'Particuliers RC'],
    'Particulieren Overige': ['Particulieren Overige', 'Particuliers Overige', 'Particuliers Autres'],
    'Ondernemingen Brand': ['Ondernemingen Brand', 'Entreprises Brand', 'Entreprises Incendie'],
    'Ondernemingen BA': ['Ondernemingen BA', 'Entreprises BA', 'Entreprises RC'],
    'Ondernemingen Overige': ['Ondernemingen Overige', 'Entreprises Overige', 'Entreprises Autres'],
    'Arbeidsongevallen': ['Arbeidsongevallen', 'Accidents de Travail'],
    'Rechtsbijstand': ['Rechtsbijstand', 'Rechtsbijstand Stand Alone', 'Protection Juridique', 'Protection Juridique Stand Alone']
  }[key] || [key];
}
function isPortfolioMainKey(key) {
  return ['Auto','Particulieren','Ondernemingen','Arbeidsongevallen','Rechtsbijstand'].includes(key);
}
function portfolioCategoryLabel(key) {
  const nl = {
    'TOTAAL NON LIFE':'Totaal non life','Auto Vloten':'Auto vloten','Auto Niet Vloten':'Auto niet-vloten','Particulieren Brand':'Particulieren · Brand','Particulieren BA':'Particulieren · BA','Particulieren Overige':'Particulieren · Overige','Ondernemingen Brand':'Ondernemingen · Brand','Ondernemingen BA':'Ondernemingen · BA','Ondernemingen Overige':'Ondernemingen · Overige','Arbeidsongevallen':'Arbeidsongevallen','Rechtsbijstand':'Rechtsbijstand'
  };
  const fr = {
    'TOTAAL NON LIFE':'Total non vie','Auto Vloten':'Auto flottes','Auto Niet Vloten':'Auto non flottes','Particulieren Brand':'Particuliers · Incendie','Particulieren BA':'Particuliers · RC','Particulieren Overige':'Particuliers · Autres','Ondernemingen Brand':'Entreprises · Incendie','Ondernemingen BA':'Entreprises · RC','Ondernemingen Overige':'Entreprises · Autres','Arbeidsongevallen':'Accidents de travail','Rechtsbijstand':'Protection juridique'
  };
  return (currentLang === 'fr' ? fr : nl)[key] || displayLabel(key);
}
function portfolioCategoryTitleHtml(key, isTotal = false) {
  const title = isTotal ? 'TOTAAL NON LIFE' : portfolioCategoryLabel(key);
  if (isTotal) return esc(title);
  let iconKey = '';
  if (String(key).startsWith('Auto')) iconKey = 'auto';
  else if (String(key).startsWith('Particulieren')) iconKey = 'particulieren';
  else if (String(key).startsWith('Ondernemingen')) iconKey = 'ondernemingen';
  else if (String(key).startsWith('Arbeidsongevallen')) iconKey = 'arbeidsongevallen';
  else if (String(key).startsWith('Rechtsbijstand')) iconKey = 'rechtsbijstand';
  const icon = iconKey && CATEGORY_ICONS[iconKey] ? `<img class="catIcon" src="${CATEGORY_ICONS[iconKey]}" alt="" />` : '';
  return `${icon}<span>${esc(title)}</span>`;
}

function getPortfolioPeriods(data) {
  return [...new Set(rowsOf(data, 'SCHADE').map(r => String(r[cols.periode] || '').trim()).filter(Boolean))].sort((a,b) => pkey(a) - pkey(b));
}
function getPortfolioValue(data, key, period) {
  if (key === 'TOTAAL NON LIFE') return getTotalNonLifeValue(data, 'SCHADE', period, cols.verdiend, 15);
  const aliases = portfolioCategoryAliases(key).map(normKey);
  const candidates = isPortfolioMainKey(key)
    ? aliases.flatMap(alias => rowsOfPeriodHeadSub(data, 'SCHADE', period, alias, alias))
    : aliases.flatMap(alias => rowsOfPeriodSub(data, 'SCHADE', period, alias));
  const withData = candidates.slice().reverse().find(r => n(r[cols.verdiend]) !== 0 || (r._cells && n(r._cells[15]) !== 0));
  const row = withData || candidates[candidates.length - 1] || {};
  const byName = n(row[cols.verdiend]);
  if (byName !== 0) return byName;
  if (row && row._cells && row._cells[15] !== undefined) return n(row._cells[15]);
  return 0;
}
function getPortfolioYearItems(data, key = 'TOTAAL NON LIFE', currentPeriod = '') {
  // Portefeuillegrafiek: toon de drie volledige jaren die vóór de laatste periode liggen.
  // Voor een totaalrapport 12 2025 betekent dit dus 12 2022, 12 2023 en 12 2024
  // als blauwe jaarbalken, met 12 2025 als aparte oranje periodebalk.
  const currentKey = pkey(currentPeriod);
  const yearPeriods = getPortfolioPeriods(data)
    .filter(p => String(p).trim().startsWith('12 '))
    .filter(p => !currentKey || pkey(p) < currentKey)
    .slice(-3);
  return yearPeriods.map(p => ({ period: p, value: getPortfolioValue(data, key, p) }));
}
function portfolioPeriodComparisonBars(data, key, prevP, currP) {
  const yearItems = getPortfolioYearItems(data, key, currP).filter(x => x.value !== 0 || String(x.period || '').trim());
  const prevVal = getPortfolioValue(data, key, prevP);
  const currVal = getPortfolioValue(data, key, currP);
  const hasData = yearItems.some(x => x.value !== 0) || prevVal !== 0 || currVal !== 0;
  if (!hasData) return `<div class="portfolioNoData">${msg('portefeuilleEmpty')}</div>`;

  const max = Math.max(1, ...yearItems.map(x => Math.abs(x.value)), Math.abs(prevVal), Math.abs(currVal));
  const lastFullPeriod = yearItems.length ? yearItems[yearItems.length - 1].period : '';
  const lastFullValue = yearItems.length ? yearItems[yearItems.length - 1].value : 0;

  const yearBarHtml = yearItems.map((x, i) => {
    const h = Math.max(2, Math.abs(x.value) / max * 100);
    const isLastFull = i === yearItems.length - 1;
    const overlayH = isLastFull && x.value ? Math.min(100, Math.max(0, Math.abs(prevVal) / Math.abs(x.value) * 100)) : 0;
    const small = '';
    return `<div class="portfolioCompareBarCol">
      <div class="portfolioBarValue">${euro.format(x.value)}<small>${esc(x.period || '')}</small></div>
      <div class="portfolioBarStack">
        <div class="portfolioBarShell fullYear" style="--bar-h:${h}%" data-tip-label="${esc(x.period || '')}" data-tip-value="${euro.format(x.value)}">
          ${isLastFull ? `<div class="portfolioPeriodOverlay" style="--overlay-h:${overlayH}%" data-tip-label="${esc(prevP)}" data-tip-value="${euro.format(prevVal)}"></div>` : ''}
        </div>
      </div>
      <div class="portfolioBarLabel">${esc(x.period || '')}</div>
    </div>`;
  });

  const barsWithDeltas = [];
  yearBarHtml.forEach((bar, i) => {
    barsWithDeltas.push(bar);
    if (i < yearItems.length - 1) {
      const d = yoy(yearItems[i].value, yearItems[i + 1].value);
      barsWithDeltas.push(`<div class="portfolioCompareDelta ${cls(d)}">${d >= 0 ? '+' : ''}${pct.format(d)}%</div>`);
    }
  });

  const periodDelta = yoy(prevVal, currVal);
  const currH = Math.max(2, Math.abs(currVal) / max * 100);
  if (yearItems.length) {
    barsWithDeltas.push(`<div class="portfolioCompareDelta ${cls(periodDelta)}">${periodDelta >= 0 ? '+' : ''}${pct.format(periodDelta)}%</div>`);
  }
  barsWithDeltas.push(`<div class="portfolioCompareBarCol">
    <div class="portfolioBarValue">${euro.format(currVal)}<small>${esc(currP)}</small></div>
    <div class="portfolioBarStack">
      <div class="portfolioBarShell currentPeriod" style="--bar-h:${currH}%" data-tip-label="${esc(currP)}" data-tip-value="${euro.format(currVal)}"></div>
    </div>
    <div class="portfolioBarLabel">${esc(currP)}</div>
  </div>`);

  return `<div class="portfolioPeriodBars">${barsWithDeltas.join('')}</div>`;
}
function signedEuroValue(value) {
  const sign = value >= 0 ? '+' : '-';
  return sign + euro.format(Math.abs(value));
}
function portfolioAmountSummary(prevP, currP, prevVal, currVal) {
  const delta = currVal - prevVal;
  const d = yoy(prevVal, currVal);
  const bubbleClass = delta > 0 ? 'positive' : (delta < 0 ? 'negative' : 'neutral');
  return `<div class="portfolioAmounts">
    <div class="portfolioAmountItem"><b>${msg('vorigJaar')} · ${esc(prevP)}</b><span>${euro.format(prevVal)}</span></div>
    <div class="portfolioAmountItem"><b>${msg('huidigJaar')} · ${esc(currP)}</b><span>${euro.format(currVal)}</span></div>
    <div class="portfolioDeltaBubble ${bubbleClass}"><b>Delta</b><span>${signedEuroValue(delta)} (${d >= 0 ? '+' : ''}${pct.format(d)}%)</span></div>
  </div>`;
}
function attachPortfolioBarHover(root = $('portefeuilleCharts')) {
  if (!root || root._portfolioBarHoverAttached) return;
  root._portfolioBarHoverAttached = true;
  const hide = () => {
    const tooltip = $('portfolioPieTooltip');
    if (tooltip) tooltip.style.display = 'none';
  };
  root.addEventListener('mousemove', e => {
    const target = e.target.closest('.portfolioBarShell,.portfolioPeriodOverlay');
    const tooltip = $('portfolioPieTooltip');
    if (!target || !root.contains(target) || !tooltip) {
      hide();
      return;
    }
    const label = target.dataset.tipLabel || '';
    const value = target.dataset.tipValue || '';
    const extra = target.dataset.tipExtra || '';
    if (tooltip.parentElement !== document.body) document.body.appendChild(tooltip);
    tooltip.innerHTML = `<strong>${esc(label)}</strong><span class="muted">${esc(value)}${extra ? esc(extra) : ''}</span>`;
    tooltip.style.position = 'fixed';
    tooltip.style.transform = 'translate(12px,12px)';
    tooltip.style.display = 'block';
    tooltip.style.left = e.clientX + 'px';
    tooltip.style.top = e.clientY + 'px';
  });
  root.addEventListener('mouseleave', hide);
}
function renderPortfolioBlock(data, key, prevP, currP, isTotal = false, isSub = false) {
  const prevVal = getPortfolioValue(data, key, prevP);
  const currVal = getPortfolioValue(data, key, currP);
  const hasCompare = prevVal !== 0 || currVal !== 0;
  const title = portfolioCategoryTitleHtml(key, isTotal);
  const leftTitle = currentLang === 'fr' ? 'Année complète + période' : 'Vorig volledig jaar + periode';
  return `<div data-category-key="${esc(key)}" class="portfolioCategoryBlock ${isTotal ? 'portfolioTotalBlock' : ''} ${isSub ? 'portfolioSubBlock' : ''}"><div class="portfolioCategoryHead exportableBlockHeader"><div class="catTitle">${title}</div><div class="small">${esc(prevP)} &rarr; ${esc(currP)}</div>${productBlockExportActionsHtml()}</div><div class="portfolioGrid"><div class="portfolioChartCard"><h3>${leftTitle}</h3>${portfolioPeriodComparisonBars(data, key, prevP, currP)}</div><div class="portfolioChartCard"><h3>${msg('portefeuilleComparison')}</h3>${hasCompare ? portfolioAmountSummary(prevP, currP, prevVal, currVal) : `<div class="portfolioNoData">${msg('portefeuilleEmpty')}</div>`}</div></div></div>`;
}
function getPortfolioPieItems(data, period) {
  const keys = ['Auto Vloten','Auto Niet Vloten','Particulieren Brand','Particulieren BA','Particulieren Overige','Ondernemingen Brand','Ondernemingen BA','Ondernemingen Overige','Arbeidsongevallen','Rechtsbijstand'];
  return keys.map((key, index) => {
    const value = getPortfolioValue(data, key, period);
    return { key, label: portfolioCategoryLabel(key), value, color: pieSegmentColor(key, index) };
  }).filter(x => x.value > 0);
}
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
    ctx.fillStyle = '#8fa3ba'; ctx.font = '800 15px Inter, Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg('portefeuilleEmpty'), cx, cy);
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
  drawPieCenter(ctx, cx, cy, radius, centerText || msg('verdiendePremie'), period, .92);
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

function pieHoverTooltipHtml(segment, total) {
  const share = total ? segment.value / total * 100 : 0;
  const base = `${euro.format(segment.value)} = ${pct.format(share)}%`;
  const schadeExtra = segment.isSchade
    ? ` | S/P ${pct.format(segment.sp)}% | ${currentLang === 'fr' ? 'S/P écrêté' : 'Afgetopte S/P'} ${pct.format(segment.spCap)}%`
    : '';
  return `<strong>${esc(segment.label)}</strong><span class="muted">${base}${schadeExtra}</span>`;
}

function attachPieLegendHover(legendEl, canvas, tooltipId = 'portfolioPieTooltip') {
  if (!legendEl || !canvas || legendEl._pieLegendHoverAttached) return;
  legendEl._pieLegendHoverAttached = true;
  const sourceItems = state => (state?.segments || []).map(({start, end, total, ...item}) => item);
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
      const pnt = segmentClientPoint(freshState, seg);
      tooltip.innerHTML = pieHoverTooltipHtml(seg, freshState.total);
      tooltip.style.display = 'block';
      tooltip.style.left = pnt.x + 'px';
      tooltip.style.top = pnt.y + 'px';
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
  const sourceItems = state => (state?.segments || []).map(({start, end, total, ...item}) => item);
  canvas.addEventListener('mousemove', e => {
    const state = canvas._portfolioPieState;
    const tooltip = $(canvas.dataset.tooltipId || 'portfolioPieTooltip');
    if (!state || !state.total || !tooltip) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const idx = hitTestPortfolioPie(state, mx, my);
    if (idx >= 0) {
      if (state.hoverIndex !== idx) drawPortfolioPie(canvas, state.period, sourceItems(state), idx, state.centerText);
      const freshState = canvas._portfolioPieState;
      const seg = freshState.segments[idx];
      tooltip.innerHTML = pieHoverTooltipHtml(seg, freshState.total);
      tooltip.style.display = 'block';
      tooltip.style.left = e.clientX + 'px';
      tooltip.style.top = e.clientY + 'px';
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
function renderPortfolioPies(data, currP) {
  const card = $('portfolioPieCard');
  if (!card) return;
  const yearItems = getPortfolioYearItems(data, 'TOTAAL NON LIFE', currP);
  const prevFullPeriod = yearItems.length ? yearItems[yearItems.length - 1].period : '';
  if (!prevFullPeriod || !currP) { card.classList.add('hidden'); return; }
  const prevItems = getPortfolioPieItems(data, prevFullPeriod);
  const currItems = getPortfolioPieItems(data, currP);
  card.classList.remove('hidden');
  setText('portfolioPieTitle', currentLang === 'fr' ? 'Répartition prime acquise' : 'Verdeling verdiende premie');
  setText('portfolioPieSub', '');
  setText('portfolioPiePrevTitle', (currentLang === 'fr' ? 'Année complète précédente · ' : 'Volledig voorgaand jaar · ') + prevFullPeriod);
  setText('portfolioPieCurrTitle', (currentLang === 'fr' ? 'Dernière période · ' : 'Laatste periode · ') + currP);
  const prevTotal = prevItems.reduce((sum, x) => sum + x.value, 0);
  const currTotal = currItems.reduce((sum, x) => sum + x.value, 0);
  const totalLabel = currentLang === 'fr' ? 'Total prime acquise' : 'Totale verdiende premie';
  const prevTotalEl = $('portfolioPiePrevTotal');
  const currTotalEl = $('portfolioPieCurrTotal');
  if (prevTotalEl) prevTotalEl.innerHTML = `${totalLabel}: <b>${euro.format(prevTotal)}</b>`;
  if (currTotalEl) currTotalEl.innerHTML = `${totalLabel}: <b>${euro.format(currTotal)}</b>`;
  renderPortfolioPieLegend($('portfolioPiePrevLegend'), prevItems);
  renderPortfolioPieLegend($('portfolioPieCurrLegend'), currItems);
  const prevCanvas = $('portfolioPiePrevCanvas'), currCanvas = $('portfolioPieCurrCanvas');
  drawPortfolioPie(prevCanvas, prevFullPeriod, prevItems, -1, msg('verdiendePremie'));
  drawPortfolioPie(currCanvas, currP, currItems, -1, msg('verdiendePremie'));
  if (prevCanvas) prevCanvas.dataset.tooltipId = 'portfolioPieTooltip';
  if (currCanvas) currCanvas.dataset.tooltipId = 'portfolioPieTooltip';
  attachPortfolioPieHover(prevCanvas);
  attachPortfolioPieHover(currCanvas);
  attachPieLegendHover($('portfolioPiePrevLegend'), prevCanvas, 'portfolioPieTooltip');
  attachPieLegendHover($('portfolioPieCurrLegend'), currCanvas, 'portfolioPieTooltip');
}
function renderPortefeuille(data, prevP, currP) {
  const groups = [
    { main: 'Auto', subs: ['Auto Vloten','Auto Niet Vloten'] },
    { main: 'Particulieren', subs: ['Particulieren Brand','Particulieren BA','Particulieren Overige'] },
    { main: 'Ondernemingen', subs: ['Ondernemingen Brand','Ondernemingen BA','Ondernemingen Overige'] },
    { main: 'Arbeidsongevallen', subs: [] },
    { main: 'Rechtsbijstand', subs: [] }
  ];
  const blocks = groups.flatMap(group => {
    if (viewMode === 'main') return [{ key: group.main, isSub: false }];
    if (viewMode === 'sub') return group.subs.map(key => ({ key, isSub: true }));
    return [{ key: group.main, isSub: false }, ...group.subs.map(key => ({ key, isSub: true }))];
  });
  $('portefeuilleCharts').innerHTML = renderPortfolioBlock(data, 'TOTAAL NON LIFE', prevP, currP, true) + blocks.map(x => renderPortfolioBlock(data, x.key, prevP, currP, false, x.isSub)).join('');
  attachPortfolioBarHover();
  renderPortfolioPies(data, currP);
}

function pieCategoryLabel(canonical) {
  const nlPieLabels = {
    'Particulieren Brand': 'Particulieren brand',
    'Particulieren BA': 'Particulieren BA',
    'Ondernemingen Brand': 'Ondernemingen brand',
    'Ondernemingen BA': 'Ondernemingen BA',
    'Overige': 'Overige'
  };
  const frPieLabels = {
    'Particulieren Brand': 'Particuliers incendie',
    'Particulieren BA': 'Particuliers RC',
    'Ondernemingen Brand': 'Entreprises incendie',
    'Ondernemingen BA': 'Entreprises RC',
    'Overige': 'Autres'
  };
  if (currentLang === 'fr' && frPieLabels[canonical]) return frPieLabels[canonical];
  if (currentLang !== 'fr' && nlPieLabels[canonical]) return nlPieLabels[canonical];
  return displayLabel(canonical) || canonical;
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
  ctx.strokeStyle = '#d6e4f2'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#003b71';
  ctx.font = `900 ${Math.round(18 * fontScale)}px Inter, Segoe UI, Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(mainText || '', cx, cy - 9 * fontScale);
  ctx.font = `800 ${Math.round(18 * fontScale)}px Inter, Segoe UI, Arial`; ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#62748a'; ctx.fillText(subText || '', cx, cy + 13 * fontScale);
}
function getProgressionContributionItems(data, period) {
  const wanted = ['Auto Vloten','Auto Niet Vloten','Particulieren','Ondernemingen Brand','Ondernemingen BA','Arbeidsongevallen','Rechtsbijstand'];
  const sourceRows = rowsOfPeriod(data, 'PRODUCTIE', period);
  const aliases = {
    'Rechtsbijstand': ['Rechtsbijstand', 'Rechtsbijstand Stand Alone', 'Protection Juridique', 'Protection Juridique Stand Alone'],
    'Auto Vloten': ['Auto Vloten', 'Auto Flottes'],
    'Auto Niet Vloten': ['Auto Niet Vloten', 'Auto Non Flottes'],
    'Particulieren': ['Particulieren', 'Particuliers'],
    'Ondernemingen Brand': ['Ondernemingen Brand', 'Entreprises Incendie'],
    'Ondernemingen BA': ['Ondernemingen BA', 'Entreprises BA', 'Entreprises RC'],
    'Arbeidsongevallen': ['Arbeidsongevallen', 'Accidents de Travail']
  };
  const norm = v => String(v || '').trim().toUpperCase();
  return wanted.map(key => {
    const keys = (aliases[key] || [key]).map(norm);
    const row = sourceRows.find(r => keys.includes(norm(r[cols.sub]))) ||
      sourceRows.find(r => keys.includes(norm(r[cols.hoofd])) && keys.includes(norm(r[cols.sub]))) ||
      {};
    return { key, label: pieCategoryLabel(key), value: n(row[cols.progPremie]) };
  }).filter(x => x.value !== 0);
}

function getProductionPieItems(data, period, mode = 'productie') {
  // Taartgrafieken tonen bewust de commerciële takken i.p.v. louter hoofdcategorieën.
  // Particulieren wordt opgesplitst in Brand en BA; de kleinere restcategorieën van
  // Particulieren en Ondernemingen worden samengeteld als één grijze categorie "Overige".
  const wanted = [
    { key: 'Auto Vloten' },
    { key: 'Auto Niet Vloten' },
    { key: 'Particulieren Brand' },
    { key: 'Particulieren BA' },
    { key: 'Ondernemingen Brand' },
    { key: 'Ondernemingen BA' },
    { key: 'Overige', sum: ['Particulieren Overige', 'Ondernemingen Overige'] },
    { key: 'Arbeidsongevallen' },
    { key: 'Rechtsbijstand' }
  ];
  const fieldByMode = { productie: cols.prodPremie, verval: cols.vervalPremie, progressie: cols.progPremie, schade: cols.schadelast };
  const typeByMode = { productie: 'PRODUCTIE', verval: 'PRODUCTIE', progressie: 'PRODUCTIE', schade: 'SCHADE' };
  const field = fieldByMode[mode] || cols.prodPremie;
  const sourceType = typeByMode[mode] || 'PRODUCTIE';
  const aliases = {
    'Rechtsbijstand': ['Rechtsbijstand', 'Rechtsbijstand Stand Alone', 'Protection Juridique', 'Protection Juridique Stand Alone'],
    'Auto Vloten': ['Auto Vloten', 'Auto Flottes'],
    'Auto Niet Vloten': ['Auto Niet Vloten', 'Auto Non Flottes'],
    'Particulieren Brand': ['Particulieren Brand', 'Particuliers Incendie'],
    'Particulieren BA': ['Particulieren BA', 'Particuliers BA', 'Particuliers RC'],
    'Particulieren Overige': ['Particulieren Overige', 'Particuliers Autres'],
    'Ondernemingen Brand': ['Ondernemingen Brand', 'Entreprises Incendie'],
    'Ondernemingen BA': ['Ondernemingen BA', 'Entreprises BA', 'Entreprises RC'],
    'Ondernemingen Overige': ['Ondernemingen Overige', 'Entreprises Autres'],
    'Arbeidsongevallen': ['Arbeidsongevallen', 'Accidents de Travail']
  };
  const norm = v => String(v || '').trim().toUpperCase();
  const findRow = key => {
    const keys = (aliases[key] || [key]).map(norm);
    return keys.flatMap(alias => rowsOfPeriodSub(data, sourceType, period, alias))[0] ||
      keys.flatMap(alias => rowsOfPeriodHeadSub(data, sourceType, period, alias, alias))[0] || {};
  };
  return wanted.map(item => {
    const rows = (item.sum || [item.key]).map(findRow);
    const value = rows.reduce((sum, row) => sum + n(row[field]), 0);
    const result = { key: item.key, label: pieCategoryLabel(item.key), value };
    if (mode === 'schade') {
      const earned = rows.reduce((sum, row) => sum + n(row[cols.verdiend]), 0);
      const schade = rows.reduce((sum, row) => sum + n(row[cols.schadelast]), 0);
      const schadeCap = rows.reduce((sum, row) => sum + n(row[cols.schadeCap]), 0);
      result.isSchade = true;
      result.sp = rows.length === 1 ? n(rows[0][cols.sp]) : (earned ? schade / earned * 100 : 0);
      result.spCap = rows.length === 1 ? n(rows[0][cols.spCap]) : (earned ? schadeCap / earned * 100 : 0);
    }
    return result;
  }).filter(x => x.value > 0);
}

function renderActivePie(data, currP) {
  const active = document.querySelector('.tab.active');
  const mode = active ? active.dataset.tab : 'productie';
  const card = $('productionPieCard');
  if (!card) return;
  if (['productie', 'verval', 'progressie', 'schade'].includes(mode)) {
    card.classList.remove('hidden');
    renderProductionPie(data, currP, mode);
  } else {
    card.classList.add('hidden');
    const tooltip = $('productionPieTooltip');
    if (tooltip) tooltip.style.display = 'none';
  }
}
function pieComparisonTotalLabel(mode) {
  if (mode === 'schade') return currentLang === 'fr' ? 'Charge sinistre totale' : 'Totale schadelast';
  if (mode === 'verval') return currentLang === 'fr' ? 'Chute totale' : 'Totaal verval';
  return currentLang === 'fr' ? 'Production totale' : 'Totale productie';
}
function getPreviousFullYearPeriodForPie(data, currP, mode = 'productie') {
  // Zelfde logica als bij portefeuille: vergelijk de laatste periode van het huidige jaar
  // met het volledige voorgaande jaar (de laatste beschikbare 12/YYYY vóór currP).
  const sourceType = mode === 'schade' ? 'SCHADE' : 'PRODUCTIE';
  const currentKey = pkey(currP);
  const periods = [...new Set(rowsOf(data, sourceType)
    .map(r => String(r[cols.periode] || '').trim())
    .filter(Boolean))]
    .filter(p => String(p).trim().startsWith('12 '))
    .filter(p => !currentKey || pkey(p) < currentKey)
    .sort((a, b) => pkey(a) - pkey(b));
  return periods.length ? periods[periods.length - 1] : (dashboardPreviousPeriod || latestMonthPair(mainRows(data, sourceType))[0]);
}
function pieComparisonPanelTitle(kind, period) {
  if (!period) return '';
  if (kind === 'prevFull') return (currentLang === 'fr' ? 'Année complète précédente · ' : 'Volledig voorgaand jaar · ') + period;
  return (currentLang === 'fr' ? 'Dernière période · ' : 'Laatste periode · ') + period;
}
function ensureProductionPieLayout(mode, prevP, currP) {
  const card = $('productionPieCard');
  if (!card) return;
  const grid = card.querySelector('.productionPieGrid');
  if (!grid) return;
  if (mode === 'progressie') {
    grid.classList.remove('portfolioPieGrid');
    grid.innerHTML = `<div class="pieWrap progressWaterfallDuo"><div class="progressWaterfallPanel"><canvas id="productionPieCanvas" width="980" height="900"></canvas></div></div><div id="productionPieLegend" class="pieLegend"></div>`;
    return;
  }
  grid.classList.add('portfolioPieGrid');
  grid.innerHTML = `<div class="portfolioPiePair productionComparePiePair">
    <div class="portfolioPiePanel"><h3>${esc(pieComparisonPanelTitle('prevFull', prevP))}</h3><div class="productionPieGrid portfolioPieGrid"><div class="pieWrap"><canvas id="productionPiePrevCanvas" width="990" height="645"></canvas><div id="productionPiePrevTotal" class="portfolioPieTotal"></div></div><div id="productionPiePrevLegend" class="pieLegend"></div></div></div>
    <div class="portfolioPiePanel"><h3>${esc(pieComparisonPanelTitle('curr', currP))}</h3><div class="productionPieGrid portfolioPieGrid"><div class="pieWrap"><canvas id="productionPieCurrCanvas" width="990" height="645"></canvas><div id="productionPieCurrTotal" class="portfolioPieTotal"></div></div><div id="productionPieCurrLegend" class="pieLegend"></div></div></div>
  </div><div id="productionPieTooltip" class="pieTooltip portfolioPieTooltip"></div>`;
}
function renderStaticPieLegend(el, items, emptyText) {
  if (!el) return;
  const total = items.reduce((s,x) => s + x.value, 0);
  if (!items.length || !total) { el.innerHTML = `<div class="pieEmpty">${esc(emptyText || '')}</div>`; return; }
  el.innerHTML = items.map((item, i) => {
    const share = item.value / total * 100;
    const color = item.color || pieSegmentColor(item.key, i);
    return `<div class="pieLegendItem" data-pie-index="${i}"><span class="pieSwatch" style="background:${color}"></span><div class="pieLegendName">${esc(item.label)}<span class="pieLegendPct">${pct.format(share)}%</span></div><div class="pieLegendValue">${euro.format(item.value)}</div></div>`;
  }).join('');
}
function renderComparisonPies(data, prevP, currP, mode) {
  const centerTextByMode = { productie: msg('productie'), verval: msg('verval'), schade: msg('schadelast') };
  const emptyKeyByMode = { productie: 'productionPieEmpty', verval: 'vervalPieEmpty', schade: 'schadePieEmpty' };
  const prevItems = getProductionPieItems(data, prevP, mode).map((x,i)=>({ ...x, color: pieSegmentColor(x.key, i) }));
  const currItems = getProductionPieItems(data, currP, mode).map((x,i)=>({ ...x, color: pieSegmentColor(x.key, i) }));
  renderStaticPieLegend($('productionPiePrevLegend'), prevItems, msg(emptyKeyByMode[mode] || 'productionPieEmpty'));
  renderStaticPieLegend($('productionPieCurrLegend'), currItems, msg(emptyKeyByMode[mode] || 'productionPieEmpty'));
  const centerText = centerTextByMode[mode] || msg('productie');
  const prevCanvas = $('productionPiePrevCanvas'), currCanvas = $('productionPieCurrCanvas');
  if (prevCanvas) prevCanvas.dataset.tooltipId = 'productionPieTooltip';
  if (currCanvas) currCanvas.dataset.tooltipId = 'productionPieTooltip';
  drawPortfolioPie(prevCanvas, prevP, prevItems, -1, centerText);
  drawPortfolioPie(currCanvas, currP, currItems, -1, centerText);
  attachPortfolioPieHover(prevCanvas);
  attachPortfolioPieHover(currCanvas);
  attachPieLegendHover($('productionPiePrevLegend'), prevCanvas, 'productionPieTooltip');
  attachPieLegendHover($('productionPieCurrLegend'), currCanvas, 'productionPieTooltip');
  const totalLabel = pieComparisonTotalLabel(mode);
  const prevTotal = prevItems.reduce((sum, x) => sum + x.value, 0);
  const currTotal = currItems.reduce((sum, x) => sum + x.value, 0);
  const prevTotalEl = $('productionPiePrevTotal'), currTotalEl = $('productionPieCurrTotal');
  if (prevTotalEl) prevTotalEl.innerHTML = `${totalLabel}: <b>${euro.format(prevTotal)}</b>`;
  if (currTotalEl) currTotalEl.innerHTML = `${totalLabel}: <b>${euro.format(currTotal)}</b>`;
}
function getProgressWaterfallValues(data, period) {
  const row = totalRow(data, 'PRODUCTIE', period) || {};
  const productie = n(row[cols.prodPremie]);
  const verval = n(row[cols.vervalPremie]);
  const transformatie = n(row[cols.trans]);
  const progressie = productie - verval + transformatie;
  const pdfProgressie = n(row[cols.progPremie]);
  return { productie, verval, transformatie, progressie: pdfProgressie || progressie };
}
function drawProgressWaterfallCanvas(canvas, values, period, prevValues = null, prevPeriod = '', fixedScale = null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
  const makeBars = vals => [
    { key:'productie', label: msg('productie'), value: vals.productie },
    { key:'verval', label: msg('verval'), value: -vals.verval },
    { key:'trans', label: currentLang === 'fr' ? 'Transformation' : 'Transformatie', value: vals.transformatie },
    { key:'progressie', label: msg('progressie'), value: vals.progressie }
  ];
  const bars = makeBars(values);
  const prevBars = prevValues ? makeBars(prevValues) : [];
  const allAmounts = [...bars, ...prevBars].map(s => Math.abs(s.value)).filter(Number.isFinite);
  const maxAbsRaw = Math.max(1, ...allAmounts);
  const niceStep = max => {
    const target = max / 4;
    const pow = Math.pow(10, Math.floor(Math.log10(target)));
    const norm = target / pow;
    const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return mult * pow;
  };
  const step = niceStep(maxAbsRaw);
  const maxAbs = Math.ceil(maxAbsRaw / step) * step;
  const lo = -maxAbs, hi = maxAbs;
  const x0 = 104, x1 = w - 54, y0 = 90, y1 = h - 218;
  const y = v => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
  const axisLabel = value => {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1000000) {
      const v = abs / 1000000;
      return sign + (Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1).replace('.', ',')) + ' Mio';
    }
    if (abs >= 1000) return sign + Math.round(abs / 1000) + 'K';
    return sign + Math.round(abs);
  };
  ctx.strokeStyle = '#d6e4f2'; ctx.lineWidth = 1;
  ctx.font = '850 14px Inter, Segoe UI, Arial'; ctx.fillStyle = '#5f7288'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let v = -maxAbs; v <= maxAbs + step / 2; v += step) {
    const yy = y(v);
    ctx.strokeStyle = v === 0 ? '#003b71' : (Math.abs(v) === maxAbs ? '#d6e4f2' : '#e3edf7');
    ctx.lineWidth = v === 0 ? 2.2 : 1;
    ctx.setLineDash(v === 0 ? [] : [4,7]);
    ctx.beginPath(); ctx.moveTo(x0-6, yy); ctx.lineTo(x1, yy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = v === 0 ? '#003b71' : '#5f7288';
    ctx.font = v === 0 ? '950 14px Inter, Segoe UI, Arial' : '850 14px Inter, Segoe UI, Arial';
    ctx.fillText(axisLabel(v), x0-14, yy);
  }
  const zeroY = y(0);
  const barW = Math.min(116, (x1 - x0) / bars.length * .42);
  const gap = ((x1 - x0) - bars.length * barW) / Math.max(1, bars.length - 1);
  const xs = bars.map((_,i)=>x0+i*(barW+gap));
  const bottomRoundedRect = (x, top, width, height, radius = 7) => {
    const r = Math.min(radius, width / 2, height);
    ctx.beginPath();
    ctx.moveTo(x + r, top);
    ctx.lineTo(x + width - r, top);
    ctx.quadraticCurveTo(x + width, top, x + width, top + r);
    ctx.lineTo(x + width, top + height - r);
    ctx.quadraticCurveTo(x + width, top + height, x + width - r, top + height);
    ctx.lineTo(x + r, top + height);
    ctx.quadraticCurveTo(x, top + height, x, top + height - r);
    ctx.lineTo(x, top + r);
    ctx.quadraticCurveTo(x, top, x + r, top);
    ctx.closePath();
  };

  const drawBar = (s, i, mode) => {
    const top = y(Math.max(0, s.value)), bottom = y(Math.min(0, s.value));
    const bh = Math.max(4, bottom - top);
    const baseX = xs[i];
    if (mode === 'prev') {
      const x = baseX + barW * .07;
      ctx.save();
      ctx.globalAlpha = .48;
      const prevW = Math.min(76, barW * .86);
      ctx.fillStyle = 'rgba(143,180,220,.26)';
      bottomRoundedRect(x + (barW * .86 - prevW) / 2, top, prevW, bh, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#003b71'; ctx.lineWidth = 1.4; ctx.setLineDash([6,4]); bottomRoundedRect(x + (barW * .86 - prevW) / 2, top, prevW, bh, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    const currW = Math.min(68, barW * .76);
    const x = baseX + (barW - currW) / 2;
    const grad = ctx.createLinearGradient(x, top, x, bottom);
    if (s.key === 'verval') { grad.addColorStop(0,'#d85f2a'); grad.addColorStop(.54,'#ff9861'); grad.addColorStop(1,'#ffe2d4'); }
    else if (s.key === 'trans') { grad.addColorStop(0,'#f58220'); grad.addColorStop(.54,'#ffab66'); grad.addColorStop(1,'#ffe0c2'); }
    else if (s.key === 'progressie') { grad.addColorStop(0,'#007e97'); grad.addColorStop(.54,'#41a9bc'); grad.addColorStop(1,'#d9eef4'); }
    else { grad.addColorStop(0,'#003b71'); grad.addColorStop(.54,'#2d84c7'); grad.addColorStop(1,'#9ec0e4'); }
    ctx.fillStyle = grad;
    ctx.save();
    ctx.shadowColor = s.key === 'trans' ? 'rgba(245,130,32,.16)' : 'rgba(0,59,113,.13)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    bottomRoundedRect(x, top, currW, bh, 7); ctx.fill();
    ctx.restore();
    ctx.save();
    bottomRoundedRect(x, top, currW, bh, 7);
    ctx.clip();
    const gloss = ctx.createLinearGradient(x, top, x + currW, top);
    gloss.addColorStop(0, 'rgba(255,255,255,.20)');
    gloss.addColorStop(.38, 'rgba(255,255,255,0)');
    gloss.addColorStop(1, 'rgba(0,59,113,.12)');
    ctx.fillStyle = gloss;
    ctx.fillRect(x, top, currW, bh);
    ctx.restore();
    ctx.strokeStyle = s.key === 'trans' ? 'rgba(245,130,32,.22)' : 'rgba(0,59,113,.16)';
    bottomRoundedRect(x, top, currW, bh, 7); ctx.stroke();
    ctx.fillStyle = '#003b71'; ctx.font = '500 18px Inter, Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const labelVal = s.key === 'verval'
      ? '-' + euro.format(Math.abs(s.value))
      : (s.key === 'productie' || s.key === 'progressie'
          ? (s.value < 0 ? '-' : '') + euro.format(Math.abs(s.value))
          : (s.value > 0 ? '+' : (s.value < 0 ? '-' : '')) + euro.format(Math.abs(s.value)));
    const labelY = s.value >= 0 ? top - 34 : bottom + 38;
    ctx.fillStyle = s.value < 0 ? '#d85f2a' : '#003b71';
    ctx.fillText(labelVal, x + currW/2, labelY);
    if (prevValues) {
      const prevBar = prevBars[i] || { value: 0 };
      const delta = s.value - prevBar.value;
      ctx.font = '500 18px Inter, Segoe UI, Arial';
      ctx.fillStyle = delta > 0 ? '#007e97' : (delta < 0 ? '#d85f2a' : '#5f7288');
      ctx.fillText('(Δ ' + (delta > 0 ? '+' : delta < 0 ? '-' : '') + euro.format(Math.abs(delta)) + ')', x + currW/2, s.value >= 0 ? top - 10 : bottom + 62);
    }
    ctx.fillStyle = '#405775'; ctx.font = '950 18px Inter, Segoe UI, Arial'; ctx.textBaseline = 'top';
    ctx.fillText(s.label, baseX + barW/2, h - 96);
  };
  if (prevBars.length) prevBars.forEach((s,i) => drawBar(s, i, 'prev'));
  bars.forEach((s,i) => drawBar(s, i, 'curr'));

  if (prevPeriod) {
    ctx.font = '850 13px Inter, Segoe UI, Arial'; ctx.fillStyle = '#5f7288'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(currentLang === 'fr' ? 'Pointillé bleu = période précédente' : 'Blauw gestippeld = vorige periode', x1, 18);
  }
}
function renderProgressWaterfall(data, currP, prevP = '') {
  const canvas = $('productionPieCanvas'), legend = $('productionPieLegend');
  const values = getProgressWaterfallValues(data, currP);
  const prevValues = prevP ? getProgressWaterfallValues(data, prevP) : null;
  const scaleVals = [values, prevValues].filter(Boolean).flatMap(v => {
    const p = v.productie, afterVerval = v.productie - v.verval, afterTrans = afterVerval + v.transformatie;
    return [0, p, afterVerval, afterTrans, v.progressie];
  });
  const minV = Math.min(...scaleVals), maxV = Math.max(...scaleVals);
  const pad = Math.max(1, (maxV - minV) * .14);
  const fixedScale = { lo: minV - pad, hi: maxV + pad };
  drawProgressWaterfallCanvas(canvas, values, currP, prevValues, prevP, fixedScale);
  const calc = `${euro.format(values.productie)} − ${euro.format(values.verval)} + ${euro.format(values.transformatie)} = ${euro.format(values.progressie)}`;
  const signedEuro = value => `${value < 0 ? '-' : ''}${euro.format(Math.abs(value))}`;
  const currentItem = (label, color, currDisplay, prevRaw, currRaw, invert=false) => {
    const d = yoy(prevRaw, currRaw);
    const diff = currRaw - prevRaw;
    const c = invert ? cls(-diff) : cls(diff);
    return `<div class="pieLegendItem"><span class="pieSwatch" style="background:${color}"></span><div class="pieLegendName">${esc(label)}<span class="pieLegendPct">${esc(prevP)} → ${esc(currP)} · ${d >= 0 ? '+' : ''}${pct.format(d)}%</span></div><div class="pieLegendValue"><span>${signedEuro(currDisplay)}</span><br><span class="${c}">${diff >= 0 ? '+' : '-'}${euro.format(Math.abs(diff))}</span></div></div>`;
  };
  const periodItem = (label, color, periodLabel, value) => {
    return `<div class="pieLegendItem"><span class="pieSwatch" style="background:${color}"></span><div class="pieLegendName">${esc(label)}<span class="pieLegendPct">${esc(periodLabel)}</span></div><div class="pieLegendValue">${signedEuro(value)}</div></div>`;
  };
  if (legend) legend.innerHTML = `<div class="netProgressBlock"><div class="netProgressHead"><div>${currentLang === 'fr' ? 'Calcul progression' : 'Berekening progressie'} <span>${esc(currP)}</span></div><div class="netProgressValue ${values.progressie >= 0 ? 'pos' : 'neg'}">${euro.format(values.progressie)}</div></div><div class="note" style="margin:0">${calc}</div></div>` +
    (prevValues
      ? currentItem(msg('productie'), '#003b71', values.productie, prevValues.productie, values.productie) +
        currentItem(msg('verval'), '#d85f2a', -values.verval, prevValues.verval, values.verval, true) +
        currentItem(currentLang === 'fr' ? 'Transformation' : 'Transformatie', '#f58220', values.transformatie, prevValues.transformatie, values.transformatie) +
        currentItem(msg('progressie'), '#007e97', values.progressie, prevValues.progressie, values.progressie)
      : periodItem(msg('productie'), '#003b71', currP, values.productie) +
        periodItem(msg('verval'), '#d85f2a', currP, -values.verval) +
        periodItem(currentLang === 'fr' ? 'Transformation' : 'Transformatie', '#f58220', currP, values.transformatie) +
        periodItem(msg('progressie'), '#007e97', currP, values.progressie)) +
    (prevValues ? `<div class="contributionGroupTitle">${currentLang === 'fr' ? 'Période précédente' : 'Vorige periode'}</div>` +
      periodItem(msg('productie'), '#8fb4dc', prevP, prevValues.productie) +
      periodItem(msg('verval'), '#8fb4dc', prevP, -prevValues.verval) +
      periodItem(currentLang === 'fr' ? 'Transformation' : 'Transformatie', '#8fb4dc', prevP, prevValues.transformatie) +
      periodItem(msg('progressie'), '#8fb4dc', prevP, prevValues.progressie) : '');
}
function renderProductionPie(data, currP, mode = 'productie') {
  const titleKeyByMode = { productie: 'productionPieTitle', verval: 'vervalPieTitle', progressie: 'progressiePieTitle', schade: 'schadePieTitle' };
  const subKeyByMode = { productie: 'productionPieSub', verval: 'vervalPieSub', progressie: 'progressiePieSub', schade: 'schadePieSub' };
  const prevP = mode === 'progressie'
    ? (dashboardPreviousPeriod || latestMonthPair(mainRows(data, 'PRODUCTIE'))[0])
    : getPreviousFullYearPeriodForPie(data, currP, mode);
  setText('productionPieTitle', mode === 'progressie' ? (currentLang === 'fr' ? 'Waterfall progression' : 'Waterfall progressie') : msg(titleKeyByMode[mode] || 'productionPieTitle'));
  setText('productionPieSub', mode === 'progressie' ? (currentLang === 'fr' ? 'Production − chute + transformation = progression.' : 'Productie − verval + transformatie = progressie.') : '');
  const card = $('productionPieCard');
  if (card) card.classList.toggle('progressContributionCard', mode === 'progressie');
  ensureProductionPieLayout(mode, prevP, currP);
  if (mode === 'progressie') renderProgressWaterfall(data, currP, prevP);
  else renderComparisonPies(data, prevP, currP, mode);
}

function renderDetails(data, prodCats, schadeCats, prevP, currP) {
  const prodRows = rowsOf(data, 'PRODUCTIE').filter(r => [prevP, currP].includes(r[cols.periode]));
  const schadeRows = rowsOf(data, 'SCHADE').filter(r => [prevP, currP].includes(r[cols.periode]));
  const prodHtml = prodCats.map(cat => renderProdCat(cat, prodRows, prevP, currP)).join('');
  const schadeHtml = schadeCats.map(cat => renderSchadeCat(cat, schadeRows, prevP, currP)).join('');
  $('categoryDetails').innerHTML = [
      `<div id="detailProductieBlock" class="detailSectionBlock productionDetail">`,
      `<div class="detailSectionTitleRow"><h3 class="detailSectionTitle"><span class="detailSectionIcon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></span>${msg('detailProductie')}</h3><div class="blockExportActions" data-export-target="detailProductie" aria-label="Detail productie exporteren"><button type="button" class="blockExportBtn blockExportDownload" title="Download detail productie als PNG"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button><button type="button" class="blockExportBtn blockExportCopy" title="${currentLang === 'fr' ? 'Copier détail production comme image' : 'Kopiëren detail productie als afbeelding'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span style="font-size:11px;font-weight:950;padding-left:4px">${exportCopyLabel()}</span></button></div></div>`,
      prodHtml,
    `</div>`,
      `<div id="detailSchadeBlock" class="detailSectionBlock schadeDetail">`,
      `<div class="detailSectionTitleRow"><h3 class="detailSectionTitle"><span class="detailSectionIcon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>${msg('detailSchade')}</h3><div class="blockExportActions" data-export-target="detailSchade" aria-label="Detail schade exporteren"><button type="button" class="blockExportBtn blockExportDownload" title="Download detail schade als PNG"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button><button type="button" class="blockExportBtn blockExportCopy" title="${currentLang === 'fr' ? 'Copier détail sinistres comme image' : 'Kopiëren detail schade als afbeelding'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span style="font-size:11px;font-weight:950;padding-left:4px">${exportCopyLabel()}</span></button></div></div>`,
      schadeHtml || `<div class="note">${msg('noSchade')}</div>`,
    `</div>`
  ].join('');
}

// ─── Hulpfuncties voor detail-categorieblokken ────────────────────────────────
function catPillHtml(s, cat) {
  return categoryRowLabelHtml(s, cat);
}
function metricBlock(label, valueHtml) {
  return `<div class="metric"><b>${label}</b><span class="metric-val">${valueHtml}</span></div>`;
}
function catContainer(cat, headRight, bodyHtml) {
  return [
    `<div class="cat" data-category-key="${esc(cat)}">`,
      `<div class="catHead exportableBlockHeader">`,
        `<div class="catTitle">${catTitleHtml(cat)}</div>`,
        `<div class="small">${headRight}</div>`,
        productBlockExportActionsHtml(),
      `</div>`,
      `<div class="p-18">${bodyHtml}</div>`,
    `</div>`
  ].join('');
}

function renderProdCat(cat, rows, prevP, currP) {
  const catRows = rows.filter(r => r[cols.hoofd] === cat);
  const subs = [...new Set(catRows.map(r => r[cols.sub]))];
  const head = catRows.find(r => r[cols.sub] === cat && r[cols.periode] === currP) || {};

  const summary = [
    metricBlock(msg('productie'),   euro.format(n(head[cols.prodPremie]))),
    metricBlock(msg('verval'),      euro.format(n(head[cols.vervalPremie]))),
    metricBlock(msg('progressie'),  `<span class="${cls(n(head[cols.progPremie]))}">${euro.format(n(head[cols.progPremie]))}</span>`)
  ].join('');

  const thead = `<tr>
    <th>${msg('categorie')}</th>
    <th>PROD ${prevP}</th><th>PROD ${currP}</th><th>Δ PROD</th>
    <th>${msg('verval')} ${prevP}</th><th>${msg('verval')} ${currP}</th><th>Δ ${msg('verval')}</th>
    <th>PROGR ${prevP}</th><th>PROGR ${currP}</th><th>Δ PROGR</th>
  </tr>`;

  const tbody = subs.map(s => {
    const a = catRows.find(r => r[cols.sub] === s && r[cols.periode] === prevP) || {};
    const b = catRows.find(r => r[cols.sub] === s && r[cols.periode] === currP) || {};
    const dProd   = yoy(n(a[cols.prodPremie]),   n(b[cols.prodPremie]));
    const dVerval = yoy(n(a[cols.vervalPremie]), n(b[cols.vervalPremie]));
    const dProg   = yoy(n(a[cols.progPremie]),   n(b[cols.progPremie]));
    const pr      = n(b[cols.progPremie]);
    return `<tr>
      <td>${catPillHtml(s, cat)}</td>
      <td>${euro.format(n(a[cols.prodPremie]))}</td>
      <td>${euro.format(n(b[cols.prodPremie]))}</td>
      <td>${pctText(dProd)}</td>
      <td>${euro.format(n(a[cols.vervalPremie]))}</td>
      <td>${euro.format(n(b[cols.vervalPremie]))}</td>
      <td>${pctText(dVerval, true)}</td>
      <td>${euro.format(n(a[cols.progPremie]))}</td>
      <td class="${cls(pr)}">${euro.format(pr)}</td>
      <td>${pctText(dProg)}</td>
    </tr>`;
  }).join('');

  const body = [
    `<div class="split">${summary}</div>`,
    `<table class="summary-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`
  ].join('');

  return catContainer(cat, `${prevP} → ${currP}`, body);
}

function spCompareCell(prevValue, currValue) {
  return `<span class="spCompare"><span class="spPrev">${pct.format(prevValue)}%</span><span class="spArrow">&gt;</span><span class="spCurr">${pct.format(currValue)}%</span></span>`;
}

function renderSchadeCat(cat, rows, prevP, currP) {
  const catRows = rows.filter(r => r[cols.hoofd] === cat);
  const subs = [...new Set(catRows.map(r => r[cols.sub]))];
  const head = catRows.find(r => r[cols.sub] === cat && r[cols.periode] === currP) || {};

  const headSpThreshold = spThresholdForLabel(cat, cat);
  const summary = [
    metricBlock(msg('schadelast'), euro.format(n(head[cols.schadelast]))),
    metricBlock('S/P',             `<span class="${spValueClass(n(head[cols.sp]), headSpThreshold, cat)}">${pct.format(n(head[cols.sp]))}%</span>`),
    metricBlock(msg('spAfgetopt'), `<span class="${spValueClass(n(head[cols.spCap]), headSpThreshold, cat)}">${pct.format(n(head[cols.spCap]))}%</span>`)
  ].join('');

  const thead = `<tr>
    <th>${msg('categorie')}</th>
    <th>${msg('schadelast')} ${prevP}</th><th>${msg('schadelast')} ${currP}</th><th>Δ ${msg('schadelast')}</th>
    <th>S/P ${prevP} &gt; ${currP}</th><th>${msg('spAftop')} ${prevP} &gt; ${currP}</th>
  </tr>`;

  const tbody = subs.map(s => {
    const a = catRows.find(r => r[cols.sub] === s && r[cols.periode] === prevP) || {};
    const b = catRows.find(r => r[cols.sub] === s && r[cols.periode] === currP) || {};
    const d = yoy(n(a[cols.schadelast]), n(b[cols.schadelast]));
    return `<tr>
      <td>${catPillHtml(s, cat)}</td>
      <td>${euro.format(n(a[cols.schadelast]))}</td>
      <td>${euro.format(n(b[cols.schadelast]))}</td>
      <td>${pctText(d, true)}</td>
      <td class="${spValueClass(n(b[cols.sp]), spThresholdForLabel(s, cat), s)}">${spCompareCell(n(a[cols.sp]), n(b[cols.sp]))}</td>
      <td class="${spValueClass(n(b[cols.spCap]), spThresholdForLabel(s, cat), s)}">${spCompareCell(n(a[cols.spCap]), n(b[cols.spCap]))}</td>
    </tr>`;
  }).join('');

  const body = [
    `<div class="split">${summary}</div>`,
    `<table class="summary-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`
  ].join('');

  return catContainer(cat, `${prevP} → ${currP}`, body);
}

/* === Selectieve UI helpers: drag feedback === */
(function(){
  function initSelectiveUi(){
    var zone=document.querySelector('.upload-zone');
    var input=document.getElementById('pdfFile');
    if(zone && input && !zone.dataset.dragEnhanced){
      zone.dataset.dragEnhanced='1';
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
        var isPdf=file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
        if(!isPdf){
          setStatus(currentLang === 'fr' ? 'Veuillez sélectionner un fichier PDF.' : 'Selecteer een PDF-bestand.',true);
          return;
        }
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
