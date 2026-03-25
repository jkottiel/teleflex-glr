// v1.2
/**
 * Cloudflare Pages Function: GLR Form → Smartsheet API proxy
 * Location in repo: functions/api/submit-glr.js
 * Route: /api/submit-glr
 *
 * Environment variables required in Cloudflare Pages → Settings → Variables:
 *   SMARTSHEET_TOKEN    (encrypted secret)
 *   SMARTSHEET_SHEET_ID (plain variable — value: 5899214229137284)
 */

// ── Pages Functions entry points ──
export async function onRequestPost(context) {
  return handleSubmit(context.request, context.env);
}
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

// ── Smartsheet column IDs (hardcoded — these never change) ──
const COL = {
  REQUESTER_EMAIL:    2412380288247684,
  LCR:                2060266454181764,
  CHANGE_REQ_NUM:     6563866081552260,
  CHANGE_ORDER_NUM:   2678552338425732,
  PROJECT_NAME:       5790080008775556,
  BUSINESS_UNIT:      6060580501671812,
  PROJECT_MANAGER:    6967228513445764,
  PRIORITY:           3275941560143748,
  SUSTAINING_PROJECT: 234618599985028,
  SUSTAINING_INTAKE:  1891015004475268,
  LABEL_SPEC:         3360099978137476,
  DESIGN_SITE:        1728610757306244,
  PROJECT_DESC:       3538280195090308,
  PROJECT_REASON:     1978549869537156,
  NEW_TRANSLATIONS:   8480375414515588,
  QTY_CODES:          5148129047668612,
  LANGUAGES:          317601089906564,
  AOP:                7358110291519364,
  MFG_LOCATION:       6232210384676740,
  MFG_LOCATION_OTHER: 5009087366752132,
  GEOGRAPHIES:        3980410570991492,
  GEOGRAPHIES_OTHER:  4024938342442884,
  NPD:                8484010198361988,
  CUTOVER_DATE:       4824835501123460,
  RIA_RATIONALE:      5383067978911620,
  NEW_GTINS:          3131268165226372,
  NEW_IPNS:           7634867792596868,
  COST_CENTER:        6508967885754244,
  PACKAGING_IMPACT:   4257168072068996,
  LABEL_SIZE_CHANGE:  8760767699439492,
  DESIGN_WORK:        4103345351380868,
  FUNCTIONAL_OWNERS:  115768806297476,
  COMMENTS:           3190200709631876,
};

// Valid MFG location picklist values
const MFG_OPTIONS = [
  'Chelmsford','Chihuahua','Hradec','Juventud','Kamunting',
  'Kulim','Maple Grove','Nuevo Laredo','Tecate','Zdar','Chihuahua/Zdar',
];

async function handleSubmit(request, env) {
  // ── Parse body ──
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON payload');
  }

  // ── Required field validation ──
  for (const field of ['requesterEmail','projectManager','projectName','businessUnit','lcr']) {
    if (!body[field] || String(body[field]).trim() === '') {
      return jsonError(400, `Missing required field: ${field}`);
    }
  }
  if (!isValidEmail(body.requesterEmail)) {
    return jsonError(400, 'Invalid requester email');
  }

  // ── Value transformations ──

  // LCR picklist only accepts "Yes" or "No"
  const lcrValue = String(body.lcr).startsWith('Yes') ? 'Yes' : 'No';

  // Priority: form sends ['1','2'] → sheet expects 'Priority 1\nPriority 2'
  const priorityValue = Array.isArray(body.priority)
    ? body.priority.map(p => `Priority ${p}`).join('\n')
    : (body.priority || '');

  // Design Work: form sends 'Combination' → sheet expects full string
  const designWorkMap = {
    'Manual Label Design': 'Manual Label Design',
    'Kallik Label Design':  'Kallik Label Design',
    'Combination':          'Combination of Kallik and Manual Label Design',
  };
  const designWorkValue = designWorkMap[body.designWork] || body.designWork || '';

  // MFG Location: if value isn't in the picklist, send 'Other' to MFG_LOCATION
  // and the typed value to MFG_LOCATION_OTHER
  const mfgIsOther   = !MFG_OPTIONS.includes(body.mfgLocation);
  const mfgValue     = mfgIsOther ? 'Other'            : body.mfgLocation;
  const mfgOtherVal  = mfgIsOther ? body.mfgLocation   : '';

  // Geographies Other: only populate if 'Other' was selected
  const geoOtherVal  = body.geographies === 'Other' ? (body.geoOther || '') : '';

  // Languages: join array to comma-separated string
  const languagesVal = Array.isArray(body.languages) ? body.languages.join(', ') : '';

  // ── Build cells (skip blank values) ──
  const cells = [
    cell(COL.REQUESTER_EMAIL,    body.requesterEmail),
    cell(COL.LCR,                lcrValue),
    cell(COL.CHANGE_REQ_NUM,     body.changeReqNum),
    cell(COL.CHANGE_ORDER_NUM,   body.changeOrderNum),
    cell(COL.PROJECT_NAME,       body.projectName),
    cell(COL.BUSINESS_UNIT,      body.businessUnit),
    cell(COL.PROJECT_MANAGER,    body.projectManager),
    cell(COL.PRIORITY,           priorityValue),
    cell(COL.SUSTAINING_PROJECT, body.sustainingProject),
    cell(COL.SUSTAINING_INTAKE,  body.sustainingIntake),
    cell(COL.LABEL_SPEC,         body.labelSpec),
    cell(COL.DESIGN_SITE,        body.designSite),
    cell(COL.PROJECT_DESC,       body.projectDesc),
    cell(COL.PROJECT_REASON,     body.projectReason),
    cell(COL.NEW_TRANSLATIONS,   body.newTranslations),
    cell(COL.QTY_CODES,          body.qtyCodes),
    cell(COL.LANGUAGES,          languagesVal),
    cell(COL.AOP,                body.aop),
    cell(COL.MFG_LOCATION,       mfgValue),
    cell(COL.MFG_LOCATION_OTHER, mfgOtherVal),
    cell(COL.GEOGRAPHIES,        body.geographies),
    cell(COL.GEOGRAPHIES_OTHER,  geoOtherVal),
    cell(COL.NPD,                body.npd),
    cell(COL.CUTOVER_DATE,       body.cutoverDate),
    cell(COL.RIA_RATIONALE,      body.riaRationale),
    cell(COL.NEW_GTINS,          body.newGtins),
    cell(COL.NEW_IPNS,           body.newIpns),
    cell(COL.COST_CENTER,        body.costCenter),
    cell(COL.PACKAGING_IMPACT,   body.packagingImpact),
    cell(COL.LABEL_SIZE_CHANGE,  body.labelSizeChange),
    cell(COL.DESIGN_WORK,        designWorkValue),
    cell(COL.FUNCTIONAL_OWNERS,  body.functionalOwners),
    cell(COL.COMMENTS,           body.comments),
  ].filter(c => c.value !== '' && c.value !== null && c.value !== undefined);

  // ── POST to Smartsheet ──
  const ssRes = await fetch(
    `https://api.smartsheet.com/2.0/sheets/${env.SMARTSHEET_SHEET_ID}/rows`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${env.SMARTSHEET_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ cells }),
    }
  );

  if (!ssRes.ok) {
    const detail = await ssRes.text();
    console.error('Smartsheet error:', ssRes.status, detail);
    return jsonError(502, `Smartsheet error ${ssRes.status}: ${detail}`);
  }

  // Return the auto-number LP-##### as the reference
  const ssData  = await ssRes.json().catch(() => ({}));
  const autoNum = ssData?.result?.[0]?.cells?.find(c => c.columnId === 1286480381405060)?.displayValue ?? null;

  return new Response(JSON.stringify({ ok: true, referenceId: autoNum }), {
    status:  200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ── Helpers ──
function cell(columnId, value) {
  return { columnId, value: value ?? '' };
}
function isValidEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(val).trim());
}
function jsonError(status, message) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
