/**
 * Cloudflare Pages Function: Attach file to a Smartsheet row
 * POST /api/attach  (multipart/form-data with fields: sheetId, rowId, file)
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  return handleAttach(request, env);
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

async function handleAttach(request, env) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, 'Expected multipart/form-data');
  }

  const rowId = formData.get('rowId');
  const file  = formData.get('file');

  if (!rowId || !file || !(file instanceof File)) {
    return jsonError(400, 'Missing rowId or file');
  }

  // Smartsheet attachment endpoint expects the raw file body
  // with Content-Type set to the file's MIME type and
  // Content-Disposition with the filename
  const ssRes = await fetch(
    `https://api.smartsheet.com/2.0/sheets/${env.SMARTSHEET_SHEET_ID}/rows/${rowId}/attachments`,
    {
      method: 'POST',
      headers: {
        'Authorization':       `Bearer ${env.SMARTSHEET_TOKEN}`,
        'Content-Type':        file.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
        'Content-Length':      String(file.size),
      },
      body: file.stream(),
    }
  );

  if (!ssRes.ok) {
    const detail = await ssRes.text();
    console.error('Smartsheet attachment error:', ssRes.status, detail);
    return jsonError(502, `Attachment failed: ${detail}`);
  }

  const data = await ssRes.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: true, attachmentId: data?.result?.id ?? null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
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
