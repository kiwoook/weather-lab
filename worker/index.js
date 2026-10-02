// Dify 프록시: 앱 키는 Worker secret(DIFY_KEY)에만 두고, 허용된 Origin의 요청만 /workflows/run 으로 전달한다.
// ponytail: Origin 검사는 브라우저 남용만 막는다(curl은 위조 가능). 남용되면 Cloudflare 레이트 리밋 규칙 추가.
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    if (!allowed) return new Response('forbidden', { status: 403, headers: cors });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/workflows/run') {
      return new Response('not found', { status: 404, headers: cors });
    }

    const key = (env.DIFY_KEY || '').trim();
    if (!key) return new Response('{"message":"DIFY_KEY secret 비어 있음"}', { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

    let inputs;
    try { ({ inputs } = await req.json()); } catch { return new Response('bad json', { status: 400, headers: cors }); }

    // inputs만 받아서 전달: response_mode, user는 서버에서 고정
    const res = await fetch(`${env.DIFY_URL}/workflows/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs, response_mode: 'blocking', user: 'demo-user' }),
    });
    return new Response(res.body, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
