'use strict';

/* ═══════════════════════════════════════════════
   SECURITY: XSS-safe HTML escaping
   ═══════════════════════════════════════════════ */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ═══════════════════════════════════════════════
   PRIORITY — multi-select cards (e.preventDefault
   stops label→radio double-fire)
   ═══════════════════════════════════════════════ */
document.querySelectorAll('.priority-card').forEach(card => {
  card.addEventListener('click', e => {
    e.preventDefault();
    card.classList.toggle('selected');
    updateProgress();
  });
});

/* ═══════════════════════════════════════════════
   LCR LOGIC — Yes/No branching
   ═══════════════════════════════════════════════ */
let lcrIsYes = false;

document.querySelectorAll('input[name="lcr"]').forEach(radio => {
  radio.addEventListener('change', () => {
    lcrIsYes = radio.value.startsWith('Yes');
    const isNo  = radio.value === 'No';
    const anySelected = true; // either branch is selected

    toggle('lcrYesOnlyBlock', lcrIsYes);
    toggle('lcrSharedBlock', anySelected);
    toggle('lcrNoGeoBlock', isNo);

    // Show/hide and reposition the Production/Pilot sub-toggle
    const widget = document.getElementById('lcrPilotProd');
    if (lcrIsYes) {
      const selectedLabel = radio.closest('label');
      selectedLabel.insertAdjacentElement('afterend', widget);
      widget.style.display = 'flex';
    } else {
      widget.style.display = 'none';
    }

    // Re-evaluate design site sub-blocks
    const checked = document.querySelector('input[name="designSite"]:checked');
    if (checked) evaluateDesignSite(checked.value);
    else {
      toggle('designSiteCMBlock', false);
      toggle('designSiteMWBlock', false);
    }

    updateProgress();
  });
});

/* ═══════════════════════════════════════════════
   DESIGN SITE — CM / MW sub-blocks (Yes path only)
   ═══════════════════════════════════════════════ */
document.querySelectorAll('input[name="designSite"]').forEach(radio => {
  radio.addEventListener('change', () => {
    evaluateDesignSite(radio.value);
    updateProgress();
  });
});

function evaluateDesignSite(val) {
  const isCM = lcrIsYes && (val === 'Chelmsford' || val === 'Maple Grove');
  const isMW = lcrIsYes && (val === 'Morrisville' || val === 'Wyomissing' || val === 'Kamunting');
  toggle('designSiteCMBlock', isCM);
  toggle('designSiteMWBlock', isMW);
  if (!isCM) toggle('translationsYesBlock', false);
}

/* ═══════════════════════════════════════════════
   NEW TRANSLATIONS sub-block
   ═══════════════════════════════════════════════ */
document.querySelectorAll('input[name="newTranslations"]').forEach(radio => {
  radio.addEventListener('change', () => {
    toggle('translationsYesBlock', radio.value === 'Yes');
    updateProgress();
  });
});

/* ═══════════════════════════════════════════════
   MFG FG LOCATION — Other expand + revert
   ═══════════════════════════════════════════════ */
const MFG_LOC_VALUES = ['Chelmsford','Chihuahua','Hradec','Juventud','Kamunting','Kulim',
  'Maple Grove','Nuevo Laredo','Tecate','Zdar','Chihuahua/Zdar'];

document.querySelectorAll('input[name="mfgLoc"]').forEach(r => {
  r.addEventListener('change', () => {
    toggle('mfgLocOtherBlock', r.value === 'Other');
    updateProgress();
  });
});

const mfgOtherInput = document.getElementById('mfgLocOther');
if (mfgOtherInput) {
  mfgOtherInput.addEventListener('input', () => {
    const typed = mfgOtherInput.value.trim().toLowerCase();
    if (!typed) return;
    const match = MFG_LOC_VALUES.find(v => v.toLowerCase() === typed);
    if (match) {
      const radio = document.querySelector(`input[name="mfgLoc"][value="${match}"]`);
      if (radio) {
        radio.checked = true;
        toggle('mfgLocOtherBlock', false);
        mfgOtherInput.value = '';
        updateProgress();
      }
    }
  });
}

/* ═══════════════════════════════════════════════
   PRODUCT CODES — Count comma-separated items
   ═══════════════════════════════════════════════ */
const qtyCodesInput = document.getElementById('qtyCodes');
if (qtyCodesInput) {
  // Format the field when user leaves it (blur)
  qtyCodesInput.addEventListener('blur', () => {
    let rawValue = qtyCodesInput.value.trim();
    if (!rawValue) {
      qtyCodesInput.value = '';
      return;
    }

    // Strip existing formatting so re-blurring doesn't double-wrap
    const alreadyFormatted = /^\d+ codes?: /i;
    if (alreadyFormatted.test(rawValue)) {
      rawValue = rawValue.replace(alreadyFormatted, '');
    }

    // Split by commas, trim each item, and filter out empty strings
    const codes = rawValue.split(',')
      .map(code => code.trim())
      .filter(code => code.length > 0);

    const count = codes.length;
    const label = count === 1 ? 'code' : 'codes';
    const listStr = codes.join(', ');

    // Update field with formatted display: <count> code/codes: <list>
    qtyCodesInput.value = count > 0
      ? `${count} ${label}: ${listStr}`
      : '';

    qtyCodesInput.dispatchEvent(new Event('change'));
  });
}

/* ═══════════════════════════════════════════════
   SPECIFY FUNCTIONAL OWNERS — Yes expands fields
   ═══════════════════════════════════════════════ */
document.querySelectorAll('input[name="specifyOwnersCM"]').forEach(r => {
  r.addEventListener('change', () => {
    toggle('foBlockCM', r.value === 'Yes');
    updateProgress();
  });
});
document.querySelectorAll('input[name="specifyOwnersMW"]').forEach(r => {
  r.addEventListener('change', () => {
    toggle('foBlockMW', r.value === 'Yes');
    updateProgress();
  });
});
document.querySelectorAll('input[name="geo"]').forEach(r => {
  r.addEventListener('change', () => {
    toggle('geoOtherBlock', r.value === 'Other');
    updateProgress();
  });
});

/* ═══════════════════════════════════════════════
   FILE UPLOAD — event delegation (no inline onclick,
   CSP-safe), XSS-safe rendering
   ═══════════════════════════════════════════════ */
const uploadedFiles = [];

// Drop zone
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');

function openFilePicker() { fileInput.click(); }
dropZone.addEventListener('click', openFilePicker);
dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openFilePicker(); });
browseBtn.addEventListener('click', e => { e.stopPropagation(); openFilePicker(); });
browseBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); openFilePicker(); } });
fileInput.addEventListener('change', () => { Array.from(fileInput.files).forEach(addFile); fileInput.value = ''; });

function handleDrop(e) {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  Array.from(e.dataTransfer.files).forEach(addFile);
}

function addFile(file) { uploadedFiles.push(file); renderFileList(); updateProgress(); }

function removeFile(i) { uploadedFiles.splice(i, 1); renderFileList(); updateProgress(); }
window.removeFile = removeFile;

function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function renderFileList() {
  const list = document.getElementById('fileList');
  // Build with DOM methods — XSS-safe
  list.innerHTML = '';
  uploadedFiles.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.setAttribute('role', 'listitem');

    const icon = document.createElementNS('http://www.w3.org/2000/svg','svg');
    icon.setAttribute('width','14'); icon.setAttribute('height','14');
    icon.setAttribute('viewBox','0 0 24 24'); icon.setAttribute('fill','none');
    icon.setAttribute('stroke','currentColor'); icon.setAttribute('stroke-width','2');
    icon.setAttribute('stroke-linecap','round'); icon.setAttribute('stroke-linejoin','round');
    icon.setAttribute('aria-hidden','true');
    icon.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>';

    const name = document.createTextNode(f.name);
    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = formatSize(f.size);

    const btn = document.createElement('button');
    btn.className = 'file-remove';
    btn.type = 'button';
    btn.dataset.idx = i;
    btn.setAttribute('aria-label', `Remove ${f.name}`);
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(size);
    item.appendChild(btn);
    list.appendChild(item);
  });
}

// Event delegation for file removal
document.getElementById('fileList').addEventListener('click', e => {
  const btn = e.target.closest('.file-remove');
  if (btn) removeFile(parseInt(btn.dataset.idx, 10));
});

/* ═══════════════════════════════════════════════
   EMAIL VALIDATION
   ═══════════════════════════════════════════════ */
function isValidEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.trim());
}

const reqEmailEl = document.getElementById('reqEmail');
reqEmailEl.addEventListener('blur', function() {
  const bad = this.value.trim() !== '' && !isValidEmail(this.value);
  this.classList.toggle('invalid', bad);
  document.getElementById('emailError').classList.toggle('visible', bad);
  updateProgress();
  syncCopyEmail();
});
reqEmailEl.addEventListener('input', function() {
  if (this.classList.contains('invalid') && isValidEmail(this.value.trim())) {
    this.classList.remove('invalid');
    document.getElementById('emailError').classList.remove('visible');
  }
  updateProgress();
  syncCopyEmail();
});

/* ═══════════════════════════════════════════════
   SEND COPY — dynamic email display, checked by
   default, optional additional recipient
   ═══════════════════════════════════════════════ */
const sendCopyEl   = document.getElementById('sendCopy');
const copyEmailEl  = document.getElementById('copyEmailDisplay');

function syncCopyEmail() {
  const val = reqEmailEl.value.trim();
  const valid = isValidEmail(val);
  copyEmailEl.textContent = valid ? val : '—';
}

sendCopyEl.addEventListener('change', () => {
  const trigger = document.getElementById('copyAddTrigger');
  const additional = document.getElementById('copyAdditional');
  if (!sendCopyEl.checked) {
    // Hide everything when unchecked
    if (trigger) trigger.style.display = 'none';
    if (additional) additional.style.display = 'none';
  } else {
    if (trigger) trigger.style.display = '';
  }
});

function toggleAdditionalRecipient() {
  const trigger = document.getElementById('copyAddTrigger');
  const additional = document.getElementById('copyAdditional');
  if (additional) {
    additional.style.display = 'flex';
    document.getElementById('additionalEmail').focus();
  }
  if (trigger) trigger.style.display = 'none';
}

function removeAdditionalRecipient() {
  const trigger = document.getElementById('copyAddTrigger');
  const additional = document.getElementById('copyAdditional');
  if (additional) {
    additional.style.display = 'none';
    document.getElementById('additionalEmail').value = '';
  }
  if (trigger) trigger.style.display = '';
}

document.getElementById('additionalEmail').addEventListener('click', e => e.stopPropagation());

/* ═══════════════════════════════════════════════
   PROGRESS + SUBMIT GATING
   Each check has: fn (the test), el (element to
   scroll to if failing), type (input|radio|group)
   ═══════════════════════════════════════════════ */

// Helper: get element lazily (conditional fields may not exist yet)
const el = id => document.getElementById(id);
const ra = name => document.querySelector(`input[name="${name}"]:checked`);

const baseRequired = [
  { fn: () => isValidEmail(el('reqEmail')?.value ?? ''),          elId: 'reqEmail',     type: 'input' },
  { fn: () => (el('projManager')?.value ?? '').trim() !== '',      elId: 'projManager',  type: 'input' },
  { fn: () => (el('projName')?.value ?? '').trim() !== '',         elId: 'projName',     type: 'input' },
  { fn: () => !!document.querySelector('.priority-card.selected'), elId: 'priorityLabel',type: 'group' },
  { fn: () => (el('labelSpec')?.value ?? '').trim() !== '',        elId: 'labelSpec',    type: 'input' },
  { fn: () => !!ra('bu'),                                          elId: 'buLabel',      type: 'group' },
  { fn: () => !!ra('lcr'),                                         elId: 'lcrLabel',     type: 'group' },
];

const conditionalRequired = [
  { blockId: 'lcrYesOnlyBlock', checks: [
    { fn: () => (el('changeReqNum')?.value ?? '').trim() !== '',  elId: 'changeReqNum',  type: 'input' },
    { fn: () => (el('changeOrderNum')?.value ?? '').trim() !== '',elId: 'changeOrderNum',type: 'input' },
  ]},
  { blockId: 'lcrSharedBlock', checks: [
    { fn: () => (el('projReason')?.value ?? '').trim() !== '',    elId: 'projReason',    type: 'input' },
    { fn: () => (el('projDesc')?.value ?? '').trim() !== '',      elId: 'projDesc',      type: 'input' },
    { fn: () => !!ra('designSite'),                               elId: 'dsLabel',       type: 'group' },
    { fn: () => !!ra('aop'),                                      elId: 'aopLabel',      type: 'group' },
    { fn: () => !!ra('mfgLoc'),                                   elId: 'mfgLabel',      type: 'group' },
    { fn: () => !!ra('npd'),                                      elId: 'npdLabel',      type: 'group' },
    { fn: () => (el('qtyCodes')?.value ?? '').trim() !== '',      elId: 'qtyCodes',      type: 'input' },
  ]},
  { blockId: 'designSiteCMBlock', checks: [
    { fn: () => !!ra('newGtins'),                                 elId: 'newGtinsLabel', type: 'group' },
    { fn: () => !!ra('newIpns'),                                  elId: 'newIpnsLabel',  type: 'group' },
    { fn: () => !!ra('newTranslations'),                          elId: 'newTransLabel', type: 'group' },
    { fn: () => (el('riaRationale')?.value ?? '').trim() !== '',  elId: 'riaRationale',  type: 'input' },
    { fn: () => !!ra('packagingImpact'),                          elId: 'packLabel',     type: 'group' },
    { fn: () => !!ra('labelSizeChange'),                          elId: 'labelSizeLabel',type: 'group' },
  ]},
  { blockId: 'foBlockCM', checks: [
    { fn: () => ['foMarketingCM','foRACM','foEngineeringCM'].some(id => (el(id)?.value ?? '').trim() !== ''),
                                                                  elId: 'foLabelCM',     type: 'group' },
  ]},
  { blockId: 'translationsYesBlock', checks: [
    { fn: () => (el('costCenter')?.value ?? '').trim() !== '',    elId: 'costCenter',    type: 'input' },
    { fn: () => !!document.querySelector('input[name="langs"]:checked'),
                                                                  elId: 'langCount',     type: 'group' },
  ]},
  { blockId: 'designSiteMWBlock', checks: [
  ]},
  { blockId: 'foBlockMW', checks: [
    { fn: () => ['foMarketingMW','foRAMW','foEngineeringMW'].some(id => (el(id)?.value ?? '').trim() !== ''),
                                                                  elId: 'foLabelMW',     type: 'group' },
  ]},
  { blockId: 'mfgLocOtherBlock', checks: [
    { fn: () => (el('mfgLocOther')?.value ?? '').trim() !== '',   elId: 'mfgLocOther',   type: 'input' },
  ]},
  { blockId: 'lcrNoGeoBlock', checks: [
    { fn: () => !!ra('geo'),                                      elId: 'geoLabel',      type: 'group' },
  ]},
  { blockId: 'geoOtherBlock', checks: [
    { fn: () => (el('geoOther')?.value ?? '').trim() !== '',      elId: 'geoOther',      type: 'input' },
  ]},
];

/* ── Field completion checkmarks ── */
// Wrap every required text/email/number/date/textarea input in a .field-wrap
// and inject a green check badge — done once at init, then toggled on updateProgress
function initFieldCheckmarks() {
  const inputIds = [
    'reqEmail','projManager','projName','labelSpec',
    'changeReqNum','changeOrderNum','projReason','projDesc',
    'qtyCodes','riaRationale','costCenter','mfgLocOther','geoOther',
    'cutoverDate',
  ];
  inputIds.forEach(id => {
    const input = document.getElementById(id);
    if (!input || input.closest('.field-wrap')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'field-wrap';
    wrapper.dataset.fieldId = id;
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const check = document.createElement('div');
    check.className = 'field-complete-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = '<svg viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    wrapper.appendChild(check);
  });
}

function updateFieldCheckmarks(allChecks) {
  // For each input-type check, update its .field-wrap
  allChecks.forEach(({ fn, elId, type }) => {
    if (type !== 'input') return;
    const input = document.getElementById(elId);
    if (!input) return;
    const wrapper = input.closest('.field-wrap');
    if (!wrapper) return;
    const done = fn();
    wrapper.classList.toggle('complete', done);
    const check = wrapper.querySelector('.field-complete-check');
    if (check) check.classList.toggle('visible', done);
  });
}

/* ── Click-to-find: clicking the button when not ready scrolls to first failing field;
      clicking when ready submits ── */
document.getElementById('btnSubmit').addEventListener('click', function() {
  if (this.dataset.disabled !== 'true') {
    handleSubmit();
    return;
  }
  findAndHighlightFirstMissing();
});

function findAndHighlightFirstMissing() {
  const allChecks = [...baseRequired];
  conditionalRequired.forEach(({ blockId, checks }) => {
    if (document.getElementById(blockId)?.classList.contains('on')) {
      allChecks.push(...checks);
    }
  });

  // Clear any existing highlights before scrolling to the new target
  document.querySelectorAll('.highlight-missing').forEach(el => el.classList.remove('highlight-missing'));

  const firstFailing = allChecks.find(({ fn }) => !fn());
  if (!firstFailing) return;

  const target = document.getElementById(firstFailing.elId);
  if (!target) return;

  // Scroll into view with a little breathing room above the sticky bar
  const offset = 80;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });

  // Amber outline after scroll settles — stays until user interacts with the field
  setTimeout(() => {
    const pulseEl = firstFailing.type === 'input'
      ? (target.closest('.field-wrap') || target)
      : target.closest('.field') || target;

    // Force animation restart
    pulseEl.classList.remove('highlight-missing');
    void pulseEl.offsetWidth;
    pulseEl.classList.add('highlight-missing');

    const clearHighlight = () => pulseEl.classList.remove('highlight-missing');
    if (firstFailing.type === 'input') {
      target.addEventListener('focus',  clearHighlight, { once: true });
      target.addEventListener('change', clearHighlight, { once: true });
    } else {
      // For radio/card groups, listen on the .field container so any selection clears it
      pulseEl.addEventListener('click',  clearHighlight, { once: true });
      pulseEl.addEventListener('change', clearHighlight, { once: true });
    }
  }, 400);
}

function updateProgress() {
  const allChecks = [...baseRequired];
  conditionalRequired.forEach(({ blockId, checks }) => {
    if (document.getElementById(blockId)?.classList.contains('on')) {
      allChecks.push(...checks);
    }
  });

  const done  = allChecks.filter(({ fn }) => fn()).length;
  const total = allChecks.length;
  const remaining = total - done;
  const ready = remaining === 0;

  // Progress bar
  const pct = Math.round((done / total) * 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent  = pct + '%';

  // Progress label
  const label = document.getElementById('progressLabel');
  if (label) {
    label.textContent = ready ? '✓ Ready to submit' : `${done} of ${total} complete`;
  }

  // Submit button — show remaining count when not ready, normal label when ready
  const btn = document.getElementById('btnSubmit');
  if (ready) {
    btn.dataset.disabled = 'false';
    btn.innerHTML = 'Submit Request →';
  } else {
    btn.dataset.disabled = 'true';
    btn.innerHTML = `Submit Request <span class="btn-submit-remaining">${remaining} field${remaining === 1 ? '' : 's'} remaining — click to find</span>`;
  }

  // Per-field green checkmarks
  updateFieldCheckmarks(allChecks);
}

// Wire all data-track elements
document.querySelectorAll('[data-track]').forEach(el => {
  el.addEventListener('input',  updateProgress);
  el.addEventListener('change', updateProgress);
});

/* ═══════════════════════════════════════════════
   HELPER: toggle conditional-reveal block
   ═══════════════════════════════════════════════ */
function toggle(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) {
    el.classList.remove('on-flex');
    el.classList.toggle('on', true);
  } else {
    el.classList.remove('on');
    el.classList.remove('on-flex');
  }
}

/* ═══════════════════════════════════════════════
   LANGUAGE PRESETS + SEARCH + localStorage
   ═══════════════════════════════════════════════ */
const LS_KEY = 'teleflex.glr.userPresets';  // namespaced to avoid collision

const BUILTIN_PRESETS = [
  { key: 'efigs',      label: 'EFIGS',       langs: ['en','fr','it','de','es'] },
  { key: 'eu',         label: 'EU Core',      langs: ['bg','cs','da','de','el','en','es','et','fi','fr','ga','hr','hu','it','lt','lv','mt','nl','pl','pt','ro','sk','sl','sv'] },
  { key: 'nordic',     label: 'Nordic',       langs: ['da','fi','no','sv'] },
  { key: 'apac',       label: 'APAC',         langs: ['ja','ko','zh_cn','zh_tw','id','ms','th','vi'] },
  { key: 'americas',   label: 'Americas',     langs: ['es','es_la','fr_cn','pt_br'] },
  { key: 'globalfull', label: 'Global Full',  langs: ['bg','cs','da','de','el','en','es','es_la','et','fi','fr','fr_cn','ga','hr','hu','id','is','it','ja','ko','lb','lt','lv','ms','mt','nl','no','pl','pt','pt_br','ro','ru','sk','sl','sr','sv','th','tr','uk','vi','zh_cn','zh_tw'] },
];

const LANG_ALIASES = {
  'bulgarian':'bg','czech':'cs','danish':'da','german':'de','greek':'el',
  'english':'en','spanish':'es','spanish latin american':'es_la','latin american spanish':'es_la',
  'estonian':'et','finnish':'fi','french':'fr','french canadian':'fr_cn',
  'irish':'ga','croatian':'hr','hungarian':'hu','indonesian':'id',
  'icelandic':'is','italian':'it','japanese':'ja','korean':'ko',
  'luxembourgish':'lb','lithuanian':'lt','latvian':'lv','malay':'ms',
  'maltese':'mt','dutch':'nl','norwegian':'no','polish':'pl',
  'portuguese':'pt','portuguese brazilian':'pt_br','brazilian portuguese':'pt_br',
  'romanian':'ro','russian':'ru','slovak':'sk','slovene':'sl','slovenian':'sl',
  'serbian':'sr','swedish':'sv','thai':'th','turkish':'tr','ukrainian':'uk',
  'vietnamese':'vi','chinese simplified':'zh_cn','simplified chinese':'zh_cn',
  'chinese traditional':'zh_tw','traditional chinese':'zh_tw',
};

// localStorage helpers
function loadUserPresets() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}
function saveUserPresetsToStorage(p) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}

// Render built-in presets (counts stay live)
function renderBuiltinPresets() {
  const container = document.getElementById('builtinPresetBtns');
  if (!container) return;
  const allVals = Array.from(document.querySelectorAll('input[name="langs"]')).map(cb => cb.value);
  // Build with DOM — avoids innerHTML injection
  container.innerHTML = '';
  BUILTIN_PRESETS.forEach(p => {
    const count = p.langs.filter(l => allVals.includes(l)).length;
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.type = 'button';
    btn.dataset.key = p.key;
    btn.innerHTML = esc(p.label) + `<span class="preset-count"> (${count})</span>`;
    container.appendChild(btn);
  });
  const clearBtn = document.createElement('button');
  clearBtn.className = 'preset-btn preset-clear';
  clearBtn.type = 'button';
  clearBtn.dataset.key = 'none';
  clearBtn.textContent = 'Clear';
  container.appendChild(clearBtn);
}

// Render user presets — XSS-safe via esc()
function renderUserPresets() {
  const presets   = loadUserPresets();
  const container = document.getElementById('userPresetBtns');
  if (!container) return;
  container.style.display = '';
  container.innerHTML = '';

  presets.forEach((p, i) => {
    const pill = document.createElement('div');
    pill.className = 'user-preset-pill';
    pill.id = `upill-${i}`;

    const name = document.createElement('span');
    name.className = 'user-preset-name';
    name.dataset.idx = i;
    name.innerHTML = esc(p.name) + ` <span style="font-weight:400;opacity:0.6;font-size:10px;">(${p.langs.length})</span>`;

    const del = document.createElement('button');
    del.className = 'user-preset-del';
    del.id = `udel-${i}`;
    del.type = 'button';
    del.dataset.idx = i;
    del.title = 'Delete preset';
    del.setAttribute('aria-label', `Delete preset ${p.name}`);
    del.textContent = '×';

    pill.appendChild(name);
    pill.appendChild(del);
    container.appendChild(pill);
  });

  const trigger = document.createElement('button');
  trigger.className = 'preset-save-trigger';
  trigger.type = 'button';
  trigger.id = 'savePresetTrigger';
  trigger.textContent = '+ Save as preset…';
  container.appendChild(trigger);
}

// Event delegation for lang controls — no inline onclick
document.getElementById('builtinPresetBtns').addEventListener('click', e => {
  const btn = e.target.closest('.preset-btn');
  if (btn) applyLangPreset(btn.dataset.key);
});

document.getElementById('userPresetBtns').addEventListener('click', e => {
  const name = e.target.closest('.user-preset-name');
  const del  = e.target.closest('.user-preset-del');
  const trig = e.target.closest('#savePresetTrigger');
  if (name) applyUserPreset(parseInt(name.dataset.idx, 10));
  if (del && !del.classList.contains('confirm')) beginDeletePreset(parseInt(del.dataset.idx, 10));
  else if (del && del.classList.contains('confirm'))  confirmDeletePreset(parseInt(del.dataset.idx, 10));
  if (trig) showSavePresetRow();
});

document.getElementById('userPresetBtns').addEventListener('click', e => {
  const cancel = e.target.closest('.user-preset-cancel');
  if (cancel) cancelDeletePreset(parseInt(cancel.dataset.idx, 10));
});

// Preset application
let _preClearSnapshot = null;
let _undoTimer = null;

function applyLangPreset(key) {
  if (key === 'none') {
    _preClearSnapshot = Array.from(document.querySelectorAll('input[name="langs"]:checked')).map(cb => cb.value);
    if (!_preClearSnapshot.length) { _preClearSnapshot = null; return; }
    setLangs([]);
    showLangFeedback(null, null);
    document.getElementById('langUndoBar').style.display = 'flex';
    clearTimeout(_undoTimer);
    _undoTimer = setTimeout(() => {
      _preClearSnapshot = null;
      document.getElementById('langUndoBar').style.display = 'none';
    }, 5000);
  } else {
    const preset = BUILTIN_PRESETS.find(p => p.key === key);
    setLangs(preset ? preset.langs : []);
    showLangFeedback(null, null);
    hideClearUndo();
  }
}

function undoClear() {
  if (_preClearSnapshot) { setLangs(_preClearSnapshot); _preClearSnapshot = null; }
  hideClearUndo();
}
function hideClearUndo() {
  clearTimeout(_undoTimer);
  document.getElementById('langUndoBar').style.display = 'none';
}

document.getElementById('undoClearBtn').addEventListener('click', undoClear);

function applyUserPreset(idx) {
  const p = loadUserPresets()[idx];
  if (p) { setLangs(p.langs); showLangFeedback(null, null); }
}

function beginDeletePreset(idx) {
  const pill   = document.getElementById(`upill-${idx}`);
  const delBtn = document.getElementById(`udel-${idx}`);
  if (!pill || !delBtn) return;
  pill.classList.add('confirm-delete');
  delBtn.classList.add('confirm');
  delBtn.textContent = 'Delete?';
  delBtn.title = 'Click again to confirm';

  const cancel = document.createElement('button');
  cancel.className = 'user-preset-cancel';
  cancel.type = 'button';
  cancel.dataset.idx = idx;
  cancel.title = 'Cancel';
  cancel.textContent = '↩';
  pill.appendChild(cancel);

  delBtn._cancelTimer = setTimeout(() => cancelDeletePreset(idx), 4000);
}

function confirmDeletePreset(idx) {
  const presets = loadUserPresets();
  presets.splice(idx, 1);
  saveUserPresetsToStorage(presets);
  renderUserPresets();
}

function cancelDeletePreset(idx) {
  const pill   = document.getElementById(`upill-${idx}`);
  const delBtn = document.getElementById(`udel-${idx}`);
  if (!pill || !delBtn) return;
  clearTimeout(delBtn._cancelTimer);
  pill.classList.remove('confirm-delete');
  delBtn.classList.remove('confirm');
  delBtn.textContent = '×';
  delBtn.title = 'Delete preset';
  const c = pill.querySelector('.user-preset-cancel');
  if (c) c.remove();
}

// Save preset
function showSavePresetRow() {
  document.getElementById('langSaveNameRow').style.display = 'flex';
  document.getElementById('presetNameInput').focus();
}
function cancelSavePreset() {
  document.getElementById('langSaveNameRow').style.display = 'none';
  document.getElementById('presetNameInput').value = '';
  document.getElementById('presetSaveHint').textContent = '';
}
function confirmSavePreset() {
  const name = document.getElementById('presetNameInput').value.trim();
  const hint = document.getElementById('presetSaveHint');
  if (!name) { hint.textContent = 'Enter a name first.'; hint.style.color = 'var(--red)'; return; }
  const selected = Array.from(document.querySelectorAll('input[name="langs"]:checked')).map(cb => cb.value);
  if (!selected.length) { hint.textContent = 'Select at least one language first.'; hint.style.color = 'var(--red)'; return; }
  const presets  = loadUserPresets();
  const existing = presets.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing >= 0 && !hint.dataset.overwriteConfirmed) {
    hint.textContent = '';
    // Use DOM to set the warning safely (no innerHTML with user data)
    const warn = document.createElement('span');
    warn.className = 'preset-overwrite-warn';
    warn.textContent = `⚠ "${name}" already exists — Save again to overwrite.`;
    hint.appendChild(warn);
    hint.dataset.overwriteConfirmed = '1';
    setTimeout(() => { if (hint.dataset.overwriteConfirmed) { hint.textContent = ''; delete hint.dataset.overwriteConfirmed; } }, 5000);
    return;
  }
  if (existing >= 0) presets[existing].langs = selected;
  else presets.push({ name, langs: selected });
  saveUserPresetsToStorage(presets);
  renderUserPresets();
  cancelSavePreset();
  delete hint.dataset.overwriteConfirmed;
}

document.getElementById('confirmSaveBtn').addEventListener('click', confirmSavePreset);
document.getElementById('cancelSaveBtn').addEventListener('click',  cancelSavePreset);
document.getElementById('presetNameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); confirmSavePreset(); }
  if (e.key === 'Escape') cancelSavePreset();
});

// Core lang functions
function setLangs(values) {
  document.querySelectorAll('input[name="langs"]').forEach(cb => { cb.checked = values.includes(cb.value); });
  updateLangCount();
  updateProgress();
}

function parseLangText(raw) {
  const tokens   = raw.split(/[\s,;|/\n]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
  const allVals  = Array.from(document.querySelectorAll('input[name="langs"]')).map(cb => cb.value);
  const matched  = new Set();
  const unmatched = [];
  tokens.forEach(tok => {
    if (allVals.includes(tok))                          { matched.add(tok); return; }
    if (LANG_ALIASES[tok])                              { matched.add(LANG_ALIASES[tok]); return; }
    const partial = allVals.filter(v => v.startsWith(tok));
    if (partial.length)                                 { partial.forEach(v => matched.add(v)); return; }
    unmatched.push(tok);
  });
  return { matched: [...matched], unmatched };
}

function showLangFeedback(matchCount, unmatched) {
  const fb    = document.getElementById('langFeedback');
  const okEl  = document.getElementById('langFeedbackOk');
  const warnEl = document.getElementById('langFeedbackWarn');
  if (matchCount === null) { fb.classList.remove('visible'); return; }
  okEl.textContent = matchCount > 0 ? `${matchCount} matched` : '';
  // XSS-safe: build unmatched display with DOM
  warnEl.textContent = '';
  if (unmatched && unmatched.length) {
    const msg  = document.createTextNode(`${unmatched.length} not matched: `);
    const code = document.createElement('span');
    code.className = 'lang-feedback-tokens';
    code.textContent = unmatched.join(', ');
    warnEl.appendChild(msg);
    warnEl.appendChild(code);
  }
  fb.classList.add('visible');
}

function updateLangCount() {
  const n  = document.querySelectorAll('input[name="langs"]:checked').length;
  const el = document.getElementById('langCount');
  if (el) el.querySelector('span').textContent = n;
}

document.querySelectorAll('input[name="langs"]').forEach(cb => {
  cb.addEventListener('change', () => { updateLangCount(); updateProgress(); showLangFeedback(null, null); });
});

// Copy selection
document.getElementById('copyLangBtn').addEventListener('click', function() {
  const names = Array.from(document.querySelectorAll('input[name="langs"]:checked')).map(cb => {
    return cb.closest('.pill-option')?.querySelector('.pill-label')?.textContent?.trim() || cb.value;
  });
  if (!names.length) return;
  navigator.clipboard.writeText(names.join(', ')).then(() => {
    const orig = this.innerHTML;
    this.textContent = '✓ Copied!';
    this.style.color = 'var(--green-dark)';
    this.style.borderColor = 'var(--green-dark)';
    setTimeout(() => { this.innerHTML = orig; this.style.color = ''; this.style.borderColor = ''; }, 2000);
  });
});

// Search input
function clearLangSearch() {
  const input   = document.getElementById('langSearchInput');
  const clearBtn = document.getElementById('langSearchClear');
  if (input) { input.value = ''; input.focus(); }
  if (clearBtn) clearBtn.style.display = 'none';
  document.querySelectorAll('#langGrid .pill-option').forEach(opt => opt.style.display = '');
}

const searchInput = document.getElementById('langSearchInput');
if (searchInput) {
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = searchInput.value.trim();
      if (!raw) return;
      const { matched, unmatched } = parseLangText(raw);
      if (matched.length) setLangs(matched);
      showLangFeedback(matched.length, unmatched);
      clearLangSearch();
    }
  });
  searchInput.addEventListener('input', () => {
    const q       = searchInput.value.trim().toLowerCase();
    const clearBtn = document.getElementById('langSearchClear');
    if (clearBtn) clearBtn.style.display = q ? '' : 'none';
    const visible = [];
    document.querySelectorAll('#langGrid .pill-option').forEach(opt => {
      const label = opt.querySelector('.pill-label').textContent.toLowerCase();
      const val   = opt.querySelector('input').value.toLowerCase();
      const show  = !q || label.includes(q) || val.includes(q);
      opt.style.display = show ? '' : 'none';
      if (show) visible.push(opt);
    });
    if (visible.length === 1) {
      const cb = visible[0].querySelector('input[type="checkbox"]');
      const handler = function() { cb.removeEventListener('change', handler); if (cb.checked) clearLangSearch(); };
      cb.removeEventListener('change', handler);
      cb.addEventListener('change', handler);
    }
  });
}

document.getElementById('langSearchClear').addEventListener('click', clearLangSearch);

/* ═══════════════════════════════════════════════
   SUBMIT — posts to Cloudflare Worker (token-safe)
   ═══════════════════════════════════════════════ */
// Single click handler: find-missing when disabled, submit when enabled
// (The disabled-click handler above already handles both cases via its guard)


/* ═══════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  // Ctrl+Enter / Cmd+Enter → submit (if enabled)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const btn = document.getElementById('btnSubmit');
    if (btn.dataset.disabled !== 'true') { e.preventDefault(); handleSubmit(); }
  }
  // Escape → clear focused text input (standard UX)
  if (e.key === 'Escape' && document.activeElement) {
    const el = document.activeElement;
    if ((el.tagName === 'INPUT' && el.type !== 'radio' && el.type !== 'checkbox') || el.tagName === 'TEXTAREA') {
      el.blur();
    }
  }
});

async function handleSubmit() {
  const btn = document.getElementById('btnSubmit');
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const payload = collectFormData();

  try {
    const res = await fetch('/api/submit-glr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const data = await res.json().catch(() => ({}));
    showSuccessScreen(payload, data.referenceId || null);

  } catch (err) {
    console.error('Submit failed:', err);
    btn.disabled = false;
    btn.textContent = 'Submit Request →';
    alert('Submission failed — please try again or contact your labeling representative.');
  }
}

function showSuccessScreen(payload, refId) {
  // Hide the entire form area
  document.getElementById('progressFill').closest('.progress-bar-wrap').style.display = 'none';
  document.querySelector('.page-header').style.display = 'none';
  document.querySelector('.form-wrap').style.display = 'none';

  // Show success screen
  const screen = document.getElementById('successScreen');
  screen.style.display = '';

  // Reference number
  if (refId) {
    document.getElementById('successRefVal').textContent = refId;
    document.getElementById('successRef').style.display = 'flex';
  }

  // Summary of key fields
  const summary = document.getElementById('successSummary');
  const rows = [
    ['Project', payload.projectName],
    ['Business unit', payload.businessUnit],
    ['Priority', Array.isArray(payload.priority) ? payload.priority.map(p => `P${p}`).join(', ') : payload.priority],
    ['Design site', payload.designSite],
    ['LCR/ECR/NCR', payload.lcr],
  ].filter(([, v]) => v);

  summary.innerHTML = '';
  rows.forEach(([key, val]) => {
    const row = document.createElement('div');
    row.className = 'success-summary-row';
    const k = document.createElement('span');
    k.className = 'success-summary-key';
    k.textContent = key;
    const v = document.createElement('span');
    v.className = 'success-summary-val';
    v.textContent = val;
    row.appendChild(k);
    row.appendChild(v);
    summary.appendChild(row);
  });

  // "Submit another" reloads the page cleanly
  document.getElementById('submitAnotherBtn').addEventListener('click', () => {
    window.location.reload();
  });
}

function formatApprovers(mktg, ra, eng) {
  const parts = [];
  if (mktg) parts.push(`Marketing - ${mktg}`);
  if (ra)   parts.push(`RA - ${ra}`);
  if (eng)  parts.push(`Engineering - ${eng}`);
  return parts.join('  ');
}

function collectFormData() {
  const g = id => document.getElementById(id)?.value?.trim() ?? '';
  const r = name => document.querySelector(`input[name="${name}"]:checked`)?.value ?? '';
  const priorities = Array.from(document.querySelectorAll('.priority-card.selected')).map(c => c.dataset.p);
  const langs = Array.from(document.querySelectorAll('input[name="langs"]:checked')).map(cb => cb.value);

  // Save requester email to localStorage for next visit
  const email = g('reqEmail');
  if (email) {
    try { localStorage.setItem('teleflex.glr.lastEmail', email); } catch {}
  }

  const specifyCM = document.querySelector('input[name="specifyOwnersCM"]:checked')?.value;
  const specifyMW = document.querySelector('input[name="specifyOwnersMW"]:checked')?.value;
  const functionalOwnersCM = specifyCM === 'Yes'
    ? formatApprovers(g('foMarketingCM'), g('foRACM'), g('foEngineeringCM'))
    : (specifyCM === 'No' ? 'N/A' : '');
  const functionalOwnersMW = specifyMW === 'Yes'
    ? formatApprovers(g('foMarketingMW'), g('foRAMW'), g('foEngineeringMW'))
    : (specifyMW === 'No' ? 'N/A' : '');

  return {
    // ── Smartsheet column mapping reference ──
    // Field name in form          → Smartsheet column name
    requesterEmail:     email,                              // "Requester Email:"
    projectManager:     g('projManager'),                   // "Project Manager:"
    projectName:        g('projName'),                      // "Project Name:"
    priority:           priorities,                         // "Priority:"
    sustainingProject:  g('sustainingNum'),                  // "Sustaining Project Number:"
    sustainingIntake:   g('intakeNum'),                      // "Sustaining Intake Number:"
    labelSpec:          g('labelSpec'),                      // "Label Spec Number:"
    businessUnit:       r('bu'),                             // "Business Unit:"
    lcr:                r('lcr'),                            // "LCR, ECR/ECO or NCR/CO Created?:"
    pilotProd:          r('pilotProd'),                      // "Production/Pilot:"
    changeReqNum:       g('changeReqNum'),                   // "Change Request Number (LCR/ECR/NCR):"
    changeOrderNum:     g('changeOrderNum'),                 // "Change Order Number (CO/DCO/ECO):"
    projectReason:      g('projReason'),                     // "Project Reason:"
    projectDesc:        g('projDesc'),                       // "Brief Project Description:"
    designSite:         r('designSite'),                     // "Design Site:"
    aop:                r('aop'),                            // "Planned AOP Project?"
    mfgLocation:        r('mfgLoc') === 'Other' ? g('mfgLocOther') : r('mfgLoc'),  // "Manufacturing FG Location:" / "Other MFG Facility:"
    geographies:        r('geo'),                            // "Geographies:"
    npd:                r('npd'),                            // "NPD or Sustaining:"
    qtyCodes:           g('qtyCodes'),                       // "Qty of Product Codes in Scope:"
    cutoverDate:        g('cutoverDate'),                    // "Manufacturing Cutover / Label Release Date:"
    newGtins:           r('newGtins'),                       // "New GTINs Required:"
    newIpns:            r('newIpns'),                        // "New IPNs Required:"
    newTranslations:    r('newTranslations'),                // "Translation Required:"
    costCenter:         g('costCenter'),                     // "Cost Center:"
    languages:          langs,                               // "Countries to be translated:"
    riaRationale:       g('riaRationale'),                   // "Regulatory Impact Assessment Rationale:"
    packagingImpact:    r('packagingImpact'),                // "Packaging Impact:"
    labelSizeChange:    r('labelSizeChange'),                // "Label Size Change Required:"
    designWork:         r('designWorkCM') || r('designWorkMW'),  // "Design Work Requested:"
    functionalOwners:   functionalOwnersCM || functionalOwnersMW, // "Functional Owners:"
    sendCopyToSelf:     document.getElementById('sendCopy').checked,
    additionalEmail:    g('additionalEmail'),
  };
}

/* ═══════════════════════════════════════════════
   SMART DEFAULTS (based on historical data analysis)
   ═══════════════════════════════════════════════ */
function applyDefaults() {
  // Requester email: restore last used address from localStorage
  const lastEmail = localStorage.getItem('teleflex.glr.lastEmail');
  const emailEl = document.getElementById('reqEmail');
  if (lastEmail && isValidEmail(lastEmail) && emailEl && !emailEl.value) {
    emailEl.value = lastEmail;
    syncCopyEmail();
  }

  // Sustaining Project # and Sustaining Intake # → N/A
  // (59% of submissions have no value; N/A is the conventional placeholder)
  const snEl = document.getElementById('sustainingNum');
  if (snEl && !snEl.value) snEl.value = 'N/A';
  const siEl = document.getElementById('intakeNum');
  if (siEl && !siEl.value) siEl.value = 'N/A';

  // NPD or Sustaining → Sustaining (92% of submissions)
  const sustainingRadio = document.querySelector('input[name="npd"][value="Sustaining"]');
  if (sustainingRadio) sustainingRadio.checked = true;

  // Planned AOP Project → No (76% of submissions)
  const aopNoRadio = document.querySelector('input[name="aop"][value="No"]');
  if (aopNoRadio) aopNoRadio.checked = true;

  // Packaging Impact → No (96% of answered submissions)
  const packNoRadio = document.querySelector('input[name="packagingImpact"][value="No"]');
  if (packNoRadio) packNoRadio.checked = true;

  // Label Size Change → No (98% of answered submissions)
  const labelNoRadio = document.querySelector('input[name="labelSizeChange"][value="No"]');
  if (labelNoRadio) labelNoRadio.checked = true;

  // New GTINs → No (70% of answered submissions)
  const gtinsNoRadio = document.querySelector('input[name="newGtins"][value="No"]');
  if (gtinsNoRadio) gtinsNoRadio.checked = true;

  // New IPNs → No (71% of answered submissions)
  const ipnsNoRadio = document.querySelector('input[name="newIpns"][value="No"]');
  if (ipnsNoRadio) ipnsNoRadio.checked = true;
}

/* ═══════════════════════════════════════════════
   TEMPLATES — save/load/delete form state
   ═══════════════════════════════════════════════ */
const TMPL_KEY = 'teleflex.glr.templates';

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(TMPL_KEY)) || []; } catch { return []; }
}
function saveTemplatesToStorage(t) {
  try { localStorage.setItem(TMPL_KEY, JSON.stringify(t)); } catch {}
}

// ── Capture current form state ──
function captureFormState() {
  const g = id => document.getElementById(id)?.value?.trim() ?? '';
  const r = name => document.querySelector(`input[name="${name}"]:checked`)?.value ?? '';
  const rAll = name => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(i => i.value);
  return {
    // Text inputs
    reqEmail:       g('reqEmail'),
    projManager:    g('projManager'),
    projName:       g('projName'),
    sustainingNum:  g('sustainingNum'),
    intakeNum:      g('intakeNum'),
    labelSpec:      g('labelSpec'),
    changeReqNum:   g('changeReqNum'),
    changeOrderNum: g('changeOrderNum'),
    projReason:     g('projReason'),
    projDesc:       g('projDesc'),
    qtyCodes:       g('qtyCodes'),
    riaRationale:   g('riaRationale'),
    costCenter:     g('costCenter'),
    mfgLocOther:    g('mfgLocOther'),
    geoOther:       g('geoOther'),
    cutoverDate:    g('cutoverDate'),
    foMarketingCM:  g('foMarketingCM'),
    foRACM:         g('foRACM'),
    foEngineeringCM:g('foEngineeringCM'),
    foMarketingMW:  g('foMarketingMW'),
    foRAMW:         g('foRAMW'),
    foEngineeringMW:g('foEngineeringMW'),
    cmComments:     g('cmComments'),
    mwComments:     g('mwComments'),
    // Radios
    bu:             r('bu'),
    lcr:            r('lcr'),
    pilotProd:      r('pilotProd'),
    designSite:     r('designSite'),
    aop:            r('aop'),
    mfgLoc:         r('mfgLoc'),
    geo:            r('geo'),
    npd:            r('npd'),
    newGtins:       r('newGtins'),
    newIpns:        r('newIpns'),
    newTranslations:r('newTranslations'),
    packagingImpact:r('packagingImpact'),
    labelSizeChange:r('labelSizeChange'),
    designWorkCM:   r('designWorkCM'),
    designWorkMW:   r('designWorkMW'),
    specifyOwnersCM:r('specifyOwnersCM'),
    specifyOwnersMW:r('specifyOwnersMW'),
    // Priority (multi-select cards)
    priority:       Array.from(document.querySelectorAll('.priority-card.selected')).map(c => c.dataset.p),
    // Language checkboxes
    langs:          rAll('langs'),
  };
}

// ── Apply a saved template to the form ──
function applyTemplate(state) {
  // 1. Text inputs
  const textFields = ['reqEmail','projManager','projName','sustainingNum','intakeNum',
    'labelSpec','changeReqNum','changeOrderNum','projReason','projDesc','qtyCodes',
    'riaRationale','costCenter','mfgLocOther','geoOther','cutoverDate',
    'foMarketingCM','foRACM','foEngineeringCM','foMarketingMW','foRAMW','foEngineeringMW',
    'cmComments','mwComments'];
  textFields.forEach(id => {
    const el = document.getElementById(id);
    if (el && state[id] !== undefined) el.value = state[id];
  });

  // 2. Priority cards
  document.querySelectorAll('.priority-card').forEach(card => {
    card.classList.toggle('selected', (state.priority || []).includes(card.dataset.p));
  });

  // 3. Radios — set in order so conditional reveals fire correctly
  const radioFields = ['bu','lcr','designSite','aop','mfgLoc','geo','npd',
    'newGtins','newIpns','newTranslations','packagingImpact','labelSizeChange',
    'designWorkCM','designWorkMW','specifyOwnersCM','specifyOwnersMW'];
  radioFields.forEach(name => {
    if (!state[name]) return;
    const radio = document.querySelector(`input[name="${name}"][value="${CSS.escape(state[name])}"]`);
    if (radio) radio.checked = true;
  });

  // 4. Language checkboxes
  document.querySelectorAll('input[name="langs"]').forEach(cb => {
    cb.checked = (state.langs || []).includes(cb.value);
  });

  // 5. Replay all conditional reveals in correct dependency order
  // LCR branch
  const lcrVal = state.lcr || '';
  const lcrIsYes = lcrVal.startsWith('Yes');
  toggle('lcrYesOnlyBlock', lcrIsYes);
  toggle('lcrSharedBlock', lcrVal !== '');
  toggle('lcrNoGeoBlock', lcrVal === 'No');

  // Reposition Production/Pilot widget on template restore
  const widget = document.getElementById('lcrPilotProd');
  if (lcrIsYes) {
    const selectedLabel = document.querySelector(`input[name="lcr"][value="${lcrVal}"]`)?.closest('label');
    if (selectedLabel) selectedLabel.insertAdjacentElement('afterend', widget);
    widget.style.display = 'flex';
  } else {
    widget.style.display = 'none';
  }

  // Design site sub-blocks (only on Yes path)
  if (state.designSite) evaluateDesignSite(state.designSite);

  // Translations sub-block
  toggle('translationsYesBlock', state.newTranslations === 'Yes');

  // MFG Other
  toggle('mfgLocOtherBlock', state.mfgLoc === 'Other');

  // Geo Other
  toggle('geoOtherBlock', state.geo === 'Other');

  // Functional owners expand
  toggle('foBlockCM', state.specifyOwnersCM === 'Yes');
  toggle('foBlockMW', state.specifyOwnersMW === 'Yes');

  // 6. Update derived UI
  syncCopyEmail();
  updateLangCount();
  updateProgress();

  // Scroll to top of form
  document.querySelector('.form-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Render template pills in the bar ──
function renderTemplatePills() {
  const templates = loadTemplates();
  const bar = document.getElementById('templatesBar');
  const container = document.getElementById('templatePills');
  if (!bar || !container) return;

  if (!templates.length) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = '';
  container.innerHTML = '';

  templates.forEach((t, i) => {
    const pill = document.createElement('div');
    pill.className = 'template-pill';
    pill.id = `tpill-${i}`;

    const name = document.createElement('span');
    name.className = 'template-pill-name';
    name.dataset.idx = i;
    name.title = `Load "${t.name}"`;
    name.textContent = t.name;

    const del = document.createElement('button');
    del.className = 'template-pill-del';
    del.id = `tdel-${i}`;
    del.type = 'button';
    del.dataset.idx = i;
    del.setAttribute('aria-label', `Delete template ${t.name}`);
    del.textContent = '×';

    pill.appendChild(name);
    pill.appendChild(del);
    container.appendChild(pill);
  });
}

// ── Event delegation for pill interactions ──
document.getElementById('templatePills').addEventListener('click', e => {
  const name = e.target.closest('.template-pill-name');
  const del  = e.target.closest('.template-pill-del');
  const cancel = e.target.closest('.template-pill-cancel');

  if (name) {
    const templates = loadTemplates();
    const t = templates[parseInt(name.dataset.idx, 10)];
    if (t) applyTemplate(t.state);
  }
  if (del && !del.classList.contains('confirm')) beginDeleteTemplate(parseInt(del.dataset.idx, 10));
  else if (del && del.classList.contains('confirm')) confirmDeleteTemplate(parseInt(del.dataset.idx, 10));
  if (cancel) cancelDeleteTemplate(parseInt(cancel.dataset.idx, 10));
});

function beginDeleteTemplate(idx) {
  const pill = document.getElementById(`tpill-${idx}`);
  const del  = document.getElementById(`tdel-${idx}`);
  if (!pill || !del) return;
  pill.classList.add('confirm-delete');
  del.classList.add('confirm');
  del.textContent = 'Delete?';

  const cancel = document.createElement('button');
  cancel.className = 'template-pill-cancel';
  cancel.type = 'button';
  cancel.dataset.idx = idx;
  cancel.textContent = '↩';
  pill.appendChild(cancel);

  del._cancelTimer = setTimeout(() => cancelDeleteTemplate(idx), 4000);
}
function confirmDeleteTemplate(idx) {
  const templates = loadTemplates();
  templates.splice(idx, 1);
  saveTemplatesToStorage(templates);
  renderTemplatePills();
}
function cancelDeleteTemplate(idx) {
  const pill = document.getElementById(`tpill-${idx}`);
  const del  = document.getElementById(`tdel-${idx}`);
  if (!pill || !del) return;
  clearTimeout(del._cancelTimer);
  pill.classList.remove('confirm-delete');
  del.classList.remove('confirm');
  del.textContent = '×';
  const c = pill.querySelector('.template-pill-cancel');
  if (c) c.remove();
}

// ── Save template UI ──
document.getElementById('saveTemplateBtn').addEventListener('click', () => {
  document.getElementById('templateSaveRow').style.display = 'flex';
  document.getElementById('templateNameInput').focus();
});
document.getElementById('cancelTemplateSave').addEventListener('click', cancelTemplateSave);
document.getElementById('confirmTemplateSave').addEventListener('click', confirmTemplateSave);
document.getElementById('templateNameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter')  { e.preventDefault(); confirmTemplateSave(); }
  if (e.key === 'Escape') cancelTemplateSave();
});

function cancelTemplateSave() {
  document.getElementById('templateSaveRow').style.display = 'none';
  document.getElementById('templateNameInput').value = '';
  document.getElementById('templateSaveHint').textContent = '';
}

function confirmTemplateSave() {
  const name = document.getElementById('templateNameInput').value.trim();
  const hint = document.getElementById('templateSaveHint');
  if (!name) { hint.textContent = 'Enter a name first.'; hint.style.color = 'var(--red)'; return; }

  const templates = loadTemplates();
  const existing  = templates.findIndex(t => t.name.toLowerCase() === name.toLowerCase());

  if (existing >= 0 && !hint.dataset.overwriteConfirmed) {
    hint.textContent = '';
    const warn = document.createElement('span');
    warn.className = 'preset-overwrite-warn';
    warn.textContent = `⚠ "${name}" already exists — Save again to overwrite.`;
    hint.appendChild(warn);
    hint.dataset.overwriteConfirmed = '1';
    setTimeout(() => { if (hint.dataset.overwriteConfirmed) { hint.textContent = ''; delete hint.dataset.overwriteConfirmed; } }, 5000);
    return;
  }

  const entry = { name, state: captureFormState(), saved: new Date().toISOString() };
  if (existing >= 0) templates[existing] = entry;
  else templates.push(entry);
  saveTemplatesToStorage(templates);
  renderTemplatePills();
  cancelTemplateSave();
  delete hint.dataset.overwriteConfirmed;

  // Brief confirmation flash on the save button
  const btn = document.getElementById('saveTemplateBtn');
  const orig = btn.innerHTML;
  btn.textContent = '✓ Saved!';
  btn.style.color = 'var(--green-dark)';
  btn.style.borderColor = 'var(--green-dark)';
  setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; btn.style.borderColor = ''; }, 2000);
}

/* ═══════════════════════════════════════════════
   INITIALISE
   ═══════════════════════════════════════════════ */
renderBuiltinPresets();
renderUserPresets();
renderTemplatePills();
initFieldCheckmarks();
applyDefaults();
syncCopyEmail();
updateProgress();

// Autofocus: if email was pre-filled from localStorage, skip to project name;
// otherwise focus email field so user can start typing immediately
const emailAtLoad = document.getElementById('reqEmail').value;
if (emailAtLoad && isValidEmail(emailAtLoad)) {
  document.getElementById('projName').focus();
} else {
  document.getElementById('reqEmail').focus();
}
