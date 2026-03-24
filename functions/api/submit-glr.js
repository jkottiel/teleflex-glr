/**
 * Cloudflare Pages Function: GLR Form → Smartsheet API proxy
 * File location in repo: functions/api/submit-glr.js
 * This automatically handles requests to /api/submit-glr
 *
 * Environment variables to set in Cloudflare Pages → Settings → Variables:
 *   SMARTSHEET_TOKEN      (encrypted secret)
 *   SMARTSHEET_SHEET_ID   (plain variable)
 *   COL_REQUESTER_EMAIL, COL_PROJECT_MANAGER, COL_PROJECT_NAME ...
 *   (see COLUMNS map below for full list)
 */

// ── Entry point for Pages Functions ──
export async function onRequestPost(context) {
  const { request, env } = context;
  return handleSubmit(request, env);
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

async function handleSubmit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON payload');
  }

  // ── Basic validation ──
  const required = ['requesterEmail', 'projectManager', 'projectName', 'businessUnit', 'lcr'];
  for (const field of required) {
    if (!body[field] || String(body[field]).trim() === '') {
      return jsonError(400, `Missing required field: ${field}`);
    }
  }

  if (!isValidEmail(body.requesterEmail)) {
    return jsonError(400, 'Invalid requester email');
  }

  // ── Smartsheet column ID map ──
  // Set each COL_* as an environment variable in Cloudflare Pages.
  // Get IDs by running:
  //   curl -H "Authorization: Bearer YOUR_TOKEN" \
  //     https://api.smartsheet.com/2.0/sheets/YOUR_SHEET_ID/columns
  const COLUMNS = {
    REQUESTER_EMAIL:    env.COL_REQUESTER_EMAIL,
    PROJECT_MANAGER:    env.COL_PROJECT_MANAGER,
    PROJECT_NAME:       env.COL_PROJECT_NAME,
    PRIORITY:           env.COL_PRIORITY,
    SUSTAINING_PROJECT: env.COL_SUSTAINING_PROJECT,
    SUSTAINING_INTAKE:  env.COL_SUSTAINING_INTAKE,
    LABEL_SPEC:         env.COL_LABEL_SPEC,
    BUSINESS_UNIT:      env.COL_BUSINESS_UNIT,
    LCR:                env.COL_LCR,
    CHANGE_REQ_NUM:     env.COL_CHANGE_REQ_NUM,
    CHANGE_ORDER_NUM:   env.COL_CHANGE_ORDER_NUM,
    PROJECT_REASON:     env.COL_PROJECT_REASON,
    PROJECT_DESC:       env.COL_PROJECT_DESC,
    DESIGN_SITE:        env.COL_DESIGN_SITE,
    AOP:                env.COL_AOP,
    MFG_LOCATION:       env.COL_MFG_LOCATION,
    GEOGRAPHIES:        env.COL_GEOGRAPHIES,
    NPD:                env.COL_NPD,
    QTY_CODES:          env.COL_QTY_CODES,
    CUTOVER_DATE:       env.COL_CUTOVER_DATE,
    NEW_GTINS:          env.COL_NEW_GTINS,
    NEW_IPNS:           env.COL_NEW_IPNS,
    NEW_TRANSLATIONS:   env.COL_NEW_TRANSLATIONS,
    COST_CENTER:        env.COL_COST_CENTER,
    LANGUAGES:          env.COL_LANGUAGES,
    RIA_RATIONALE:      env.COL_RIA_RATIONALE,
    PACKAGING_IMPACT:   env.COL_PACKAGING_IMPACT,
    LABEL_SIZE_CHANGE:  env.COL_LABEL_SIZE_CHANGE,
    DESIGN_WORK:        env.COL_DESIGN_WORK,
    FUNCTIONAL_OWNER:   env.COL_FUNCTIONAL_OWNER,
    COMMENTS:           env.COL_COMMENTS,
    SEND_COPY:          env.COL_SEND_COPY,
    ADDITIONAL_EMAIL:   env.COL_ADDITIONAL_EMAIL,
  };

  // ── Build Smartsheet row cells ──
  const cells = [
    cell(COLUMNS.REQUESTER_EMAIL,    body.requesterEmail),
    cell(COLUMNS.PROJECT_MANAGER,    body.projectManager),
    cell(COLUMNS.PROJECT_NAME,       body.projectName),
    cell(COLUMNS.PRIORITY,           Array.isArray(body.priority) ? body.priority.join(', ') : body.priority),
    cell(COLUMNS.SUSTAINING_PROJECT, body.sustainingProject),
    cell(COLUMNS.SUSTAINING_INTAKE,  body.sustainingIntake),
    cell(COLUMNS.LABEL_SPEC,         body.labelSpec),
    cell(COLUMNS.BUSINESS_UNIT,      body.businessUnit),
    cell(COLUMNS.LCR,                body.lcr),
    cell(COLUMNS.CHANGE_REQ_NUM,     body.changeReqNum),
    cell(COLUMNS.CHANGE_ORDER_NUM,   body.changeOrderNum),
    cell(COLUMNS.PROJECT_REASON,     body.projectReason),
    cell(COLUMNS.PROJECT_DESC,       body.projectDesc),
    cell(COLUMNS.DESIGN_SITE,        body.designSite),
    cell(COLUMNS.AOP,                body.aop),
    cell(COLUMNS.MFG_LOCATION,       body.mfgLocation),
    cell(COLUMNS.GEOGRAPHIES,        body.geographies),
    cell(COLUMNS.NPD,                body.npd),
    cell(COLUMNS.QTY_CODES,          body.qtyCodes),
    cell(COLUMNS.CUTOVER_DATE,       body.cutoverDate),
    cell(COLUMNS.NEW_GTINS,          body.newGtins),
    cell(COLUMNS.NEW_IPNS,           body.newIpns),
    cell(COLUMNS.NEW_TRANSLATIONS,   body.newTranslations),
    cell(COLUMNS.COST_CENTER,        body.costCenter),
    cell(COLUMNS.LANGUAGES,          Array.isArray(body.languages) ? body.languages.join(', ') : ''),
    cell(COLUMNS.RIA_RATIONALE,      body.riaRationale),
    cell(COLUMNS.PACKAGING_IMPACT,   body.packagingImpact),
    cell(COLUMNS.LABEL_SIZE_CHANGE,  body.labelSizeChange),
    cell(COLUMNS.DESIGN_WORK,        body.designWork),
    cell(COLUMNS.FUNCTIONAL_OWNER,   body.functionalOwners),
    cell(COLUMNS.COMMENTS,           body.comments),
    cell(COLUMNS.SEND_COPY,          body.sendCopyToSelf ? 'Yes' : 'No'),
    cell(COLUMNS.ADDITIONAL_EMAIL,   body.additionalEmail),
  ].filter(c => c.columnId && c.value !== '' && c.value !== null && c.value !== undefined);

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
    return jsonError(502, 'Failed to submit to Smartsheet. Please try again or contact your labeling representative.');
  }

  // Return the Smartsheet row ID as a reference number
  const ssData = await ssRes.json().catch(() => ({}));
  const rowId  = ssData?.result?.[0]?.id ?? null;

  return new Response(JSON.stringify({ ok: true, referenceId: rowId ? `LP-${rowId}` : null }), {
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
