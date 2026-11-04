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
        rate: read('rate',true),commission: Math.round(read('commission') * 100),
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
  const api = {TYPES, number, parseGrid, totals, groupBy, share,isSingleGroupHeader};
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
  title:['Dashboard life VIVIUM','Tableau de bord chiffres clés vie VIVIUM'],
  lead:['Importeer je Excel-detailrapport <strong>Detail rappel sparen</strong> (onder "Reporting") uit SalesForce (op koepelniveau). Bekijk productie, premies en de bijdrage van elke groep, voor NZ, VH, KP en NK.','Importez votre rapport Excel détaillé <strong>Detail rappel sparen</strong> (sous « Reporting ») depuis SalesForce (au niveau de la coupole). Analysez la production, les primes et la contribution de chaque groupe pour NZ, VH, KP et NK.'],
  benefit1:['Automatische analyse','Analyse automatique'],benefit2:['Productie & premies','Production et primes'],benefit3:['Lokaal verwerkt','Traitement local'],eyebrow:['Cijfers life','Chiffres clés vie'],
  upload:['Sleep je Excel hierheen','Déposez votre Excel ici'],uploadHint:['of klik om één .xls- of .xlsx-bestand te kiezen','ou cliquez pour choisir un fichier .xls ou .xlsx'],
  pick:['Importeer Excel','Importer Excel'],ready:['Klaar om je Life-rapport te verwerken','Prêt à analyser votre rapport Vie'],empty:['Importeer een Excel-bestand om het dashboard te openen.','Importez un fichier Excel pour ouvrir le tableau de bord.'],
  preview:['Import controleren','Vérifier l’import'],commit:['Import bevestigen','Confirmer l’import'],cancel:['Annuleren','Annuler'],sheet:['Werkblad','Feuille'],source:['Excel import & controle','Import Excel et contrôle'],importAction:['Importeer','Importer'],importOk:['Importcontrole OK','Contrôle d’import OK'],
  csv:['Download CSV','Télécharger CSV'],pdf:['Exporteer PDF','Exporter PDF'],pdfSections:['PDF-secties','Sections PDF'],allSelect:['Alles selecteren','Tout sélectionner'],noneSelect:['Niets selecteren','Tout désélectionner'],print:['Print naar PDF','Imprimer en PDF'],export:['Exporteren','Exporter'],
  summary:['Samenvatting','Résumé'],groups:['Verdelingen','Répartitions'],detail:['Detail','Détail'],
  count:['Aantal productieregels','Nombre de lignes de production'],shortCount:['Aantal','Nombre'],unweighted:['Premie voor weging','Prime avant pondération'],weighted:['Premie na weging','Prime après pondération'],commission:['Rappelcommissie','Commission de rappel'],policies:['Aantal unieke polissen','Nombre de polices distinctes'],clients:['Aantal unieke klanten','Nombre de clients distincts'],
  showWeighted:['Toon premie na weging','Afficher la prime après pondération'],
  productionPie:['Verdeling premie per type productie','Répartition des primes par type de production'],commissionPie:['Verdeling rappelcommissie per type','Répartition des commissions de rappel par type'],
  all:['Alle','Tous'],group:['Groep','Groupe'],type:['Type productie','Type de production'],product:['Product','Produit'],producer:['Producentnummer','Numéro de producteur'],search:['Zoek polis of klant','Rechercher police ou client'],reset:['Filters wissen','Effacer les filtres'],
  NZ:['Nieuwe zaken','Affaires nouvelles'],VH:['Verhogingen','Augmentations'],KP:['Koopsom','Prime unique'],KO:['Koopsom','Prime unique'],NK:['Nieuwe koopsom','Nouvelle prime unique'],selected:['geselecteerd','sélectionnés'],
  total:['Totaal Life','Total Vie'],byType:['Productie per type','Production par type'],share:['Aandeel','Part'],countShare:['Aandeel aantal','Part du nombre'],unweightedShare:['Aandeel premie vóór weging','Part prime avant pondération'],weightedShare:['Aandeel premie na weging','Part prime après pondération'],
  commissionShare:['Aandeel rappelcommissie','Part de la commission de rappel'],
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
const state = {records:[],pending:null,workbook:null,source:'',sheet:'',tab:'summary',metric:'unweighted',showWeighted:false,page:0,
  filters:{groupId:'',policy:'',type:'',product:'',producer:'',search:''},countType:'',groupProducts:[],groupProductionTypes:[],detailProducts:[],detailProductionTypes:[],chartModes:{unweighted:'pie',count:'pie',commission:'pie'},
  sorts:{groups:{key:'unweighted',direction:'desc'},detail:{key:'policy',direction:'asc'}}};
const sections = ['summary','groups','detail'];
function singleGroupFile(){return state.records[0]?.sourceLayout==='single-group';}
function visibleSections(){return sections.filter(id=>id!=='groups'||!singleGroupFile()||new Set(state.records.map(r=>r.producer).filter(Boolean)).size>1);}
const visibleFields = keys => keys.filter(key => (state.showWeighted || !['weighted','weightedShare'].includes(key))&&(!singleGroupFile()||!['groupNo','groupName'].includes(key)));
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
  if(id==='detail-table')return `<div class="life-export blockExportActions" data-html2canvas-ignore><button type="button" class="blockExportBtn life-excel-export" data-excel="detail" aria-label="Export naar Excel" title="Export naar Excel">${svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m8 12 6 6m0-6-6 6M17 12h1m-1 3h1m-1 3h1"/>')}</button><button type="button" class="blockExportBtn blockExportCopy" data-copy="${id}" aria-label="Copy naar geheugen" title="Copy naar geheugen">${svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>')}</button></div>`;
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
function metricValue(rows,key) {
  if(key==='policies')return new Set(rows.map(r=>r.policy)).size;
  if(key==='clients')return new Set(rows.map(r=>r.client.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('nl-BE')).filter(Boolean)).size;
  return C.totals(rows)[key];
}
function metrics(total,rows) {
  return `<div class="life-kpis ${state.showWeighted ? '' : 'life-kpis-unweighted'}">${visibleFields(['unweighted','weighted','commission','policies','clients']).map(key => {
    const value = ['policies','clients'].includes(key) ? fmt(total[key]) : money(total[key]);
    const bars=types().map((code,i)=>{
      const amount=metricValue(rows.filter(r=>r.type===code),key),share=C.share(amount,total[key]);
      const amountLabel=['policies','clients'].includes(key)?fmt(amount):money(amount);
      const label=`${typeLabel(code)}: ${amountLabel} (${pct(share)})`;
      return `<div class="life-kpi-contribution" title="${esc(label)}"><div class="life-kpi-contribution-label"><span><i style="background:${colors[i%colors.length]}"></i>${esc(typeLabel(code))}</span><span>${amountLabel} (${pct(share)})</span></div><div class="life-kpi-contribution-track" role="img" aria-label="${esc(label)}"><span style="background:${colors[i%colors.length]};width:${Math.max(0,Math.min(100,share||0))}%"></span></div></div>`;
    }).join('');
    const note=['policies','clients'].includes(key)?(lang==='fr'?'Une police ou un client peut figurer dans plusieurs types.':'Een polis of klant kan in meerdere types voorkomen.'):'';
    return `<div class="kpi"><div class="label">${t(key)}</div><div class="value">${value}</div><div class="life-kpi-contributions" title="${esc(note)}">${bars}</div></div>`;
  }).join('')}</div>`;
}
function typeCards(rows) {
  const total = C.totals(rows);
  return `<div class="life-kpis life-type-kpis">${types().map((code) => {
    const a = C.totals(rows.filter(r => r.type === code));
    return `<div class="kpi" style="--type-color:${colors[types().indexOf(code) % colors.length]}"><div class="label">${esc(typeLabel(code))}</div><div class="value">${fmt(a.count)}</div><div class="life-share">${t('countShare')}: ${percent(a.count,total.count)}</div>${visibleFields(['unweighted','weighted']).map(key => `<div class="life-metric"><span>${t(key)}</span><strong>${money(a[key])}</strong></div><div class="life-share">${t('share')}: ${percent(a[key],total[key])}</div>`).join('')}</div>`;
  }).join('')}</div>`;
}
function sortedRows(rows,tableId) {
  const {key,direction}=state.sorts[tableId];
  const field={groupNo:'groupId',shortCount:'count'}[key]||key;
  return [...rows].sort((a,b)=>{
    const x=a[field],y=b[field];
    if(x==null||y==null)return x==null?(y==null?0:1):-1;
    const order=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),lang==='fr'?'fr-BE':'nl-BE',{numeric:true,sensitivity:'base'});
    return direction==='asc'?order:-order;
  });
}
function table(headers,rows,footer='',sort=null) {
  return `<div class="life-table-wrap"><table class="life-table"><thead><tr>${headers.map((x,i) => {
    if(!sort)return `<th scope="col"${i===0?' class="life-text-heading"':''}>${esc(x)}</th>`;
    const key=sort.keys[i],current=state.sorts[sort.id],active=current.key===key;
    const direction=active?(current.direction==='asc'?'ascending':'descending'):'none';
    const textColumn=['id','policy','client','type','groupNo','groupName','producer','product'].includes(key);
    return `<th scope="col"${textColumn?' class="life-text-heading"':''} aria-sort="${direction}"><button type="button" class="life-sort-button" data-sort-table="${sort.id}" data-sort-key="${key}">${esc(x)}<span aria-hidden="true">${active?(current.direction==='asc'?'▲':'▼'):'↕'}</span></button></th>`;
  }).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}">${t('noData')}</td></tr>`}</tbody>${footer ? `<tfoot>${footer}</tfoot>` : ''}</table></div>`;
}
function aggregateTable(rows,key) {
  const total = C.totals(rows);
  const aggregates = key === 'type' ? types().map(id => ({id,...C.totals(rows.filter(r => r.type === id))})) : sortedRows(C.groupBy(rows,key).map(g=>({...g,countShare:C.share(g.count,total.count),unweightedShare:C.share(g.unweighted,total.unweighted),weightedShare:C.share(g.weighted,total.weighted),commissionShare:C.share(g.commission,total.commission)})),'groups');
  const dataCells = a => `<td>${fmt(a.count)}</td><td>${percent(a.count,total.count)}</td><td>${money(a.unweighted)}</td><td>${percent(a.unweighted,total.unweighted)}</td>${state.showWeighted ? `<td>${money(a.weighted)}</td><td>${percent(a.weighted,total.weighted)}</td>` : ''}<td>${money(a.commission)}</td><td>${percent(a.commission,total.commission)}</td>`;
  return table([t(key === 'groupId' ? (singleGroupFile()?'fileTotal':'group') : key),...visibleFields(['shortCount','countShare','unweighted','unweightedShare','weighted','weightedShare','commission','commissionShare']).map(t)],
    aggregates.map(a => `<tr><td>${key === 'groupId' ? groupMarkup(a.id) : esc(key === 'type' ? typeLabel(a.id) : a.id)}</td>${dataCells(a)}</tr>`),`<tr><td>${t('total')}</td>${dataCells(total)}</tr>`,key!=='type'?{id:'groups',keys:['id',...visibleFields(['shortCount','countShare','unweighted','unweightedShare','weighted','weightedShare','commission','commissionShare'])]}:null);
}
function bars(rows,key) {
  const total = C.totals(rows)[key];
  return `<div class="life-bars">${types().map((code,i) => { const value = C.totals(rows.filter(r => r.type === code))[key];
    return `<div><div class="life-bar-label"><span>${esc(typeLabel(code))}</span><strong>${key === 'count' ? fmt(value) : money(value)} · ${percent(value,total)}</strong></div><div class="life-bar-track"><span style="background:${colors[i % colors.length]};width:${Math.max(0,Math.min(100,C.share(value,total) || 0))}%"></span></div></div>`;
  }).join('')}</div>`;
}
function groupColor(id) { const ids = [...new Set(state.records.map(r => singleGroupFile()?r.producer:r.groupId))].sort(); const i = ids.indexOf(id); return i < colors.length ? colors[i] : `hsl(${(i * 137.508) % 360},48%,44%)`; }
function donut(parts,total,metric = state.metric,label = t('groupShare')) {
  if (total <= 0 || parts.some(p => p.value < 0)) return `<div class="life-empty-chart">${t('noPie')}</div>`;
  let angle = -Math.PI / 2;
  const positive = parts.filter(p => p.value > 0);
  const paths = positive.map(p => {
    const start = angle, delta = p.value / total * Math.PI * 2; angle += delta;
    const tooltip = esc(`${p.label}: ${metric === 'count' ? fmt(p.value) : money(p.value)} (${percent(p.value,total)})`);
    const attributes = `tabindex="0" aria-label="${tooltip}" data-chart-tooltip="${tooltip}"`;
    if (positive.length === 1) return `<circle cx="100" cy="100" r="86" fill="${p.color}" ${attributes}><title>${tooltip}</title></circle>`;
    return `<path d="M100,100 L${100+86*Math.cos(start)},${100+86*Math.sin(start)} A86,86 0 ${delta > Math.PI ? 1 : 0},1 ${100+86*Math.cos(angle)},${100+86*Math.sin(angle)} Z" fill="${p.color}" stroke="white" stroke-width="1" ${attributes}><title>${tooltip}</title></path>`;
  }).join('');
  return `<svg class="life-donut" viewBox="0 0 200 200" role="img" aria-label="${esc(label)}">${paths}<g pointer-events="none"><circle cx="100" cy="100" r="53" fill="white"/><text x="100" y="94" text-anchor="middle" fill="#4d4d4d" font-size="10" font-family="Arial">${esc(t('total'))}</text><text x="100" y="115" text-anchor="middle" fill="#0d1473" font-size="13" font-weight="bold" font-family="Arial">${esc(metric === 'count' ? fmt(total) : money(total))}</text></g></svg>`;
}
function summaryCharts(rows) {
  return `<div class="life-chart-grid life-summary-charts">${['unweighted','commission'].map(key => {
    const title = t(key === 'unweighted' ? 'productionPie' : 'commissionPie');
    const parts = types().map((code,i) => {const data=rows.filter(r=>r.type===code);return {label:typeLabel(code),count:data.length,value:C.totals(data)[key],color:colors[i % colors.length]};});
    const total = C.totals(rows)[key];
    return card(`summary-pie-${key}`,title,`<p class="small">${t(key)}</p><div class="life-chart-body">${donut(parts,total,key,title)}<table class="life-legend life-summary-legend"><thead><tr><th>${t('type')}</th><th>${t('shortCount')}</th><th>${t(key)}</th></tr></thead><tbody>${parts.map(p => `<tr><td><span class="life-swatch" style="background:${p.color}"></span>${esc(p.label)}</td><td>${fmt(p.count)}</td><td>${money(p.value)}<small>${percent(p.value,total)}</small></td></tr>`).join('')}</tbody></table></div>`);
  }).join('')}</div>`;
}
function charts(rows) {
  return `<div class="life-chart-grid">${['unweighted','count','commission'].map((key) => {
    const countTypes=selections(state.countType);
    const data = !singleGroupFile() && key === 'count' && countTypes.length ? rows.filter(r => countTypes.includes(r.type)) : rows;
    const parts = C.groupBy(data,singleGroupFile()?'producer':'groupId').map(g => ({groupId:g.id,label:singleGroupFile()?`${t('producer')} ${g.id}`:groupLabel(g.id),value:g[key],color:groupColor(g.id)})).sort((a,b) => b.value-a.value);
    const itemLabel=p=>singleGroupFile()?esc(p.label):groupMarkup(p.groupId);
    const total = C.totals(data)[key], id = `group-chart-${key}`;
    const title = `${singleGroupFile()?(lang==='fr'?'Part par producteur':'Aandeel per producent'):t('groupShare')} · ${t(key === 'count' ? 'countByType' : key)}`;
    const selector = key === 'count' && !singleGroupFile() ? `<div class="life-count-selector" data-html2canvas-ignore>${multiDropdown('countType',t('type'),types(),countTypes)}</div><p class="small">${esc(countTypes.length?countTypes.map(typeLabel).join(', '):t('all'))}</p>` : '';
    const mode=state.chartModes[key];
    const controls=`<select class="life-chart-mode" data-chart-mode="${key}" aria-label="${esc(title)}: ${lang==='fr'?'type de graphique':'grafiektype'}" data-html2canvas-ignore><option value="pie" ${mode==='pie'?'selected':''}>${lang==='fr'?'Camembert':'Taartgrafiek'}</option><option value="bar" ${mode==='bar'?'selected':''}>${lang==='fr'?'Barres':'Balkgrafiek'}</option></select>`;
    const figure=mode==='bar'?`<div class="life-group-bars">${parts.map(p=>`<div class="life-group-bar-row"><div class="life-bar-label"><strong>${itemLabel(p)}</strong></div><div class="life-bar-track" role="img" aria-label="${esc(p.label)}: ${key==='count'?fmt(p.value):money(p.value)} (${percent(p.value,total)})"><span style="background:${p.color};width:${Math.max(0,Math.min(100,C.share(p.value,total)||0))}%"></span><strong class="life-bar-value">${key==='count'?fmt(p.value):money(p.value)} (${percent(p.value,total)})</strong></div></div>`).join('')||`<p>${t('noData')}</p>`}</div>`:donut(parts,total,key,title);
    const legend=mode==='pie'?`<table class="life-legend"><caption class="small">${t(singleGroupFile()?'producer':'group')} · ${t(key)} · ${t('share')}</caption><tbody>${parts.map(p => `<tr><td><div class="life-legend-group"><span class="life-swatch" style="background:${p.color}"></span>${itemLabel(p)}</div></td><td>${key === 'count' ? fmt(p.value) : money(p.value)} (${percent(p.value,total)})</td></tr>`).join('') || `<tr><td>${t('noData')}</td></tr>`}</tbody></table>`:'';
    return card(id,title,`${selector}<div class="life-chart-body ${mode==='pie'?'life-pie-split':'life-bar-full'}">${figure}${legend}</div>`,controls);
  }).join('')}</div>`;
}
function multiDropdown(key,label,ids,values,open=false) {
  const text=id=>key==='groupId'?groupLabel(id):['countType','groupProductionTypes','detailProductionTypes'].includes(key)?typeLabel(id):id;
  const summary=values.length===1?text(values[0]):values.length?`${values.length} ${t('selected')}`:t('all');
  return `<div class="life-filter-field"><span>${esc(label)}</span><details class="life-multiselect" id="multi-${key}" ${open?'open':''}><summary>${esc(summary)}<span aria-hidden="true">⌄</span></summary><div class="life-multiselect-options" role="group" aria-label="${esc(label)}"><button type="button" class="life-button" data-multi-clear="${key}">${t('all')}</button>${ids.map(id=>`<label><input type="checkbox" data-multi="${key}" value="${esc(id)}" ${values.includes(id)?'checked':''}>${key==='groupId'?groupMarkup(id):`<span>${esc(text(id))}</span>`}</label>`).join('')}</div></details></div>`;
}
function renderFilters(openKey='') {
  const producerOnly=singleGroupFile()&&state.tab==='groups';
  const keys = producerOnly?['producer']:[singleGroupFile()?'policy':'groupId','producer'];
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
function setMultiSelection(key,values) {
  if(key==='countType')state.countType=values;
  else if(key==='groupProducts')state.groupProducts=values;
  else if(key==='groupProductionTypes')state.groupProductionTypes=values;
  else if(key==='detailProducts')state.detailProducts=values;
  else if(key==='detailProductionTypes')state.detailProductionTypes=values;
  else {
    state.filters[key]=values;
    if(['groupId','policy'].includes(key))state.filters.producer=selections(state.filters.producer).filter(id=>state.records.some(r=>(!values.length||values.includes(r[key]))&&r.producer===id));
    renderFilters(key);
  }
  state.page=0;renderData();
  if(key==='countType')$('multi-countType').open=true;
  if(key==='groupProducts')$('multi-groupProducts').open=true;
  if(key==='groupProductionTypes')$('multi-groupProductionTypes').open=true;
  if(['detailProducts','detailProductionTypes'].includes(key))$('multi-'+key).open=true;
}
function filterDetailRows(rows){return rows.filter(r=>(!state.detailProducts.length||state.detailProducts.includes(r.product))&&(!state.detailProductionTypes.length||state.detailProductionTypes.includes(r.type)));}
function renderDetail(rows) {
  rows=filterDetailRows(rows);
  const size = 50, maxPage = Math.max(0,Math.ceil(rows.length/size)-1); state.page = Math.min(state.page,maxPage);
  const subset = sortedRows(rows,'detail').slice(state.page*size,(state.page+1)*size);
  const columns=detailColumns();
  const html = table(columns.map(t),subset.map(r => `<tr>${columns.map(key=>{
    const value=key==='type'?typeLabel(r.type):key==='groupNo'?r.groupId:['unweighted','weighted','commission'].includes(key)?money(r[key]):key==='rate'?pct(r.rate):r[key];
    return `<td${['client','type','groupNo','groupName','producer','product','productionMonth'].includes(key)?' class="text"':''}>${esc(value)}</td>`;
  }).join('')}</tr>`),'',{id:'detail',keys:columns});
  const products=[...new Set(state.records.map(r=>r.product))].sort((a,b)=>a.localeCompare(b,lang==='fr'?'fr-BE':'nl-BE'));
  const controls=`<div class="life-group-table-filters" data-html2canvas-ignore>${multiDropdown('detailProducts',t('product'),products,state.detailProducts)}${multiDropdown('detailProductionTypes',t('type'),types(),state.detailProductionTypes)}<button type="button" class="life-button" id="resetDetailFilters">${t('reset')}</button></div>`;
  $('detail').innerHTML = card('detail-table',t('detail'),`${controls}<p class="small">${t('product')}: ${esc(state.detailProducts.length?state.detailProducts.join(', '):t('all'))} · ${t('type')}: ${esc(state.detailProductionTypes.length?state.detailProductionTypes.map(typeLabel).join(', '):t('all'))}</p><p class="small">${t('recordNote')} ${t('csv')}: ${fmt(rows.length)} ${t('count').toLowerCase()}.</p>${html}<div class="life-pagination" data-html2canvas-ignore><span>${rows.length ? fmt(state.page*size+1) : 0}–${fmt(Math.min((state.page+1)*size,rows.length))} / ${fmt(rows.length)}</span><div><button class="life-button" data-page="-1" ${state.page === 0 ? 'disabled' : ''}>${t('prev')}</button> <button class="life-button" data-page="1" ${state.page === maxPage ? 'disabled' : ''}>${t('next')}</button></div></div>`);
}
function renderData() {
  if (!state.records.length) return;
  if(!visibleSections().includes(state.tab))state.tab='summary';
  $('chartTooltip').classList.add('hidden');
  if (!state.showWeighted && state.metric === 'weighted') state.metric = 'unweighted';
  if (!state.showWeighted) Object.values(state.sorts).forEach(sort=>{if(['weighted','weightedShare'].includes(sort.key))sort.key=sort.key==='weighted'?'unweighted':'unweightedShare';});
  const rows = selected(), total = C.totals(rows);
  total.policies = new Set(rows.map(r => r.policy)).size;
  total.clients = new Set(rows.map(r => r.client.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('nl-BE')).filter(Boolean)).size;
  $('headline').innerHTML = head(t('total'),'headline') + metrics(total,rows);
  $('summary').innerHTML = summaryCharts(rows) + card('summary-types',t('byType'),typeCards(rows)) + card('summary-table',t('summary'),aggregateTable(rows,'type'));
  const productOptions=[...new Set(state.records.map(r=>r.product))].sort((a,b)=>a.localeCompare(b,lang==='fr'?'fr-BE':'nl-BE'));
  const groupRows=rows.filter(r=>(!state.groupProducts.length||state.groupProducts.includes(r.product))&&(!state.groupProductionTypes.length||state.groupProductionTypes.includes(r.type)));
  const productFilter=`<div class="life-group-table-filters" data-html2canvas-ignore>${multiDropdown('groupProducts',t('product'),productOptions,state.groupProducts)}${multiDropdown('groupProductionTypes',t('type'),types(),state.groupProductionTypes)}<button type="button" class="life-button" id="resetGroupFilters">${t('reset')}</button></div><p class="small">${t('product')}: ${esc(state.groupProducts.length?state.groupProducts.join(', '):t('all'))} · ${t('type')}: ${esc(state.groupProductionTypes.length?state.groupProductionTypes.map(typeLabel).join(', '):t('all'))}</p>`;
  const distributionRows=singleGroupFile()?state.records.filter(r=>!selections(state.filters.producer).length||selections(state.filters.producer).includes(r.producer)):rows;
  $('groups').innerHTML = singleGroupFile()?card('groups-table',lang==='fr'?'Totaux par producteur':'Producenttotalen',aggregateTable(distributionRows,'producer'))+charts(distributionRows):card('groups-table',t('groupTotal'),productFilter+aggregateTable(groupRows,'groupId'))+charts(rows);
  renderDetail(rows);
  sections.forEach(id => $(id).classList.toggle('hidden',id !== state.tab));
}
function renderStatic() {
  if(!visibleSections().includes(state.tab))state.tab='summary';
  document.documentElement.lang = lang;
  $('showWeightedLabel').textContent = t('showWeighted');
  $('heroEyebrow').textContent = t('eyebrow');
  $('replace').textContent = t('importAction');
  $('lifeTop').setAttribute('aria-label',lang==='fr'?'Retour en haut':'Ga naar boven');
  $('lifeTop').setAttribute('title',lang==='fr'?'Retour en haut':'Ga naar boven');
  if (state.records.length) $('source').textContent = `Excel: ${state.source} · ${fmt(state.records.length)} ${t('count').toLowerCase()} · ${singleGroupFile()?'A–M · ':''}${t('importOk')}`;
  $('showWeighted').checked = state.showWeighted;
  const labels = {pageTitle:'title',lead:'lead',benefit1:'benefit1',benefit2:'benefit2',benefit3:'benefit3',uploadTitle:'upload',uploadHint:'uploadHint',pick:'pick',previewTitle:'preview',commit:'commit',cancel:'cancel',sheetLabel:'sheet',sourceTitle:'source',csv:'csv',pdfLabel:'pdf',pdfSections:'pdfSections',print:'print',empty:'empty',footer:'footer',releaseText:'release'};
  Object.entries(labels).forEach(([id,key]) => {if(id==='lead')$(id).innerHTML=t(key);else $(id).textContent=t(key);});
  $('dropzone').setAttribute('aria-label',t('pick'));
  const tabIcons={summary:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',groups:'<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M15 3.5a9 9 0 0 1 5.5 5.5H15z"/>',detail:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>'};
  $('tabs').innerHTML = visibleSections().map(id => `<button class="tab ${id === state.tab ? 'active' : ''}" data-tab="${id}" aria-pressed="${id === state.tab}"><svg class="life-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tabIcons[id]}</svg><span>${t(id)}</span></button>`).join('');
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
  state.countType = '';
  state.groupProducts = [];
  state.groupProductionTypes = [];
  state.detailProducts = [];state.detailProductionTypes = [];
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
  saveBlob(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'}),'dashboardlife.csv');
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
    saveBlob(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'dashboardlife-detail.xlsx');
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
function pdfSelection() { return [...document.querySelectorAll('[data-section]:checked')].map(x => x.dataset.section); }
function exportTargets(selection) {
  return selection.flatMap(id => id === 'headline' ? ['headline'] : [...$(id).querySelectorAll('.exportable')].map(x => x.id));
}
async function exportPdf() {
  const selection = pdfSelection(); if (!selection.length) {message(t('noSections'),true);return;}
  if (!window.jspdf) {message('jsPDF ontbreekt in libs.',true);return;}
  $('pdf').disabled = true; message(t('busy'));
  try {
    const pdf = new jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true}); let page=0;
    for (const id of exportTargets(selection)) {
      const canvas = await canvasFor(id);
      const width=273, maxHeight=176, sliceHeight=Math.floor(maxHeight/width*canvas.width);
      for (let offset=0; offset<canvas.height; offset+=sliceHeight) {
        if (page++) pdf.addPage();
        pdf.setFontSize(10);pdf.text('VIVIUM Life',12,9);
        const piece=document.createElement('canvas');piece.width=canvas.width;piece.height=Math.min(sliceHeight,canvas.height-offset);
        piece.getContext('2d').drawImage(canvas,0,offset,piece.width,piece.height,0,0,piece.width,piece.height);
        pdf.addImage(piece.toDataURL('image/jpeg',.92),'JPEG',12,15,width,piece.height*width/piece.width);
        pdf.setFontSize(8);pdf.text(`${page}`,280,202);
      }
    }
    pdf.save('dashboardlife.pdf');message('PDF ✓');$('pdfMenu').open=false;
  } catch(e) {message(e.message,true);} finally {$('pdf').disabled=false;}
}
function printPdf() {
  const selection=pdfSelection();if(!selection.length){message(t('noSections'),true);return;}
  ['headline',...sections].forEach(id=>$(id).classList.toggle('print-exclude',!selection.includes(id)));
  $('pdfMenu').open=false;window.print();
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
  $('showWeighted').addEventListener('change',e=>{state.showWeighted=e.target.checked;renderData();if(state.pending)preview();});
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
  document.addEventListener('change',e=>{const key=e.target.dataset.multi;if(!key)return;const values=selections(['countType','groupProducts','groupProductionTypes','detailProducts','detailProductionTypes'].includes(key)?state[key]:state.filters[key]);setMultiSelection(key,e.target.checked?[...new Set([...values,e.target.value])]:values.filter(v=>v!==e.target.value));});
  document.addEventListener('click',e=>{const button=e.target.closest('[data-multi-clear]');if(button)setMultiSelection(button.dataset.multiClear,[]);});
  document.addEventListener('click',e=>{if(!e.target.closest('.life-multiselect'))document.querySelectorAll('.life-multiselect[open]').forEach(menu=>menu.open=false);});
  $('filters').addEventListener('input',e=>{if(e.target.dataset.filter==='search'){state.filters.search=e.target.value;state.page=0;renderData();}});
  $('filters').addEventListener('click',e=>{if(e.target.id==='reset'){state.filters={groupId:'',policy:'',type:'',product:'',producer:'',search:''};state.page=0;renderFilters();renderData();}});
  $('tabs').addEventListener('click',e=>{const button=e.target.closest('[data-tab]');if(button){state.tab=button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>{x.classList.toggle('active',x===button);x.setAttribute('aria-pressed',x===button);});renderFilters();renderData();}});
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-sort-table]');if(!button)return;
    const sort=state.sorts[button.dataset.sortTable],key=button.dataset.sortKey;
    sort.direction=sort.key===key?(sort.direction==='asc'?'desc':'asc'):'desc';sort.key=key;
    state.page=0;renderData();
  });
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.excel)exportDetailExcel();if(b.dataset.png)exportImage(b.dataset.png,false);if(b.dataset.copy)exportImage(b.dataset.copy,true);if(b.dataset.page){state.page+=Number(b.dataset.page);renderDetail(selected());}});
  $('groups').addEventListener('change',e=>{const key=e.target.dataset.chartMode;if(key){state.chartModes[key]=e.target.value;renderData();}});
  $('groups').addEventListener('click',e=>{if(e.target.closest('#resetGroupFilters')){state.groupProducts=[];state.groupProductionTypes=[];renderData();}});
  $('detail').addEventListener('click',e=>{if(e.target.closest('#resetDetailFilters')){state.detailProducts=[];state.detailProductionTypes=[];state.page=0;renderData();}});
  $('csv').addEventListener('click',csvExport);$('print').addEventListener('click',printPdf);
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
