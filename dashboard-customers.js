/* Detail-export: bedragen blijven lokaal en worden per bestand gegroepeerd. */
function customerKey(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('nl-BE');
}

function customerPremium(value) {
  if (value == null || String(value).trim() === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  let text = String(value).trim().replace(/[\s\u00a0€]/g, '').replace(/−/g, '-');
  if (/^\(.*\)$/.test(text)) text = '-' + text.slice(1, -1);
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Onleesbare premie: ' + value);
  return Math.round(Number(text) * 100);
}

function buildCustomerTop(rows, name) {
  const gnr = /gnr/i.test(name);
  if (!gnr && !/prodnr/i.test(name)) throw new Error('De bestandsnaam moet GNR of Prodnr bevatten.');
  const headerIndex = rows.findIndex(row => row.some(cell => customerKey(cell) === 'prm nz'));
  if (headerIndex < 0) throw new Error('Kolomkop Prm NZ ontbreekt.');
  const headers = rows[headerIndex].map(customerKey);
  const column = (labels) => headers.findIndex(h => labels.includes(h));
  const customer = column(['klt vnm nm', 'klantnaam', 'klant naam']);
  const producer = column(['producent naam', 'producentnaam']);
  const product = column(['branche']);
  const nz = column(['prm nz']);
  const lapse = column(['prm verv']);
  if ([customer, product, nz, lapse].some(i => i < 0) || (gnr && producer < 0)) {
    throw new Error('Vereiste kolommen ontbreken: klantnaam, Prm NZ, Prm Verv, Branche en bij GNR Producent naam.');
  }
  const clients = new Map();
  let count = 0;
  rows.slice(headerIndex + 1).forEach((row, index) => {
    if (!row.some(cell => String(cell ?? '').trim())) return;
    const label = String(row[customer] ?? '').trim().replace(/\s+/g, ' ');
    let newPremium, lapsePremium;
    try {
      newPremium = customerPremium(row[nz]);
      lapsePremium = customerPremium(row[lapse]);
    } catch (err) { throw new Error(`Rij ${headerIndex + index + 2}: ${err.message}`); }
    if (!label) {
      if (newPremium || lapsePremium) throw new Error(`Klantnaam ontbreekt op rij ${headerIndex + index + 2}.`);
      return;
    }
    count++;
    const key = customerKey(label);
    if (!clients.has(key)) clients.set(key, { name: label, nz: 0, lapse: 0, nzTakken: new Map(), lapseTakken: new Map() });
    const entry = clients.get(key);
    entry.nz += newPremium;
    entry.lapse += lapsePremium;
    [['nz', newPremium], ['lapse', lapsePremium]].forEach(([metric, amount]) => {
      if (!amount) return;
      const branch = String(row[product] ?? '').trim().replace(/\s+/g, ' ') || 'Niet vermeld';
      const branches = entry[metric + 'Takken'];
      const branchKey = customerKey(branch);
      if (!branches.has(branchKey)) branches.set(branchKey, { name: branch, amount: 0, producers: new Set() });
      const detail = branches.get(branchKey);
      detail.amount += amount;
      if (gnr) detail.producers.add(String(row[producer] ?? '').trim() || 'Niet vermeld');
    });
  });
  if (!count) throw new Error('Geen klantgegevens gevonden.');
  const all = [...clients.values()];
  const byName = (a, b) => a.name.localeCompare(b.name, 'nl-BE');
  return {
    name, gnr, count, clients: all.length,
    nz: all.filter(c => c.nz > 0).sort((a, b) => b.nz - a.nz || byName(a, b)),
    lapse: all.filter(c => c.lapse < 0).sort((a, b) => a.lapse - b.lapse || byName(a, b))
  };
}

async function readCustomerRows(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Salesforce .xls exports are HTML with comma decimals. Keep their original
  // strings: automatic numeric inference would turn 1.234,56 into a wrong value.
  const prefix = new TextDecoder().decode(bytes.slice(0, 1024));
  if (/<(?:html|head|table)\b/i.test(prefix)) {
    const charset = /charset\s*=\s*["']?([\w-]+)/i.exec(prefix)?.[1] || 'utf-8';
    const doc = new DOMParser().parseFromString(new TextDecoder(charset).decode(bytes), 'text/html');
    const table = doc.querySelector('table');
    if (!table) throw new Error('Geen tabel gevonden.');
    return Array.from(table.rows, row => Array.from(row.cells, cell => cell.textContent.trim()));
  }
  const workbook = XLSX.read(bytes, { type: 'array' });
  if (workbook.SheetNames.length !== 1) throw new Error('Selecteer een detail-export met één werkblad.');
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: true });
}

function customerTakRows(client, metric) {
  return [...client[metric + 'Takken'].values()].filter(tak => tak.amount !== 0).sort((a, b) => a.name.localeCompare(b.name, 'nl-BE'));
}

function exportCustomerExcel(reports, fr, limit = 10) {
  const workbook = XLSX.utils.book_new();
  const text = (nl, french) => fr ? french : nl;
  const outputRows = [];
  const gnr = reports.some(report => report.gnr);
  const moneyCells = [];
  reports.forEach(report => {
    ['nz', 'lapse'].forEach(metric => {
      const title = metric === 'nz' ? text(`Top ${limit} — premie nieuwe zaken`, `Top ${limit} — primes affaires nouvelles`) : text(`Top ${limit} — premie verval`, `Top ${limit} — primes de chute`);
      const headers = ['#', text('Klantnaam', 'Client'), ...(gnr ? [text('Producent', 'Producteur')] : []), text('Tak', 'Branche'), text('Premie per tak', 'Prime par branche'), text('Totaal klant', 'Total client')];
      if (outputRows.length) outputRows.push([], []);
      outputRows.push([report.name], [title], headers);
      report[metric].slice(0, limit).forEach((client, i) => customerTakRows(client, metric).forEach((tak, j) => {
        const row = [i + 1, client.name, ...(gnr ? [[...tak.producers].sort().join('\n')] : []), tak.name, tak.amount / 100, j === 0 ? client[metric] / 100 : ''];
        moneyCells.push({ r: outputRows.length, c: headers.length - 2 }, { r: outputRows.length, c: headers.length - 1 });
        outputRows.push(row);
      }));
    });
  });
  const sheet = XLSX.utils.aoa_to_sheet(outputRows);
  sheet['!cols'] = [{ wch: 5 }, { wch: 36 }, ...(gnr ? [{ wch: 48 }] : []), { wch: 28 }, { wch: 20 }, { wch: 20 }];
  moneyCells.forEach(cell => { sheet[XLSX.utils.encode_cell(cell)].z = '#,##0.00 "€";[Red]-#,##0.00 "€"'; });
  XLSX.utils.book_append_sheet(workbook, sheet, text('Top klanten', 'Top clients'));
  XLSX.writeFile(workbook, `top-${limit}-klanten.xlsx`);
}

async function copyCustomerTable(button, fr) {
  const text = (nl, french) => fr ? french : nl;
  const label = button.textContent;
  const capture = document.createElement('div');
  capture.className = 'customerTopCapture';
  document.querySelectorAll('#customerTopReports > .customerTopReport').forEach(report => capture.append(report.cloneNode(true)));
  document.getElementById('customerTopDialog').append(capture);
  button.disabled = true;
  try {
    const blobPromise = (async () => {
      await document.fonts.ready;
      const canvas = await html2canvas(capture, {
        backgroundColor: '#ffffff', scale: 2, logging: false,
        onclone: (doc, element) => { element.style.left = '0'; element.style.top = '0'; }
      });
      return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG')), 'image/png'));
    })();
    let copied = false;
    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        // Start the clipboard write during the click, before rendering finishes.
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
        copied = true;
      } catch { /* A blocked clipboard still allows a PNG download below. */ }
    }
    if (copied) button.textContent = text('Gekopieerd!', 'Copié !');
    else {
      const blob = await blobPromise;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `top-${document.getElementById('customerTopLimit').value}-klanten.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      button.textContent = text('PNG gedownload', 'PNG téléchargé');
    }
  } catch {
    button.textContent = text('Mislukt — probeer opnieuw', 'Échec — réessayer');
  } finally {
    capture.remove();
    button.disabled = false;
    setTimeout(() => { button.textContent = label; }, 3500);
  }
}

function renderCustomerReports(reports, fr, limit) {
  const text = (nl, french) => fr ? french : nl;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const euros = new Intl.NumberFormat(fr ? 'fr-BE' : 'nl-BE', { style: 'currency', currency: 'EUR' });
  const table = (report, metric) => {
    const title = metric === 'nz' ? text(`Top ${limit} — premie nieuwe zaken`, `Top ${limit} — primes affaires nouvelles`) : text(`Top ${limit} — premie verval`, `Top ${limit} — primes de chute`);
    const widths = report.gnr ? [4, 22, 26, 16, 16, 16] : [4, 30, 30, 18, 18];
    const bodies = report[metric].slice(0, limit).map((client, i) => {
      const takken = customerTakRows(client, metric);
      return `<tbody class="customerTopClient">${takken.map((tak, j) => `<tr>${j === 0 ? `<td rowspan="${takken.length}">${i + 1}</td><td rowspan="${takken.length}">${escape(client.name)}</td>` : ''}${report.gnr ? `<td>${[...tak.producers].sort().map(escape).join('<br>')}</td>` : ''}<td>${escape(tak.name)}</td><td class="customerTopAmount">${escape(euros.format(tak.amount / 100))}</td>${j === 0 ? `<td rowspan="${takken.length}" class="customerTopAmount customerTopTotal">${escape(euros.format(client[metric] / 100))}</td>` : ''}</tr>`).join('')}</tbody>`;
    }).join('');
    return `<section class="customerTopTable"><h3>${title}</h3><div class="customerTopScroll"><table><colgroup>${widths.map(width => `<col style="width:${width}%">`).join('')}</colgroup><thead><tr><th>#</th><th>${text('Klantnaam', 'Client')}</th>${report.gnr ? `<th>${text('Producent', 'Producteur')}</th>` : ''}<th>${text('Tak', 'Branche')}</th><th class="customerTopAmount">${text('Premie per tak', 'Prime par branche')}</th><th class="customerTopAmount">${text('Totaal klant', 'Total client')}</th></tr></thead>${bodies || `<tbody><tr><td colspan="${widths.length}">${text('Geen klanten met', 'Aucun client avec des')} ${metric === 'nz' ? text('een positieve premie nieuwe zaken.', 'primes affaires nouvelles positives.') : text('een negatieve premie verval.', 'primes de chute négatives.')}</td></tr></tbody>`}</table></div></section>`;
  };
  document.getElementById('customerTopReports').innerHTML = reports.map(report => `<article class="customerTopReport"><h2>${escape(report.name)}</h2><p>${report.count.toLocaleString()} ${text('regels', 'lignes')} · ${report.clients.toLocaleString()} ${text('klanten', 'clients')}</p>${table(report, 'nz')}${table(report, 'lapse')}</article>`).join('');
}

async function importCustomerFiles(files, isCurrent) {
  const reports = [];
  for (const file of files) {
    try { reports.push(buildCustomerTop(await readCustomerRows(file), file.name)); }
    catch (err) { throw new Error(`${file.name}: ${err.message}`); }
    if (!isCurrent()) return;
  }
  let dialog = document.getElementById('customerTopDialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'customerTopDialog';
    dialog.setAttribute('aria-labelledby', 'customerTopTitle');
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      document.body.classList.remove('customerTopOpen');
      document.getElementById('pdfFile').focus();
    });
  }
  const fr = document.documentElement.lang === 'fr' || document.getElementById('languageSelect')?.value === 'fr';
  const text = (nl, french) => fr ? french : nl;
  dialog.innerHTML = `<header class="customerTopHead"><h2 id="customerTopTitle">${text('Top klanten', 'Top des clients')}</h2><div><label class="customerTopLimitLabel" for="customerTopLimit">${text('Aantal klanten', 'Nombre de clients')} <select id="customerTopLimit"><option value="10">Top 10</option><option value="20">Top 20</option></select></label><button type="button" id="customerTopImport">${text('Importeer', 'Importer')}</button><button type="button" id="customerTopExcel">${text('Exporteer Excel', 'Exporter Excel')}</button><button type="button" class="customerTopCopy">${text('Kopieer afbeelding', 'Copier l’image')}</button><button type="button" id="customerTopClose">${text('Sluiten', 'Fermer')}</button></div></header><p>${text('Rangschikking op het totaal per klant, inclusief correcties. De premie wordt uitgesplitst per tak. Nieuwe zaken: hoogste positieve totaal eerst. Verval: meest negatieve totaal eerst. Bestanden worden afzonderlijk weergegeven.', 'Classement selon le total par client, corrections comprises. Les primes sont détaillées par branche. Affaires nouvelles : total positif le plus élevé en premier. Chutes : total le plus négatif en premier. Chaque fichier est présenté séparément.')}</p><div id="customerTopReports"></div>`;
  const selectedLimit = () => Number(document.getElementById('customerTopLimit').value);
  document.getElementById('customerTopLimit').onchange = () => renderCustomerReports(reports, fr, selectedLimit());
  renderCustomerReports(reports, fr, selectedLimit());
  document.getElementById('customerTopClose').onclick = () => dialog.close();
  document.getElementById('customerTopImport').onclick = () => { dialog.close(); openPdfPicker(); };
  document.getElementById('customerTopExcel').onclick = () => exportCustomerExcel(reports, fr, selectedLimit());
  dialog.querySelector('.customerTopCopy').onclick = event => copyCustomerTable(event.currentTarget, fr);
  document.body.classList.add('customerTopOpen');
  if (!dialog.open) dialog.showModal();
}
