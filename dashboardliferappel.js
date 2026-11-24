(function (root) {
  'use strict';
  const TYPES = ['NZ', 'VH', 'KP', 'NK'];
  function number(value, row, column, optional = false) {
    if (value === '' || value == null) {
      if (optional) return null;
      throw new Error(`Rij ${row}, kolom ${column}: ontbrekend getal.`);
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    let text = String(value).trim().replace(/[\s\u00a0€%]/g, '');
    if (/^\(.*\)$/.test(text)) text = '-' + text.slice(1, -1);
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(Number(text))) {
      throw new Error(`Rij ${row}, kolom ${column}: ongeldig getal.`);
    }
    return Number(text);
  }
  function isSingleGroupHeader(row) {
    return row.length>=13 && (/maand|mois|month/i.test(String(row[3]||'')) || /prod/i.test(String(row[11]||'')));
  }
  function parseGrid(grid) {
    const header = grid.findIndex(row => /pol/i.test(String(row[0] || '')) && /type/i.test(String(row[2] || '')));
    if (header < 0 || grid[header].length < 11) throw new Error('Kolomkoppen niet gevonden. Gebruik het Life-detailrapport met kolommen A–K of A–M.');
    const singleGroup=isSingleGroupHeader(grid[header]);
    const cols=singleGroup?{unweighted:7,weighted:8,rate:9,commission:10,producer:11,product:12}:{unweighted:4,weighted:5,rate:6,commission:7,producer:9,product:10};
    const producerTypeColumn = grid[header].findIndex(value => /type.*(?:producent|producteur)/i.test(String(value || '')));
    const exactGroupColumn = grid[header].findIndex(value => /^(?:groep|groupe|group)$/i.test(String(value || '').trim()));
    const taxColumn = exactGroupColumn >= 0 ? exactGroupColumn : producerTypeColumn >= 0 ? producerTypeColumn : cols.product;
    const records = [];
    for (let i = header + 1; i < grid.length; i++) {
      const r = grid[i];
      if (!r.some(v => v != null && String(v).trim() !== '')) continue;
      const text = j => String(r[j] == null ? '' : r[j]).trim();
      if (/^(?:totaal|total|grand total)$/i.test(text(0)) && !text(2)) continue;
      if (!text(0) || !text(2) || (!singleGroup&&!text(8)) || !text(cols.product)) throw new Error(`Rij ${i + 1}: polisnummer, productietype, ${singleGroup?'':'groep of '}product ontbreekt.`);
      const group = singleGroup?null:text(8).match(/^(\S+)(?:\s+([\s\S]*))?$/);
      const read=(key,optional=false)=>number(r[cols[key]],i+1,String.fromCharCode(65+cols[key]),optional);
      records.push({policy: text(0), client: text(1), type: text(2).toUpperCase(),
        capital: singleGroup?null:number(r[3], i + 1, 'D', true),productionMonth:singleGroup?text(3):'',sourceLayout:singleGroup?'single-group':'groups',
        unweighted: Math.round(read('unweighted') * 100),
        weighted: Math.round(read('weighted') * 100),
        rate: read('rate',true),
        rappelRate: read('rate',true),
        commission: Math.round(read('commission') * 100),
        taxGroup: text(taxColumn >= 0 ? taxColumn : singleGroup ? -1 : 8),
        groupId: group?.[1]||'', groupName: group?.[2]||'', producer: text(cols.producer), product: text(cols.product), sourceRow: i + 1});
    }
    if (!records.length) throw new Error('Het bestand bevat geen productieregels.');
    return records;
  }
  function totals(records) {
    return records.reduce((t, r) => ({count: t.count + 1, unweighted: t.unweighted + r.unweighted,
      weighted: t.weighted + r.weighted, commission: t.commission + r.commission}),
    {count: 0, unweighted: 0, weighted: 0, commission: 0});
  }
  function groupBy(records, key) {
    const groups = new Map();
    records.forEach(r => { const k = r[key]; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    return [...groups].map(([id, rows]) => ({id, rows, ...totals(rows)}));
  }
  function share(value, total) { return total === 0 ? null : value / total * 100; }
  function rappelRates(records) {
    return [...new Set(records.map(r=>r.rappelRate).filter(rate=>Number.isFinite(rate)))].sort((a,b)=>a-b);
  }
  function averageRappelRate(records) {
    const rates=records.map(r=>r.rappelRate).filter(rate=>Number.isFinite(rate));
    return rates.length ? rates.reduce((sum,rate)=>sum+rate,0)/rates.length : null;
  }
  function isNonFiscal(record) {
    return /\bNIET\b/i.test(record.taxGroup ?? `${record.groupId || ''} ${record.groupName || ''}`);
  }
  function fiscalTotals(records) {
    const fiscal = records.filter(record => !isNonFiscal(record));
    const nonFiscal = records.filter(isNonFiscal);
    return { fiscal, nonFiscal, fiscalTotal: totals(fiscal), nonFiscalTotal: totals(nonFiscal) };
  }
  const api = {TYPES, number, parseGrid, totals, groupBy, share,isSingleGroupHeader,rappelRates,averageRappelRate,isNonFiscal,fiscalTotals};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LifeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* Dashboard interface */
/* Browser-local Life dashboard. Amounts are aggregated in integer euro cents. */
'use strict';
const C = typeof module !== 'undefined' && module.exports ? module.exports : LifeCore;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const words = {
  title:['RAPPELCIJFERS LIFE','CHIFFRES DE RAPPEL VIE'],
  lead:['Importeer je Excel-detailrapport <strong>Detail rappel sparen</strong> (onder "Reporting") uit SalesForce (op koepelniveau) of <strong>Detail rappel J Groepsnr Sparen</strong> (onder "Reporting") uit Salesforce (op groepsniveau). Denk er wel aan om bij export (te vinden rechtsboven onder "bewerken") te kiezen voor "Alleen details". Bekijk productie, premies en de bijdrage van elke groep, voor NZ, VH, KP en NK.','Importez votre rapport Excel détaillé <strong>Detail rappel sparen</strong> (sous « Reporting ») depuis SalesForce (au niveau de la coupole) ou <strong>Detail rappel J Groepsnr Sparen</strong> (sous « Reporting ») depuis Salesforce (au niveau du groupe). Lors de l’export (en haut à droite, sous « Modifier »), veillez à choisir « Détails uniquement ». Analysez la production, les primes et la contribution de chaque groupe pour NZ, VH, KP et NK.'],
  benefit1:['Automatische analyse','Analyse automatique'],benefit2:['Direct vergelijkbaar','Comparaison directe'],benefit3:['Veilig','Sécurisé'],eyebrow:['Cijfers life','Chiffres clés vie'],
  upload:['Sleep je Excel hierheen','Déposez votre Excel ici'],uploadHint:['of klik om één .xls- of .xlsx-bestand te kiezen','ou cliquez pour choisir un fichier .xls ou .xlsx'],
  pick:['Importeer Excel','Importer Excel'],ready:['Klaar om je Life-rapport te verwerken','Prêt à analyser votre rapport Vie'],empty:['Importeer een Excel-bestand om het dashboard te openen.','Importez un fichier Excel pour ouvrir le tableau de bord.'],
  preview:['Import controleren','Vérifier l’import'],commit:['Import bevestigen','Confirmer l’import'],cancel:['Annuleren','Annuler'],sheet:['Werkblad','Feuille'],source:['Excel import & controle','Import Excel et contrôle'],importAction:['Importeer','Importer'],importOk:['Importcontrole OK','Contrôle d’import OK'],
  csv:['Download CSV','Télécharger CSV'],pdf:['Exporteer PDF','Exporter PDF'],pdfSections:['PDF-secties','Sections PDF'],allSelect:['Alles selecteren','Tout sélectionner'],noneSelect:['Niets selecteren','Tout désélectionner'],print:['Print naar PDF','Imprimer en PDF'],
  dashboardView:['Dashboardweergave','Vue du tableau de bord'],
  summary:['Samenvatting','Résumé'],groups:['Verdelingen','Répartitions'],detail:['Detail','Détail'],
  count:['Aantal productieregels','Nombre de lignes de production'],shortCount:['Aantal','Nombre'],unweighted:['Premie voor weging','Prime avant pondération'],weighted:['Premie na weging','Prime après pondération'],commission:['Rappelcommissie','Commission de rappel'],policies:['Aantal unieke polissen','Nombre de polices distinctes'],rappelRate:['Rappelpercentage','Pourcentage de rappel'],
  fiscalStatus:['Fiscaal / niet-fiscaal','Fiscal / non fiscal'],fiscal:['Fiscaal','Fiscal'],nonFiscal:['Niet-fiscaal','Non fiscal'],
  productionPie:['Verdeling premie per type productie','Répartition des primes par type de production'],commissionPie:['Verdeling rappelcommissie per type','Répartition des commissions de rappel par type'],
  all:['Alle','Tous'],group:['Groep','Groupe'],type:['Type productie','Type de production'],product:['Product','Produit'],producer:['Producentnummer','Numéro de producteur'],search:['Zoek polis of klant','Rechercher police ou client'],reset:['Filters wissen','Effacer les filtres'],
  NZ:['Nieuwe zaken','Affaires nouvelles'],VH:['Verhogingen','Augmentations'],KP:['Koopsom','Prime unique'],KO:['Koopsom','Prime unique'],NK:['Nieuwe koopsom','Nouvelle prime unique'],selected:['geselecteerd','sélectionnés'],
  total:['Totaal Life','Total Vie'],byType:['Productie per type','Production par type'],share:['Aandeel','Part'],countShare:['Aandeel aantal','Part du nombre'],unweightedShare:['Aandeel tov totale premie','Part de la prime totale'],weightedShare:['Aandeel premie na weging','Part prime après pondération'],
  commissionShare:['Aandeel tov totale rappelcommissie','Part de la commission de rappel totale'],
  averageRappel:['Gemiddelde rappel','Rappel moyen'],
  premiumShareLabel:['Aandeel tov totale premie','Part de la prime totale'],
  commissionPieNote:['Taartdelen: verdeling rappelcommissie. Percentages: gemiddelde rappel (rappelcommissie / premie vóór weging).','Secteurs : répartition des commissions de rappel. Pourcentages : rappel moyen (commission de rappel / prime avant pondération).'],
  recordNote:['Aantallen = productieregels; meerdere regels per polis blijven behouden.','Nombre = lignes de production ; les lignes multiples d’une police sont conservées.'],
  scope:['',''],allGroups:['Alle groepen samen','Tous les groupes réunis'],basis:['Maatstaf','Mesure'],groupShare:['Aandeel per groep','Part par groupe'],countByType:['Aantal per type','Nombre par type'],
  pieNote:['Aandeel per groep binnen dit productietype. Alle groepen staan afzonderlijk in de legenda.','Part de chaque groupe au sein de ce type de production. Tous les groupes figurent séparément dans la légende.'],
  noData:['Geen productieregels voor deze selectie.','Aucune ligne de production pour cette sélection.'],noPie:['Geen taartgrafiek: het totaal is nul of er zijn negatieve waarden. De bedragen blijven zichtbaar in de tabel.','Pas de diagramme circulaire : total nul ou valeurs négatives. Les montants restent visibles dans le tableau.'],
  copy:['Kopieer','Copier'],download:['PNG','PNG'],copied:['Afbeelding gekopieerd.','Image copiée.'],savedInstead:['Kopiëren wordt niet ondersteund of werd geweigerd. De afbeelding is gedownload.','Copie non disponible ou refusée. L’image a été téléchargée.'],
  policy:['Polisnummer','Numéro de police'],productionMonth:['Maand productie','Mois de production'],fileTotal:['Bestandstotaal','Total du fichier'],client:['Klantnaam','Nom du client'],rate:['Rappel %','Rappel %'],groupNo:['Groepsnummer','Numéro de groupe'],groupName:['Groepsnaam','Nom du groupe'],prev:['Vorige','Précédent'],next:['Volgende','Suivant'],
  loading:['Excel wordt gelezen…','Lecture de l’Excel…'],loaded:['Import voltooid','Import terminé'],single:['Kies één Excel-bestand. Vergelijking met vorig jaar volgt later.','Choisissez un seul fichier Excel. La comparaison avec l’année précédente sera ajoutée ultérieurement.'],
  footer:['Ontwikkeld door Hans von der Crone - data wordt niet online bewaard','Ontwikkeld door Hans von der Crone - data wordt niet online bewaard'],
  release:['Eerste Life-versie: Excel-import met controle, filters, KPI’s, groepsverdelingen, CSV-, PNG- en PDF-export.','Première version Vie : import Excel avec contrôle, filtres, KPI, répartitions par groupe, exports CSV, PNG et PDF.'],
  noSections:['Selecteer minstens één sectie.','Sélectionnez au moins une section.'],busy:['Export wordt gemaakt…','Création de l’export…'],percentNote:['Percentages gebruiken het gefilterde totaal als basis; bij een nultotaal wordt — getoond.','Les pourcentages utilisent le total filtré ; un total nul est affiché par —.'],
  groupMatrix:['Groepsbijdrage per productietype','Contribution par groupe et type de production'],unknown:['Extra productiecodes blijven afzonderlijk opgenomen','Les codes de production supplémentaires restent distincts'],
  filterTotal:['van alle ingelezen productieregels','de toutes les lignes importées'],groupTotal:['Groepstotalen','Totaux par groupe'],productTotal:['Producttotalen','Totaux par produit'],selectKpis:['Toon KPI’s','Afficher les KPI'],
};
let lang = 'nl';
const t = key => words[key]?.[lang === 'fr' ? 1 : 0] ?? key;
const fmt = n => new Intl.NumberFormat(lang === 'fr' ? 'fr-BE' : 'nl-BE').format(n);
const money = cents => new Intl.NumberFormat(lang === 'fr' ? 'fr-BE' : 'nl-BE', {style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.trunc(cents / 100));
const pct = n => n == null ? '—' : new Intl.NumberFormat(lang === 'fr' ? 'fr-BE' : 'nl-BE',{maximumFractionDigits:2,minimumFractionDigits:1}).format(n) + '%';
const colors = ['#0d1473','#ff934c','#007e97','#8064a2','#437bb4','#b65f40','#418d69','#be6a92','#717e2a','#377d91','#a06d18','#6956a3','#4b6c45','#b04c60','#6876bd','#aa7a49','#357e72','#8e6382','#667a8c','#a65e1f'];
const state = {records:[],pending:null,workbook:null,source:'',sheet:'',tab:'summary',metric:'unweighted',headlineView:'compact',page:0,
  filters:{groupId:'',policy:'',type:'',product:'',producer:'',search:''},groupProducts:[],groupProductionTypes:[],detailProducts:[],detailProductionTypes:[],detailFiscal:[],chartModes:{unweighted:'bar',commission:'bar'},
  sorts:{summary:{key:null,direction:'asc'},groups:{key:'unweighted',direction:'desc'},detail:{key:'policy',direction:'asc'}}};
const sections = ['summary','groups','detail'];
function singleGroupFile(){return state.records[0]?.sourceLayout==='single-group';}
function visibleSections(){return sections.filter(id=>id!=='groups'||!singleGroupFile()||new Set(state.records.map(r=>r.producer).filter(Boolean)).size>1);}
const visibleFields = keys => keys.filter(key => !['weighted','weightedShare'].includes(key)&&(!singleGroupFile()||!['groupNo','groupName'].includes(key)));
function detailColumns(){return visibleFields(['policy','client','type',...(singleGroupFile()?['productionMonth']:[]),'unweighted','weighted','rate','commission','groupNo','groupName','producer','product']);}
function types() { return [...C.TYPES, ...new Set(state.records.map(r => r.type).filter(x => !C.TYPES.includes(x)))]; }
function typeLabel(code) { return [...C.TYPES,'KO'].includes(code) ? t(code) : code; }
const selections=value=>Array.isArray(value)?value:value?[value]:[];
function message(text, warning = false) {
  ['notice','introStatus'].forEach(id=>{$(id).textContent=text;$(id).classList.toggle('warn',warning);});
  $('notice').classList.toggle('hidden',(!state.records.length&&!state.pending)||(state.records.length>0&&text.startsWith(t('loaded'))));
}
function selected() {
  const f = state.filters, q = f.search.toLocaleLowerCase();
  if(singleGroupFile()&&state.tab==='groups')return state.records.filter(r=>!selections(f.producer).length||selections(f.producer).includes(r.producer));
  return state.records.filter(r => (!selections(f.groupId).length || selections(f.groupId).includes(r.groupId)) && (!selections(f.policy).length||selections(f.policy).includes(r.policy)) && (!f.type || r.type === f.type) &&
    (!f.product || r.product === f.product) && (!selections(f.producer).length || selections(f.producer).includes(r.producer)) &&
    (!q || `${r.policy} ${r.client}`.toLocaleLowerCase().includes(q)));
}
function scope() {
  const f = state.filters;
  const group = selections(f.groupId).length ? selections(f.groupId).map(groupLabel).join(', ') : t('allGroups');
  return [group,f.type && typeLabel(f.type),f.product,f.producer && `${t('producer')} ${f.producer}`,f.search && `“${f.search}”`].filter(Boolean).join(' · ');
}
function groupLabel(id) { const r = state.records.find(r => r.groupId === id); return `${id}${r?.groupName ? ' · ' + r.groupName : ''}`; }
function groupCodeWidth() { return Math.max(1,...state.records.map(r=>r.groupId.length)); }
function groupOptionLabel(id) {
  const group=state.records.find(r=>r.groupId===id);
  return id.padEnd(groupCodeWidth(),'\u00a0')+(group?.groupName?'  '+group.groupName:'');
}
function groupMarkup(id) {
  if(singleGroupFile())return `<span>${esc(t('fileTotal'))}</span>`;
  const group=state.records.find(r=>r.groupId===id);
  return `<span class="life-group-label" style="--group-code-width:${groupCodeWidth()}"><span class="life-group-code">${esc(id)}</span><span class="life-group-name">${esc(group?.groupName||'')}</span></span>`;
}
function scopeHtml() { return ''; }
function actions(id) {
  const svg = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  if(id==='detail-table'||id==='groups-table')return `<div class="life-export blockExportActions" data-html2canvas-ignore><button type="button" class="blockExportBtn life-excel-export" data-excel="${id==='groups-table'?'groups':'detail'}" aria-label="Export naar Excel" title="Export naar Excel">${svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m8 12 6 6m0-6-6 6M17 12h1m-1 3h1m-1 3h1"/>')}</button><button type="button" class="blockExportBtn blockExportCopy" data-copy="${id}" aria-label="Copy naar geheugen" title="Copy naar geheugen">${svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>')}</button></div>`;
  return `<div class="life-export blockExportActions" data-html2canvas-ignore><button type="button" class="blockExportBtn blockExportDownload" data-png="${id}" aria-label="${esc(t('download'))}" title="${esc(t('download'))}">${svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')}</button><button type="button" class="blockExportBtn blockExportCopy" data-copy="${id}" aria-label="${esc(t('copy'))}" title="${esc(t('copy'))}">${svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>')}</button></div>`;
}
function head(title,id,level='h2',controls='') {
  const groups=selections(state.filters.groupId);
  if (title === t('total') && groups.length) {
    title += ' '+groups.map(id=>{const group=state.records.find(r=>r.groupId===id);return id+(group?.groupName?' - '+group.groupName:'');}).join(' / ');
  }
  return `<div class="life-section-head"><${level}>${esc(title)}</${level}>${controls}${actions(id)}</div>${scopeHtml()}`;
}
function card(id,title,html,controls='') { return `<article class="card exportable" id="${id}">${head(title,id,'h2',controls)}${html}</article>`; }
function percent(value,total) { return pct(C.share(value,total)); }
function rappelAmountKpi(rows, key, fiscal = '') {
  const totals = C.totals(rows);
  const total = totals[key];
  const isCommission = key === 'commission';
  const averageLabel = lang === 'fr' ? 'rappel moy.' : 'gem.rappel';
  const formula = lang === 'fr' ? 'Commission de rappel / prime avant pondération' : 'Rappelcommissie / premie voor weging';
  const suffix = fiscal === 'fiscal' ? (lang === 'fr' ? 'FISCAL' : 'FISCAAL') : fiscal === 'nonFiscal' ? (lang === 'fr' ? 'NON FISCAL' : 'NIET-FISCAAL') : '';
  const contributions = types().map((code, i) => {
    const subtotal = C.totals(rows.filter(row => row.type === code));
    const amount = subtotal[key];
    const share = C.share(amount, isCommission ? subtotal.unweighted : total);
    if (isCommission) {
      const label = `${typeLabel(code)}: ${money(amount)} / ${averageLabel} ${pct(share)} (${formula})`;
      return `<div class="life-kpi-contribution" title="${esc(label)}"><div class="rappel-commission-detail"><div class="rappel-commission-line"><span class="rappel-commission-type"><i style="background:${colors[i % colors.length]}"></i>${esc(typeLabel(code))}</span><span class="rappel-commission-amount">${money(amount)}</span><span class="rappel-commission-average">${pct(share)}</span></div></div></div>`;
    }
    const label = `${typeLabel(code)}: ${money(amount)} (${pct(share)})`;
    return `<div class="life-kpi-contribution" title="${esc(label)}"><div class="life-kpi-contribution-label"><span><i style="background:${colors[i % colors.length]}"></i>${esc(typeLabel(code))}</span><span class="rappel-premium-amount">${money(amount)}</span><span class="rappel-premium-share">${pct(share)}</span></div></div>`;
  }).join('');
  const heading = `<div class="label rappel-commission-head"><span>${t(key).replace('Rappelcommissie','Rappel&shy;commissie')}${suffix ? `<br>${suffix}` : ''}</span><span>${isCommission ? t('averageRappel') : t('share')}</span></div>`;
  const rate = isCommission ? C.share(total, totals.unweighted) : C.share(total, total);
  const value = `<div class="value rappel-commission-total"><span class="rappel-commission-amount">${money(total)}</span><span class="rappel-commission-average"${isCommission ? ` title="${formula}"` : ''}>${pct(rate)}</span></div>`;
  return `<div class="kpi rappel-commission-kpi${fiscal ? ' rappel-component summaryComponentKpi' : ' rappel-total summaryTotalKpi'}" data-rappel-kpi="${key}-${fiscal || 'total'}"${fiscal ? ` data-equation="${fiscal === 'fiscal' ? '=' : '+'}"` : ''}>${heading}${value}<div class="life-kpi-contributions">${contributions}</div></div>`;
}
function metrics(total, rows) {
  const { fiscal, nonFiscal } = C.fiscalTotals(rows);
  const row = key => `<div class="life-kpis life-headline-kpis rappel-equation-row" style="--headline-kpi-rows:${types().length + 2}">${rappelAmountKpi(rows, key)}${rappelAmountKpi(fiscal, key, 'fiscal')}${rappelAmountKpi(nonFiscal, key, 'nonFiscal')}</div>`;
  const compact = state.headlineView === 'compact';
  const label = lang === 'fr' ? 'Vue des indicateurs' : 'KPI-weergave';
  const choices = [['compact',"KPI’s"],['overview',lang === 'fr' ? 'Tableau' : 'Tabel']];
  const switcher = `<div class="rappel-view-switch" data-html2canvas-ignore><div role="group" aria-label="${label}">${choices.map(([id,title])=>`<button type="button" data-kpi-view="${id}" aria-pressed="${state.headlineView === id}" aria-controls="rappelKpi${id}">${title}</button>`).join('')}</div></div>`;
  return `${switcher}<div id="rappelKpicompact" class="rappel-kpi-pane rappel-compact-mode"${compact?'':' hidden'}><div class="life-kpis rappel-headline-rows">${row('unweighted')}${row('commission')}</div></div><div id="rappelKpioverview" class="rappel-kpi-pane"${compact?' hidden':''}>${rappelOverview(rows)}</div>`;
}
function rappelOverview(rows) {
  const split = C.fiscalTotals(rows);
  const scopes = [{id:'all',label:lang==='fr'?'Toute la production':'Alle productie',suffix:'',rows},
    {id:'fiscal',label:t('fiscal'),suffix:t('fiscal'),rows:split.fiscal},
    {id:'nonFiscal',label:t('nonFiscal'),suffix:t('nonFiscal'),rows:split.nonFiscal}];
  const average = lang === 'fr' ? 'Rappel moyen' : 'Gemiddelde rappel';
  const formula = lang === 'fr' ? 'Commission de rappel / prime avant pondération' : 'Rappelcommissie / premie voor weging';
  const cards = scopes.map(scope=>{
    const total = C.totals(scope.rows);
    const suffix = scope.suffix ? `<br>${esc(scope.suffix)}` : '';
    return `<section class="kpi rappel-overview-card ${scope.id==='all'?'summaryTotalKpi':'summaryComponentKpi'}" data-kpi-scope="${scope.id}"><div class="rappel-overview-amounts"><div><div class="label">${t('unweighted')}${suffix}</div><div class="value">${money(total.unweighted)}</div></div><div><div class="label">${t('commission').replace('Rappelcommissie','Rappel&shy;commissie')}${suffix}</div><div class="value">${money(total.commission)}</div></div></div><div class="rappel-overview-average" title="${formula}"><span>${average}</span><strong>${pct(C.share(total.commission,total.unweighted))}</strong></div></section>`;
  }).join('');
  const tableRows = types().map((code,i)=>`<tr><th scope="row"><span class="rappel-overview-type"><i style="background:${colors[i%colors.length]}"></i>${esc(typeLabel(code))}</span></th>${scopes.map(scope=>{
    const subtotal = C.totals(scope.rows.filter(row=>row.type===code));
    return `<td class="rappel-overview-group-start" data-scope="${scope.id}" data-metric="unweighted">${money(subtotal.unweighted)}</td><td data-scope="${scope.id}" data-metric="commission">${money(subtotal.commission)}</td><td data-scope="${scope.id}" data-metric="rate" title="${formula}">${pct(C.share(subtotal.commission,subtotal.unweighted))}</td>`;
  }).join('')}</tr>`).join('');
  return `<div class="life-kpis rappel-overview-summaries">${cards}</div><div class="rappel-overview-table-wrap"><table class="rappel-overview-table"><colgroup><col style="width:16%">${scopes.map(()=>'<col style="width:9.25%"><col style="width:9.25%"><col style="width:9.5%">').join('')}</colgroup><thead><tr><th rowspan="2" scope="col">${t('type')}</th>${scopes.map(scope=>`<th colspan="3" scope="colgroup" class="rappel-overview-group-start" data-scope="${scope.id}">${esc(scope.label)}</th>`).join('')}</tr><tr>${scopes.map(scope=>`<th scope="col" class="rappel-overview-group-start" data-scope="${scope.id}">${t('unweighted')}</th><th scope="col" data-scope="${scope.id}">${t('commission').replace('Rappelcommissie','Rappel&shy;commissie')}</th><th scope="col" data-scope="${scope.id}" class="rappel-average-heading">${average.replace(' ','<br>')}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></div>`;
}
function sortedRows(rows,tableId) {
  const {key,direction}=state.sorts[tableId];
  if (!key) return [...rows];
  const field={groupNo:'groupId',shortCount:'count'}[key]||key;
  return [...rows].sort((a,b)=>{
    const x=tableId==='summary'&&field==='id'?`${typeLabel(a.id)} ${a.fiscalLabel}`:a[field],y=tableId==='summary'&&field==='id'?`${typeLabel(b.id)} ${b.fiscalLabel}`:b[field];
    if(x==null||y==null)return x==null?(y==null?0:1):-1;
    const order=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),lang==='fr'?'fr-BE':'nl-BE',{numeric:true,sensitivity:'base'});
    return direction==='asc'?order:-order;
  });
}
function table(headers,rows,footer='',sort=null) {
  const colgroup = sort?.widths ? `<colgroup>${sort.widths.map(width=>`<col style="width:${width}%">`).join('')}</colgroup>` : '';
  return `<div class="life-table-wrap"><table class="life-table${sort?.compact ? ' life-koepel-detail' : ''}">${colgroup}<thead><tr>${headers.map((x,i) => {
    if(!sort)return `<th scope="col"${i===0?' class="life-text-heading"':''}>${esc(x)}</th>`;
    const key=sort.keys[i],current=state.sorts[sort.id],active=current.key===key;
    const direction=active?(current.direction==='asc'?'ascending':'descending'):'none';
    const textColumn=['id','policy','client','type','groupNo','groupName','product'].includes(key)||(key==='producer'&&sort.id!=='detail');
    return `<th scope="col"${textColumn?' class="life-text-heading"':''} aria-sort="${direction}"><button type="button" class="life-sort-button" data-sort-table="${sort.id}" data-sort-key="${key}">${esc(x)}<span aria-hidden="true">${active?(current.direction==='asc'?'▲':'▼'):'↕'}</span></button></th>`;
  }).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}">${t('noData')}</td></tr>`}</tbody>${footer ? `<tfoot>${footer}</tfoot>` : ''}</table></div>`;
}
function aggregateRows(rows,key) {
  const total = C.totals(rows);
  const grouped = key === 'type' ? types().map(id => ({id,rows:rows.filter(r => r.type === id)})) : C.groupBy(rows,key);
  const split = key === 'type' ? grouped.flatMap(group => fiscalBuckets(group.rows).map(bucket => ({id:group.id,fiscalLabel:bucket.label,...C.totals(bucket.rows)}))) : grouped.map(group=>({id:group.id,...C.totals(group.rows)}));
  return sortedRows(split.map(g=>({...g,countShare:C.share(g.count,total.count),unweightedShare:C.share(g.unweighted,total.unweighted),weightedShare:C.share(g.weighted,total.weighted),commissionShare:C.share(g.commission,total.commission),averageRappel:C.share(g.commission,g.unweighted)})),key === 'type' ? 'summary' : 'groups');
}
function aggregateTable(rows,key) {
  const total=C.totals(rows), aggregates=aggregateRows(rows,key);
  const fields = visibleFields(['shortCount','countShare','unweighted','unweightedShare','weighted','weightedShare','commission',key === 'type' ? 'averageRappel' : 'commissionShare']);
  const dataCells = a => `<td>${fmt(a.count)}</td><td>${percent(a.count,total.count)}</td><td>${money(a.unweighted)}</td><td>${percent(a.unweighted,total.unweighted)}</td><td>${money(a.commission)}</td><td>${percent(a.commission,key === 'type' ? a.unweighted : total.commission)}</td>`;
  return table([t(key === 'groupId' ? (singleGroupFile()?'fileTotal':'group') : key),...fields.map(t)],
    aggregates.map(a => `<tr><td>${key === 'groupId' ? groupMarkup(a.id) : esc(key === 'type' ? typeLabel(a.id) : a.id)}${key === 'type' ? `<span class="rappel-fiscal-label">${esc(a.fiscalLabel)}</span>` : ''}</td>${dataCells(a)}</tr>`),`<tr><td>${t('total')}</td>${dataCells(total)}</tr>`,{id:key === 'type' ? 'summary' : 'groups',keys:['id',...fields]});
}
function fiscalBuckets(rows) {
  return [false,true].map(nonFiscal => ({nonFiscal,label:nonFiscal ? (lang === 'fr' ? 'Non fiscal' : 'Niet-fiscaal') : (lang === 'fr' ? 'Fiscal' : 'Fiscaal'),rows:rows.filter(row => C.isNonFiscal(row) === nonFiscal)})).filter(bucket => bucket.rows.length);
}
function fiscalColor(color, nonFiscal) {
  if (!nonFiscal || !/^#[0-9a-f]{6}$/i.test(color)) return color;
  return '#' + [1,3,5].map(start => Math.round(parseInt(color.slice(start,start+2),16)*.55+255*.45).toString(16).padStart(2,'0')).join('');
}
function bars(rows,key) {
  const total = C.totals(rows)[key];
  return `<div class="life-bars">${types().map((code,i) => { const value = C.totals(rows.filter(r => r.type === code))[key];
    return `<div><div class="life-bar-label"><span>${esc(typeLabel(code))}</span><strong>${key === 'count' ? fmt(value) : money(value)} · ${percent(value,total)}</strong></div><div class="life-bar-track"><span style="background:${colors[i % colors.length]};width:${Math.max(0,Math.min(100,C.share(value,total) || 0))}%"></span></div></div>`;
  }).join('')}</div>`;
}
function groupColor(id) { const ids = [...new Set(state.records.map(r => singleGroupFile()?r.producer:r.groupId))].sort(); const i = ids.indexOf(id); return i < colors.length ? colors[i] : `hsl(${(i * 137.508) % 360},48%,44%)`; }
function donut(parts,total,metric = state.metric,label = t('groupShare'),centerLabel = t('total')) {
  if (total <= 0 || parts.some(p => p.value < 0)) return `<div class="life-empty-chart">${t('noPie')}</div>`;
  let angle = -Math.PI / 2;
  const positive = parts.filter(p => p.value > 0);
  const paths = positive.map(p => {
    const start = angle, delta = p.value / total * Math.PI * 2; angle += delta;
    const percentage = 'averageRappel' in p ? `${t('averageRappel')}: ${pct(p.averageRappel)}` : `${t(metric === 'unweighted' ? 'premiumShareLabel' : 'share')}: ${percent(p.value,total)}`;
    const tooltip = esc(`${p.label}\n${t(metric)}: ${metric === 'count' ? fmt(p.value) : money(p.value)}\n${percentage}`);
    const mid = start + delta / 2;
    const offset = positive.length === 1 ? 0 : 6;
    const attributes = `tabindex="0" aria-label="${tooltip}" data-chart-tooltip="${tooltip}" style="--slice-x:${(Math.cos(mid)*offset).toFixed(2)}px;--slice-y:${(Math.sin(mid)*offset).toFixed(2)}px"`;
    if (positive.length === 1) return `<circle cx="100" cy="100" r="86" fill="${p.color}" ${attributes}></circle>`;
    return `<path d="M100,100 L${100+86*Math.cos(start)},${100+86*Math.sin(start)} A86,86 0 ${delta > Math.PI ? 1 : 0},1 ${100+86*Math.cos(angle)},${100+86*Math.sin(angle)} Z" fill="${p.color}" stroke="white" stroke-width="1" ${attributes}></path>`;
  }).join('');
  return `<svg class="life-donut" viewBox="0 0 200 200" role="img" aria-label="${esc(label)}">${paths}<g pointer-events="none"><circle cx="100" cy="100" r="53" fill="white"/><text x="100" y="94" text-anchor="middle" fill="#4d4d4d" font-size="10" font-family="Arial">${esc(centerLabel)}</text><text x="100" y="115" text-anchor="middle" fill="#0d1473" font-size="13" font-weight="bold" font-family="Arial">${esc(metric === 'count' ? fmt(total) : money(total))}</text></g></svg>`;
}
function summaryCharts(rows) {
  return `<div class="life-chart-grid life-summary-charts">${['unweighted','commission'].map(key => {
    const title = t(key === 'unweighted' ? 'productionPie' : 'commissionPie');
    const parts = types().flatMap((code,i) => fiscalBuckets(rows.filter(r=>r.type===code)).map(bucket => {
      const subtotal = C.totals(bucket.rows);
      return {typeLabel:typeLabel(code),fiscalLabel:bucket.label,label:`${typeLabel(code)} · ${bucket.label}`,count:bucket.rows.length,value:subtotal[key],color:fiscalColor(colors[i % colors.length],bucket.nonFiscal),...(key === 'commission' ? {averageRappel:C.share(subtotal.commission,subtotal.unweighted)} : {})};
    }));
    const total = C.totals(rows)[key];
    return card(`summary-pie-${key}`,title,`<div class="life-chart-body">${donut(parts,total,key,title,key==='unweighted'?(lang==='fr'?'Prime':'Premie'):t('commission'))}<table class="life-legend life-summary-legend"><thead><tr><th>${t('type')}</th><th>${t('shortCount')}</th><th>${t(key)}</th></tr></thead><tbody>${parts.map(p => `<tr><td><span class="life-swatch" style="background:${p.color}"></span>${esc(p.typeLabel)}<span class="rappel-fiscal-label">${esc(p.fiscalLabel)}</span></td><td>${fmt(p.count)}</td><td>${money(p.value)}<small>${key === 'commission' ? `${t('averageRappel')}: ${pct(p.averageRappel)}` : `${t('premiumShareLabel')}: ${percent(p.value,total)}`}</small></td></tr>`).join('')}</tbody></table></div>`);
  }).join('')}</div>`;
}
function charts(rows) {
  return `<div class="life-chart-grid">${['unweighted','commission'].map((key) => {
    const data = rows;
    const parts = C.groupBy(data,singleGroupFile()?'producer':'groupId').map(g => {
      const subtotal = C.totals(g.rows);
      return {rows:g.rows,groupId:g.id,label:singleGroupFile()?`${t('producer')} ${g.id}`:groupLabel(g.id),value:subtotal[key],color:groupColor(g.id)};
    }).sort((a,b) => b.value-a.value);
    const itemLabel=p=>singleGroupFile()?esc(p.label):groupMarkup(p.groupId);
    const total = C.totals(data)[key], maxValue = Math.max(0,...parts.map(part=>part.value)), id = `group-chart-${key}`;
    const title = `${singleGroupFile()?(lang==='fr'?'Part par producteur':'Aandeel per producent'):t('groupShare')} · ${t(key)}`;
    const mode=state.chartModes[key];
    const controls=`<select class="life-chart-mode" data-chart-mode="${key}" aria-label="${esc(title)}: ${lang==='fr'?'type de graphique':'grafiektype'}" data-html2canvas-ignore><option value="pie" ${mode==='pie'?'selected':''}>${lang==='fr'?'Camembert':'Taartgrafiek'}</option><option value="bar" ${mode==='bar'?'selected':''}>${lang==='fr'?'Barres':'Balkgrafiek'}</option></select>`;
    const rate = p => percent(p.value,total);
    const amount = money;
    const typeLegend = `<div class="rappel-stack-legend">${types().map((code,i)=>`<span><i class="life-swatch" style="background:${colors[i%colors.length]}"></i>${esc(typeLabel(code))}</span>`).join('')}</div>`;
    const figure=mode==='bar'?`${typeLegend}<div class="life-group-bars">${parts.map(p=>{
      const segments=types().map((code,i)=>{
        const subtotal=C.totals(p.rows.filter(row=>row.type===code)), value=subtotal[key];
        if(value<=0)return '';
        const percentage=key==='commission'?`${t('commissionShare')}: ${percent(value,total)}`:percent(value,p.value);
        const tooltip=esc(`${p.label} · ${typeLabel(code)}\n${t(key)}: ${amount(value)} · ${percentage}`);
        return `<span class="rappel-bar-segment" style="background:${colors[i%colors.length]};width:${Math.max(0,Math.min(100,C.share(value,p.value)||0))}%" tabindex="0" data-chart-tooltip="${tooltip}" aria-label="${tooltip}"></span>`;
      }).join('');
      return `<div class="life-group-bar-row"><div class="life-bar-label"><strong>${itemLabel(p)}</strong></div><div class="rappel-bar-content"><span class="rappel-group-total">${amount(p.value)} · ${key==='commission'?`${t('share')}: `:''}${rate(p)}</span><div class="life-bar-track"><div class="rappel-bar-stack" style="width:${Math.max(0,Math.min(100,C.share(p.value,maxValue)||0))}%">${segments}</div></div></div></div>`;
    }).join('')||`<p>${t('noData')}</p>`}</div>`:donut(parts,total,key,title);
    const legend=mode==='pie'?`<table class="life-legend"><caption class="small">${t(singleGroupFile()?'producer':'group')} · ${t(key)} · ${t(key==='commission'?'commissionShare':'share')}</caption><tbody>${parts.map(p => `<tr><td><div class="life-legend-group"><span class="life-swatch" style="background:${p.color}"></span>${itemLabel(p)}</div></td><td>${amount(p.value)}<small>${key==='commission'?`${t('share')}: `:''}${rate(p)}</small></td></tr>`).join('') || `<tr><td>${t('noData')}</td></tr>`}</tbody></table>`:'';
    return card(id,title,`<div class="life-chart-body ${mode==='pie'?'life-pie-split':'life-bar-full'}">${figure}${legend}</div>`,controls);
  }).join('')}</div>`;
}
function multiDropdown(key,label,ids,values,open=false) {
  const text=id=>key==='detailFiscal'?t(id):key==='groupId'?groupLabel(id):['groupProductionTypes','detailProductionTypes'].includes(key)?typeLabel(id):id;
  const summary=values.length===1?text(values[0]):values.length?`${values.length} ${t('selected')}`:t('all');
  return `<div class="life-filter-field"><span>${esc(label)}</span><details class="life-multiselect" id="multi-${key}" ${open?'open':''}><summary>${esc(summary)}<span aria-hidden="true">⌄</span></summary><div class="life-multiselect-options" role="group" aria-label="${esc(label)}"><div class="life-multiselect-tools"><input type="search" data-multi-search="${key}" aria-label="${esc(label)}: ${lang==='fr'?'Rechercher':'Zoeken'}" placeholder="${lang==='fr'?'Rechercher…':'Zoeken…'}"><div><button type="button" class="life-button" data-multi-all="${key}">${t('all')}</button><button type="button" class="life-button" data-multi-clear="${key}">${lang==='fr'?'Effacer la sélection':'Wis selectie'}</button></div></div>${ids.map(id=>`<label><input type="checkbox" data-multi="${key}" value="${esc(id)}" ${values.includes(id)?'checked':''}>${key==='groupId'?groupMarkup(id):`<span>${esc(text(id))}</span>`}</label>`).join('')}</div></details></div>`;
}
function renderFilters(openKey='') {
  const singleGroup=singleGroupFile();
  const producerOnly=singleGroup&&state.tab==='groups';
  const keys = singleGroup ? ['producer', ...(producerOnly ? [] : ['policy'])] : ['groupId','producer'];
  $('filters').innerHTML = keys.map(key => {
    const groups=selections(state.filters.groupId);
    const policies=selections(state.filters.policy);
    const options = key === 'producer' && !producerOnly ? state.records.filter(r=>(!groups.length||groups.includes(r.groupId))&&(!policies.length||policies.includes(r.policy))) : state.records;
    const ids = [...new Set(options.map(r => r[key]))].sort((a,b) => {
      const name=id=>state.records.find(r=>r.groupId===id)?.groupName||id;
      return (key==='groupId'?name(a).localeCompare(name(b),lang==='fr'?'fr-BE':'nl-BE',{sensitivity:'base'}):0)||a.localeCompare(b,undefined,{numeric:true});
    });
    return multiDropdown(key,t(key==='groupId'?'group':key),ids,selections(state.filters[key]),openKey===key);
  }).join('') + (producerOnly?'':`<label>${t('search')}<input type="search" data-filter="search" value="${esc(state.filters.search)}" placeholder="${esc(t('search'))}"></label>`) + `<button class="life-button" id="reset">${t('reset')}</button>`;
}
function filterMultiOptions(menu) {
  const query=menu.querySelector('[data-multi-search]').value.trim().toLocaleLowerCase();
  menu.querySelectorAll('.life-multiselect-options > label').forEach(label=>{label.hidden=!`${label.textContent} ${label.querySelector('input').value}`.toLocaleLowerCase().includes(query);});
}
function setMultiSelection(key,values) {
  const menu=$('multi-'+key), panel=menu?.querySelector('.life-multiselect-options');
  const scrollTop=panel?.scrollTop||0, query=menu?.querySelector('[data-multi-search]')?.value||'';
  const focused=document.activeElement;
  const focusValue=focused?.dataset.multi===key?focused.value:null;
  const focusAction=focused?.hasAttribute('data-multi-all')?'[data-multi-all]':focused?.hasAttribute('data-multi-clear')?'[data-multi-clear]':null;
  const windowY=window.scrollY;

  if(key==='groupProducts')state.groupProducts=values;
  else if(key==='groupProductionTypes')state.groupProductionTypes=values;
  else if(key==='detailProducts')state.detailProducts=values;
  else if(key==='detailProductionTypes')state.detailProductionTypes=values;
  else if(key==='detailFiscal')state.detailFiscal=values;
  else {
    state.filters[key]=values;
    if(['groupId','policy'].includes(key))state.filters.producer=selections(state.filters.producer).filter(id=>state.records.some(r=>(!values.length||values.includes(r[key]))&&r.producer===id));
    renderFilters(key);
  }
  state.page=0;renderData();
  const updated=$('multi-'+key);
  if(updated){
    updated.open=true;
    updated.querySelector('[data-multi-search]').value=query;
    filterMultiOptions(updated);
    const focusTarget=focusAction?updated.querySelector(focusAction):[...updated.querySelectorAll('[data-multi]')].find(input=>input.value===focusValue);
    focusTarget?.focus({preventScroll:true});
    updated.querySelector('.life-multiselect-options').scrollTop=scrollTop;
    window.scrollTo({top:windowY,behavior:'instant'});
  }
}
function filterDetailRows(rows){return rows.filter(r=>(!state.detailProducts.length||state.detailProducts.includes(r.product))&&(!state.detailProductionTypes.length||state.detailProductionTypes.includes(r.type))&&(!state.detailFiscal.length||state.detailFiscal.includes(C.isNonFiscal(r)?'nonFiscal':'fiscal')));}
function detailHeading(key) {
  const short = lang === 'fr' ? {commission:'Comm. rappel',producer:'N° prod.',groupNo:'N° groupe'} : {commission:'Rappelcomm.',producer:'Prodnr.',groupNo:'Groepsnr.'};
  return !singleGroupFile() && short[key] ? short[key] : t(key);
}
function renderDetail(rows) {
  rows=filterDetailRows(rows);
  const size = 50, maxPage = Math.max(0,Math.ceil(rows.length/size)-1); state.page = Math.min(state.page,maxPage);
  const subset = sortedRows(rows,'detail').slice(state.page*size,(state.page+1)*size);
  const columns=detailColumns();
  const widths = {policy:9,client:14,type:9,unweighted:9,rate:6,commission:9,groupNo:8,groupName:15,producer:6,product:15};
  const html = table(columns.map(detailHeading),subset.map(r => `<tr>${columns.map(key=>{
    const value=key==='type'?typeLabel(r.type):key==='groupNo'?r.groupId:['unweighted','weighted','commission'].includes(key)?money(r[key]):key==='rate'?pct(r.rate):r[key];
    return `<td${['client','type','groupNo','groupName','product'].includes(key)?' class="text"':''}>${esc(value)}</td>`;
  }).join('')}</tr>`),'',{id:'detail',keys:columns,compact:!singleGroupFile(),widths:singleGroupFile()?null:columns.map(key=>widths[key])});
  const products=[...new Set(state.records.map(r=>r.product))].sort((a,b)=>a.localeCompare(b,lang==='fr'?'fr-BE':'nl-BE'));
  const controls=`<div class="life-group-table-filters rappel-table-filters rappel-detail-filters" data-html2canvas-ignore>${multiDropdown('detailFiscal',t('fiscalStatus'),['fiscal','nonFiscal'],state.detailFiscal)}${multiDropdown('detailProducts',t('product'),products,state.detailProducts)}${multiDropdown('detailProductionTypes',t('type'),types(),state.detailProductionTypes)}<button type="button" class="life-button" id="resetDetailFilters">${t('reset')}</button></div>`;
  $('detail').innerHTML = card('detail-table',t('detail'),`${controls}<p class="small">${t('product')}: ${esc(state.detailProducts.length?state.detailProducts.join(', '):t('all'))} · ${t('type')}: ${esc(state.detailProductionTypes.length?state.detailProductionTypes.map(typeLabel).join(', '):t('all'))} · ${t('fiscalStatus')}: ${esc(state.detailFiscal.length?state.detailFiscal.map(t).join(', '):t('all'))}</p><p class="small">${t('recordNote')} ${t('csv')}: ${fmt(rows.length)} ${t('count').toLowerCase()}.</p>${html}<div class="life-pagination" data-html2canvas-ignore><span>${rows.length ? fmt(state.page*size+1) : 0}–${fmt(Math.min((state.page+1)*size,rows.length))} / ${fmt(rows.length)}</span><div><button class="life-button" data-page="-1" ${state.page === 0 ? 'disabled' : ''}>${t('prev')}</button> <button class="life-button" data-page="1" ${state.page === maxPage ? 'disabled' : ''}>${t('next')}</button></div></div>`);
}
function distributionTableRows() {
  if(singleGroupFile())return state.records.filter(r=>!selections(state.filters.producer).length||selections(state.filters.producer).includes(r.producer));
  return selected().filter(r=>(!state.groupProducts.length||state.groupProducts.includes(r.product))&&(!state.groupProductionTypes.length||state.groupProductionTypes.includes(r.type)));
}
function renderData() {
  if (!state.records.length) return;
  if(!visibleSections().includes(state.tab))state.tab='summary';
  $('chartTooltip').classList.add('hidden');
  Object.values(state.sorts).forEach(sort=>{if(['weighted','weightedShare'].includes(sort.key))sort.key=sort.key==='weighted'?'unweighted':'unweightedShare';});
  const rows = selected(), total = C.totals(rows);
  total.policies = new Set(rows.map(r => r.policy)).size;
  $('headline').querySelector(':scope > .life-section-head')?.remove();
  $('headline').insertAdjacentHTML('afterbegin', head(t('total'),'headline'));
  $('headlineKpis').innerHTML = metrics(total,rows);
  $('summary').innerHTML = summaryCharts(rows) + card('summary-table',t('summary'),aggregateTable(rows,'type'));
  const productOptions=[...new Set(state.records.map(r=>r.product))].sort((a,b)=>a.localeCompare(b,lang==='fr'?'fr-BE':'nl-BE'));
  const groupRows=distributionTableRows();
  const productFilter=`<div class="life-group-table-filters rappel-table-filters" data-html2canvas-ignore>${multiDropdown('groupProducts',t('product'),productOptions,state.groupProducts)}${multiDropdown('groupProductionTypes',t('type'),types(),state.groupProductionTypes)}<button type="button" class="life-button" id="resetGroupFilters">${t('reset')}</button></div><p class="small">${t('product')}: ${esc(state.groupProducts.length?state.groupProducts.join(', '):t('all'))} · ${t('type')}: ${esc(state.groupProductionTypes.length?state.groupProductionTypes.map(typeLabel).join(', '):t('all'))}</p>`;
  const distributionRows=singleGroupFile()?state.records.filter(r=>!selections(state.filters.producer).length||selections(state.filters.producer).includes(r.producer)):rows;
  $('groups').innerHTML = singleGroupFile()?card('groups-table',lang==='fr'?'Totaux par producteur':'Producenttotalen',aggregateTable(groupRows,'producer'))+charts(distributionRows):card('groups-table',t('groupTotal'),productFilter+aggregateTable(groupRows,'groupId'))+charts(rows);
  renderDetail(rows);
  sections.forEach(id => $(id).classList.toggle('hidden',id !== state.tab));
}
function renderStatic() {
  if(!visibleSections().includes(state.tab))state.tab='summary';
  document.documentElement.lang = lang;
  $('dashboardViewLabel').textContent = t('dashboardView');
  $('heroEyebrow').textContent = t('eyebrow');
  $('replace').textContent = t('importAction');
  $('lifeTop').setAttribute('aria-label',lang==='fr'?'Retour en haut':'Ga naar boven');
  $('lifeTop').setAttribute('title',lang==='fr'?'Retour en haut':'Ga naar boven');
  if (state.records.length) $('source').textContent = `Excel: ${state.source} · ${fmt(state.records.length)} ${t('count').toLowerCase()} · ${singleGroupFile()?'A–M · ':''}${t('importOk')}`;
  const labels = {pageTitle:'title',lead:'lead',benefit1:'benefit1',benefit2:'benefit2',benefit3:'benefit3',uploadTitle:'upload',uploadHint:'uploadHint',pick:'pick',previewTitle:'preview',commit:'commit',cancel:'cancel',sheetLabel:'sheet',sourceTitle:'source',csv:'csv',pdfLabel:'pdf',pdfSections:'pdfSections',pdfSelectAll:'allSelect',pdfSelectNone:'noneSelect',print:'print',empty:'empty',footer:'footer',releaseText:'release'};
  Object.entries(labels).forEach(([id,key]) => {if(id==='lead')$(id).innerHTML=t(key);else $(id).textContent=t(key);});
  $('dropzone').setAttribute('aria-label',t('pick'));
  const tabIcons={summary:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',groups:'<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M15 3.5a9 9 0 0 1 5.5 5.5H15z"/>',detail:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>'};
  $('tabs').innerHTML = visibleSections().map(id => `<button type="button" class="life-tab" data-tab="${id}" aria-pressed="${id === state.tab}"><svg class="life-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tabIcons[id]}</svg><span>${t(id)}</span></button>`).join('');
  $('pdfChecks').innerHTML = ['headline',...visibleSections()].map(id => `<label><input type="checkbox" data-section="${id}" ${['headline','summary','groups'].includes(id) ? 'checked' : ''}> ${t(id === 'headline' ? 'total' : id)}</label>`).join('');
  if (state.records.length) { renderFilters(); renderData(); } else message(t('ready'));
  if (state.pending) preview();
}
async function workbookGrid(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const start = new TextDecoder().decode(bytes.slice(0,512));
  if (/<(?:html|head|table|!doctype)/i.test(start)) {
    const utf8 = /^\uFEFF/.test(start) || /charset\s*=\s*["']?utf-?8/i.test(start);
    let text = new TextDecoder(utf8 ? 'utf-8' : 'windows-1252').decode(bytes);
    const doc = new DOMParser().parseFromString(text,'text/html');
    const table = [...doc.querySelectorAll('table')].find(x => /pol/i.test(x.rows[0]?.cells[0]?.textContent || ''));
    if (!table) throw new Error('Geen Life-detailtabel gevonden.');
    return {grid:[...table.rows].map(r => [...r.cells].map(c => c.textContent.trim())),workbook:null,sheet:''};
  }
  if (!window.XLSX) throw new Error('Excel-leesbibliotheek ontbreekt. Controleer libs/xlsx.full.min.js.');
  const workbook = XLSX.read(bytes,{type:'array',cellNF:true,cellText:true});
  // Select the first worksheet that actually has the expected detail columns.
  for (const name of workbook.SheetNames) {
    const grid = sheetGrid(workbook.Sheets[name]);
    if (grid.some(r => /pol/i.test(String(r[0] || '')) && /type/i.test(String(r[2] || '')))) return {grid,workbook,sheet:name};
  }
  throw new Error('Geen werkblad met de kolommen A–K of A–M van het Life-detailrapport gevonden.');
}
function sheetGrid(sheet) {
  if (!sheet['!ref']) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']); range.s = {r:0,c:0};
  const grid = XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:'',blankrows:true,range});
  const alternate=C.isSingleGroupHeader(grid.find(row=>/pol/i.test(String(row[0]||''))&&/type/i.test(String(row[2]||'')))||[]);
  grid.forEach((row,r) => {
    (alternate?[0,3,11]:[0,8,9]).forEach(c => { const cell = sheet[XLSX.utils.encode_cell({r,c})]; if (cell) row[c] = cell.w ?? String(cell.v ?? ''); });
    const rateCol=alternate?9:6,rate = sheet[XLSX.utils.encode_cell({r,c:rateCol})];
    if (typeof rate?.v === 'number' && /%/.test(rate.z || '')) row[rateCol] = rate.v * 100;
  });
  return grid;
}
let importRequest = 0;
async function importFiles(files) {
  if (!files?.length) return;
  if (files.length !== 1) { message(t('single'),true); return; }
  const file = files[0];
  if (!/\.xlsx?$/i.test(file.name)) { message(t('uploadHint'),true); return; }
  const request = ++importRequest;
  state.pending = null; state.workbook = null; $('importPreview').classList.add('hidden');
  message(t('loading')); $('pick').disabled = true;
  try {
    const result = await workbookGrid(file), records = C.parseGrid(result.grid);
    if (request !== importRequest) return;
    state.pending = {records,name:file.name,sheet:result.sheet}; state.workbook = result.workbook;
    commit();
  } catch(e) { if (request === importRequest) message(e.message,true); }
  finally { if (request === importRequest) { $('pick').disabled = false; $('file').value = ''; } }
}
function preview() {
  const p = state.pending, a = C.totals(p.records);
  $('commit').disabled = false;
  $('importPreview').classList.remove('hidden');
  const unknown = [...new Set(p.records.map(r => r.type).filter(x => !C.TYPES.includes(x)))];
  $('previewContent').innerHTML = `<strong>${esc(p.name)}</strong><div class="preview-totals">${visibleFields(['count','unweighted','weighted']).map(k => `<div><span class="small">${t(k)}</span><strong>${k === 'count' ? fmt(a.count) : money(a[k])}</strong></div>`).join('')}</div><p class="small">${typesFrom(p.records).map(code => `${esc(typeLabel(code))}: ${fmt(p.records.filter(r => r.type === code).length)}`).join(' · ')}</p>${unknown.length ? `<p class="small">${t('unknown')}: ${unknown.map(esc).join(', ')}</p>` : ''}`;
  $('sheetWrap').classList.toggle('hidden',!state.workbook || state.workbook.SheetNames.length < 2);
  $('sheet').innerHTML = (state.workbook?.SheetNames || []).map(name => `<option value="${esc(name)}" ${name === p.sheet ? 'selected' : ''}>${esc(name)}</option>`).join('');
}
function typesFrom(rows) { return [...C.TYPES,...new Set(rows.map(r => r.type).filter(x => !C.TYPES.includes(x)))]; }
function commit() {
  if (!state.pending) return;
  state.records = state.pending.records; state.source = state.pending.name; state.sheet = state.pending.sheet;
  state.pending = null; state.workbook = null; state.filters = {groupId:'',policy:'',type:'',product:'',producer:'',search:''}; state.page = 0;
  state.chartModes = {unweighted:'bar',count:'bar',commission:'bar'};
  state.sorts.summary = {key:null,direction:'asc'};
  state.groupProducts = [];
  state.groupProductionTypes = [];
  state.detailProducts = [];state.detailProductionTypes = [];state.detailFiscal = [];
  $('source').textContent = state.source + (state.sheet ? ` · ${state.sheet}` : '');
  $('importPreview').classList.add('hidden'); $('intro').classList.add('hidden'); $('empty').classList.add('hidden'); $('dashboard').classList.remove('hidden');
  $('topActions').appendChild($('languageSwitch'));
  renderStatic(); message(`${t('loaded')}: ${fmt(state.records.length)} ${t('count').toLowerCase()}.`);
}
function saveBlob(blob,name) { const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url),3000); }
function csvExport() {
  const columns=detailColumns(),header = columns.map(t);
  const safe = v => '"' + (/^[\s]*[=+\-@]/.test(String(v)) ? "'" + v : String(v)).replace(/"/g,'""') + '"';
  const numeric = n => n == null ? '' : String(n).replace('.',',');
  const text = ['sep=;',header.map(safe).join(';'),...sortedRows(filterDetailRows(selected()),'detail').map(r => columns.map(key=>['unweighted','weighted','commission'].includes(key)?numeric(r[key]/100):key==='rate'?numeric(r.rate):safe(key==='type'?typeLabel(r.type):key==='groupNo'?r.groupId:r[key]??'')).join(';'))].join('\r\n');
  saveBlob(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'}),'dashboardliferappel.csv');
}
function detailWorkbook() {
  const columns=detailColumns();
  const data=sortedRows(filterDetailRows(selected()),'detail').map(r=>({policy:r.policy,client:r.client,type:typeLabel(r.type),productionMonth:r.productionMonth,unweighted:r.unweighted/100,weighted:r.weighted/100,rate:r.rate==null?null:r.rate/100,commission:r.commission/100,groupNo:r.groupId,groupName:r.groupName,producer:r.producer,product:r.product}));
  const sheet=XLSX.utils.aoa_to_sheet([columns.map(t),...data.map(r=>columns.map(key=>r[key]))]);
  sheet['!cols']=columns.map(key=>({wch:['client','groupName','product','type'].includes(key)?30:22}));
  sheet['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:data.length,c:columns.length-1}})};
  for(let r=1;r<=data.length;r++)columns.forEach((key,c)=>{
    const cell=sheet[XLSX.utils.encode_cell({r,c})];if(!cell)return;
    if(['unweighted','weighted','commission'].includes(key))cell.z='#,##0.00 "€"';
    else if(key==='rate')cell.z='0.00%';
    else if(['policy','groupNo','producer'].includes(key))cell.z='@';
  });
  const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,sheet,'Detail');return workbook;
}
function exportDetailExcel() {
  try {
    if(!window.XLSX)throw new Error('Excel-bibliotheek ontbreekt.');
    const buffer=XLSX.write(detailWorkbook(),{type:'array',bookType:'xlsx'});
    saveBlob(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'dashboardliferappel-detail.xlsx');
  }catch(error){message(error.message,true);}
}
function groupsWorkbook() {
  const rows=distributionTableRows(), single=singleGroupFile(), total=C.totals(rows);
  const columns=[...(single?['producer']:['groupNo','groupName']),'shortCount','countShare','unweighted','unweightedShare','commission','commissionShare'];
  const aggregates=aggregateRows(rows,single?'producer':'groupId');
  const values=a=>[...(single?[a.id]:[a.id,rows.find(r=>r.groupId===a.id)?.groupName||'']),a.count,C.share(a.count,total.count)==null?null:C.share(a.count,total.count)/100,a.unweighted/100,C.share(a.unweighted,total.unweighted)==null?null:C.share(a.unweighted,total.unweighted)/100,a.commission/100,C.share(a.commission,total.commission)==null?null:C.share(a.commission,total.commission)/100];
  const footer=values({...total,id:t('total')});
  const sheet=XLSX.utils.aoa_to_sheet([columns.map(t),...aggregates.map(values),footer]);
  sheet['!cols']=columns.map(key=>({wch:key==='groupName'?38:key.endsWith('Share')?32:22}));
  sheet['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:aggregates.length,c:columns.length-1}})};
  for(let r=1;r<=aggregates.length+1;r++)columns.forEach((key,c)=>{
    const cell=sheet[XLSX.utils.encode_cell({r,c})];if(!cell)return;
    if(['unweighted','commission'].includes(key))cell.z='#,##0.00 "€"';
    else if(key.endsWith('Share'))cell.z='0.00%';
    else if(['producer','groupNo'].includes(key))cell.z='@';
    else if(key==='shortCount')cell.z='0';
  });
  const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,sheet,single?'Producenttotalen':'Groepstotalen');return workbook;
}
function exportGroupsExcel() {
  try {
    if(!window.XLSX)throw new Error('Excel-bibliotheek ontbreekt.');
    const buffer=XLSX.write(groupsWorkbook(),{type:'array',bookType:'xlsx'});
    saveBlob(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`dashboardliferappel-${singleGroupFile()?'producenttotalen':'groepstotalen'}.xlsx`);
  }catch(error){message(error.message,true);}
}
async function canvasFor(id) {
  if (!window.html2canvas) throw new Error('html2canvas ontbreekt in libs.');
  await document.fonts.ready;
  const node = $(id);
  return html2canvas(node,{backgroundColor:'#ffffff',scale:1.6,logging:false,windowWidth:Math.max(document.documentElement.clientWidth,1380),
    onclone(doc) {
      const clone = doc.getElementById(id); clone.closest('.life-view')?.classList.remove('hidden');
      clone.style.width = '1280px'; clone.style.maxWidth = 'none';
      clone.querySelectorAll('.life-table-wrap').forEach(x => {x.style.overflow='visible';});
    }});
}
async function exportImage(id,copy) {
  // Start the clipboard promise during the click to preserve browser user activation.
  message(t('busy'));
  const png = canvasFor(id).then(canvas => new Promise(resolve => canvas.toBlob(resolve,'image/png')));
  try {
    if (copy && navigator.clipboard?.write && window.ClipboardItem) {
      try { await navigator.clipboard.write([new ClipboardItem({'image/png':png})]); message(t('copied')); return; }
      catch(e) { const blob = await png; if (!blob) throw e; saveBlob(blob,`life-${id}.png`); message(t('savedInstead')); return; }
    }
    const blob = await png; if (!blob) throw new Error('PNG export mislukt.');
    saveBlob(blob,`life-${id}.png`); message(copy ? t('savedInstead') : 'PNG ✓');
  } catch(e) { message(e.message,true); }
}
function pdfSelection() { return [...document.querySelectorAll('#pdfChecks [data-section]:checked')].map(x => x.dataset.section); }
function selectPdfSections(checked) {
  document.querySelectorAll('#pdfChecks [data-section]').forEach(input => input.checked = checked);
}
function prepareRappelPrintBlock(source) {
  const block = source.cloneNode(true);
  block.dataset.printSource = source.id;
  block.classList.add('rappelPrintBlock');
  block.removeAttribute('id');
  block.querySelectorAll('[data-html2canvas-ignore],.life-export,.life-pagination').forEach(node => node.remove());
  block.querySelectorAll('.rappel-kpi-pane[hidden]').forEach(node=>node.remove());
  block.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  block.querySelectorAll('.life-sort-button').forEach(button => button.replaceWith(document.createTextNode(button.firstChild.textContent)));
  // Print every filtered detail record, independently of the on-screen page of 50 rows.
  if (source.id === 'detail-table') {
    const columns = detailColumns();
    block.querySelector('tbody').innerHTML = sortedRows(filterDetailRows(selected()),'detail').map(row => '<tr>' + columns.map(key => {
      const value = key === 'type' ? typeLabel(row.type) : key === 'groupNo' ? row.groupId : ['unweighted','weighted','commission'].includes(key) ? money(row[key]) : key === 'rate' ? pct(row.rate) : row[key];
      return '<td' + (['client','type','groupNo','groupName','product'].includes(key) ? ' class="text"' : '') + '>' + esc(value) + '</td>';
    }).join('') + '</tr>').join('');
  }
  return block;
}
function rappelPrintPage(root, section) {
  const page = document.createElement('section');
  page.className = 'rappelPrintPage';
  page.dataset.section = section;
  const title = document.createElement('h1');
  title.textContent = (lang === 'fr' ? 'Chiffres de rappel vie' : 'Rappelcijfers life') + ' · ' + t(section === 'headline' ? 'total' : section);
  const frame = document.createElement('div'); frame.className = 'rappelPrintFrame';
  const footer = document.createElement('div'); footer.className = 'rappelPrintPageNumber';
  page.append(title,frame,footer); root.appendChild(page);
  return {page,frame};
}
function fitRappelPrintBlock(frame, block) {
  const bounds = block.getBoundingClientRect();
  let scale = Math.min(1, (frame.clientHeight - 6) / bounds.height, frame.clientWidth / Math.max(bounds.width, block.scrollWidth));
  if (!(scale > 0)) throw new Error('PDF: onvoldoende ruimte voor het blok.');
  if (scale < 1) {
    const fit = document.createElement('div');
    fit.className = 'rappelPrintFit';
    fit.style.height = bounds.height * scale + 'px';
    block.replaceWith(fit); fit.appendChild(block);
    block.style.cssText += ';position:absolute;left:0;top:0;width:' + bounds.width + 'px;zoom:' + scale + ';margin:0!important';
    for (let attempt = 0; attempt < 4; attempt++) {
      const actual = block.getBoundingClientRect();
      if (actual.height <= frame.clientHeight - 6 && actual.width <= frame.clientWidth) break;
      scale *= Math.min((frame.clientHeight - 6) / actual.height, frame.clientWidth / actual.width) * .995;
      block.style.zoom = scale;
    }
    fit.style.height = block.getBoundingClientRect().height + 'px';
  }
}
function appendRappelPrintTable(root, section, template) {
  const table = template.querySelector('.life-table');
  const rows = Array.from(table.tBodies[0].rows);
  const footer = table.tFoot?.cloneNode(true);
  table.tBodies[0].replaceChildren(); table.tFoot?.remove();
  let current, block, body, count;
  const startPage = () => {
    current = rappelPrintPage(root,section);
    block = template.cloneNode(true);
    body = block.querySelector('tbody');
    current.frame.appendChild(block); count = 0;
  };
  const overflow = () => block.getBoundingClientRect().bottom > current.frame.getBoundingClientRect().bottom - 2;
  startPage();
  for (const row of rows) {
    body.appendChild(row);
    if (overflow() && count) {
      row.remove(); startPage(); body.appendChild(row);
    }
    count++;
    if (overflow()) {
      fitRappelPrintBlock(current.frame,block);
      // Exceptionally tall individual rows remain intact on their own page.
      current = null;
    }
    if (!current && row !== rows[rows.length - 1]) startPage();
  }
  if (footer) {
    if (!current) startPage();
    block.querySelector('table').appendChild(footer);
    if (overflow() && count) {
      footer.remove(); startPage(); block.querySelector('table').appendChild(footer);
    }
  }
  if (current) fitRappelPrintBlock(current.frame,block);
}
let rappelPrinting = false;
async function printPdf() {
  if (rappelPrinting || !state.records.length) return;
  const selection = pdfSelection();
  if (!selection.length) { message(t('noSections'),true); return; }
  rappelPrinting = true;
  const originalTitle = document.title;
  let root;
  const finish = () => {
    window.removeEventListener('afterprint',finish);
    root?.remove(); document.title = originalTitle;
    document.body.classList.remove('rappelPrinting');
    $('print').disabled = false; rappelPrinting = false;
  };
  try {
    $('pdfMenu').open = false; $('print').disabled = true;
    if (document.fonts?.ready) await document.fonts.ready;
    root = document.createElement('div'); root.className = 'rappelPrintRoot';
    document.body.appendChild(root);
    for (const section of selection) {
      const sources = section === 'headline' ? [$('headline')] : [...$(section).querySelectorAll('.exportable')];
      for (const source of sources) {
        const block = prepareRappelPrintBlock(source);
        if (block.querySelector('.life-table')) appendRappelPrintTable(root,section,block);
        else {
          const {frame} = rappelPrintPage(root,section);
          frame.appendChild(block); fitRappelPrintBlock(frame,block);
        }
      }
    }
    const pages = [...root.querySelectorAll('.rappelPrintPage')];
    if (!pages.length) throw new Error('PDF: geen pagina’s aangemaakt.');
    pages.forEach((page,index) => page.querySelector('.rappelPrintPageNumber').textContent = (index + 1) + ' / ' + pages.length);
    document.body.classList.add('rappelPrinting');
    document.title = lang === 'fr' ? 'Dashboard chiffres de rappel vie' : 'Dashboard rappelcijfers life';
    window.addEventListener('afterprint',finish,{once:true});
    window.print();
  } catch (error) {
    finish(); message((lang === 'fr' ? 'Impossible de préparer le PDF : ' : 'PDF kon niet worden voorbereid: ') + error.message,true);
  }
}
function showChartTooltip(event) {
  const segment=event.target.closest?.('[data-chart-tooltip]');
  if(!segment)return;
  const tooltip=$('chartTooltip');
  tooltip.textContent=segment.dataset.chartTooltip;
  tooltip.classList.remove('hidden');
  const rect=segment.getBoundingClientRect();
  const x=Number.isFinite(event.clientX)?event.clientX:rect.left+rect.width/2;
  const y=Number.isFinite(event.clientY)?event.clientY:rect.top+rect.height/2;
  tooltip.style.left=Math.max(8,Math.min(x+14,window.innerWidth-tooltip.offsetWidth-8))+'px';
  tooltip.style.top=Math.max(8,Math.min(y+14,window.innerHeight-tooltip.offsetHeight-8))+'px';
}
function init() {
  renderStatic();
  ['pick','replace'].forEach(id => $(id).addEventListener('click',e => {e.stopPropagation();$('file').click();}));
  $('dropzone').addEventListener('click',()=>$('file').click());
  $('dropzone').addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();$('file').click();}});
  $('file').addEventListener('change',e=>importFiles(e.target.files));
  ['dragover','dragenter'].forEach(ev=>$('dropzone').addEventListener(ev,e=>{e.preventDefault();$('dropzone').classList.add('dragging');}));
  ['dragleave','drop'].forEach(ev=>$('dropzone').addEventListener(ev,e=>{e.preventDefault();$('dropzone').classList.remove('dragging');if(ev==='drop')importFiles(e.dataTransfer.files);}));
  window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
  $('commit').addEventListener('click',commit);
  $('cancel').addEventListener('click',()=>{++importRequest;state.pending=null;state.workbook=null;$('importPreview').classList.add('hidden');message(state.records.length?t('loaded'):t('ready'));});
  $('sheet').addEventListener('change',e=>{try{const records=C.parseGrid(sheetGrid(state.workbook.Sheets[e.target.value]));state.pending.records=records;state.pending.sheet=e.target.value;preview();$('commit').disabled=false;message(t('preview'));}catch(err){$('commit').disabled=true;message(err.message,true);}});
  $('language').addEventListener('change',e=>{lang=e.target.value;renderStatic();});
  document.addEventListener('change',e=>{const key=e.target.dataset.multi;if(!key)return;const values=selections(['groupProducts','groupProductionTypes','detailProducts','detailProductionTypes','detailFiscal'].includes(key)?state[key]:state.filters[key]);setMultiSelection(key,e.target.checked?[...new Set([...values,e.target.value])]:values.filter(v=>v!==e.target.value));});
  document.addEventListener('click',e=>{const button=e.target.closest('[data-multi-clear],[data-multi-all]');if(!button)return;const key=button.dataset.multiClear||button.dataset.multiAll;setMultiSelection(key,button.hasAttribute('data-multi-all')?[...button.closest('.life-multiselect').querySelectorAll('[data-multi]')].map(input=>input.value):[]);});
  document.addEventListener('input',e=>{if(e.target.hasAttribute('data-multi-search'))filterMultiOptions(e.target.closest('.life-multiselect'));});
  document.addEventListener('click',e=>{if(!e.target.closest('.life-multiselect'))document.querySelectorAll('.life-multiselect[open]').forEach(menu=>menu.open=false);});
  $('filters').addEventListener('input',e=>{if(e.target.dataset.filter==='search'){state.filters.search=e.target.value;state.page=0;renderData();}});
  $('filters').addEventListener('click',e=>{if(e.target.id==='reset'){state.filters={groupId:'',policy:'',type:'',product:'',producer:'',search:''};state.page=0;renderFilters();renderData();}});
  $('tabs').addEventListener('click',e=>{const button=e.target.closest('[data-tab]');if(button){state.tab=button.dataset.tab;$('tabs').querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-pressed',x===button));renderFilters();renderData();}});
  document.addEventListener('click',e=>{
    const viewButton=e.target.closest('[data-kpi-view]');
    if(viewButton){state.headlineView=viewButton.dataset.kpiView==='overview'?'overview':'compact';renderData();document.querySelector(`[data-kpi-view="${state.headlineView}"]`)?.focus();return;}
    const button=e.target.closest('[data-sort-table]');if(!button)return;
    const sort=state.sorts[button.dataset.sortTable],key=button.dataset.sortKey;
    sort.direction=sort.key===key?(sort.direction==='asc'?'desc':'asc'):'desc';sort.key=key;
    state.page=0;renderData();
  });
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.excel==='detail')exportDetailExcel();if(b.dataset.excel==='groups')exportGroupsExcel();if(b.dataset.png)exportImage(b.dataset.png,false);if(b.dataset.copy)exportImage(b.dataset.copy,true);if(b.dataset.page){state.page+=Number(b.dataset.page);renderDetail(selected());}});
  $('groups').addEventListener('change',e=>{const key=e.target.dataset.chartMode;if(key){state.chartModes[key]=e.target.value;renderData();}});
  $('groups').addEventListener('click',e=>{if(e.target.closest('#resetGroupFilters')){state.groupProducts=[];state.groupProductionTypes=[];renderData();}});
  $('detail').addEventListener('click',e=>{if(e.target.closest('#resetDetailFilters')){state.detailProducts=[];state.detailProductionTypes=[];state.detailFiscal=[];state.page=0;renderData();}});
  $('csv').addEventListener('click',csvExport);$('print').addEventListener('click',printPdf);
  $('pdfSelectAll').addEventListener('click',()=>selectPdfSections(true));
  $('pdfSelectNone').addEventListener('click',()=>selectPdfSections(false));
  $('version').addEventListener('click',()=>$('release').showModal());
  $('lifeTop').addEventListener('click',()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  window.addEventListener('scroll',()=>$('lifeTop').classList.toggle('hidden',window.scrollY<250),{passive:true});
  document.addEventListener('pointerover',showChartTooltip);
  document.addEventListener('pointermove',showChartTooltip);
  document.addEventListener('focusin',showChartTooltip);
  ['pointerout','focusout'].forEach(event=>document.addEventListener(event,e=>{if(e.target.closest?.('[data-chart-tooltip]'))$('chartTooltip').classList.add('hidden');}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('chartTooltip').classList.add('hidden');document.querySelectorAll('.life-multiselect[open]').forEach(menu=>menu.open=false);}});
  window.addEventListener('scroll',()=>$('chartTooltip').classList.add('hidden'),true);
}
if (typeof document !== 'undefined') init();
