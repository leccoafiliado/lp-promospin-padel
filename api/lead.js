// Conversions API da Meta: manda o Lead pelo servidor, com o mesmo event_id do
// pixel (a Meta deduplica). Sem META_CAPI_TOKEN configurado na Vercel, não faz nada.
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   META_CAPI_TOKEN       token gerado no Gerenciador de Eventos > pixel > Configurações
//   META_TEST_EVENT_CODE  (opcional) código de teste, para ver os eventos em "Testar eventos"
//   META_GRAPH_VERSION    (opcional) versão da Graph API, padrão v24.0
const PIXEL_ID = '1627168662115326';
const HOSTS_OK = /(^|\.)promospin\.com\.br$|\.vercel\.app$|^localhost$/;

const texto = (v, max) => (typeof v === 'string' && v && v.length <= max ? v : undefined);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  // só aceita beacon da própria página (evita lead falso vindo de outro site)
  try {
    const origem = req.headers.origin;
    if (origem && !HOSTS_OK.test(new URL(origem).hostname)) return res.status(403).end();
  } catch {
    return res.status(403).end();
  }

  const token = process.env.META_CAPI_TOKEN;
  if (!token) return res.status(204).end();

  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = null; }
  }
  if (!b || typeof b !== 'object') return res.status(400).end();

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const evento = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    event_id: texto(b.event_id, 100),
    action_source: 'website',
    event_source_url: texto(b.url, 2000),
    user_data: {
      client_ip_address: ip || undefined,
      client_user_agent: texto(req.headers['user-agent'], 1000),
      fbp: texto(b.fbp, 200),
      fbc: texto(b.fbc, 500),
    },
    custom_data: { content_name: 'Grupo VIP PromoPadel' },
  };

  const corpo = { data: [evento], access_token: token };
  if (process.env.META_TEST_EVENT_CODE) corpo.test_event_code = process.env.META_TEST_EVENT_CODE;
  const versao = process.env.META_GRAPH_VERSION || 'v24.0';

  try {
    const r = await fetch(`https://graph.facebook.com/${versao}/${PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) console.error('capi', r.status, (await r.text()).slice(0, 500));
  } catch (e) {
    console.error('capi', e && e.message);
  }
  return res.status(204).end();
};
