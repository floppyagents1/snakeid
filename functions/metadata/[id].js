// functions/metadata/[id].js
// Serves GET /metadata/<id> (1..10000) for SnakeID.
// The NFT contract's baseURI is https://snakeid.xyz/metadata/ and must NOT
// change, so this Function reproduces the exact metadata JSON that used to
// live as 10,000 static files in metadata/<id>, from the single bundled
// static asset /traits.json (trait + tier per tokenId).
// Routing (Cloudflare Pages Functions, file-based): this file maps to
// /metadata/:id and context.params.id holds the matched segment.

const DESCRIPTION =
  'SnakeID \u2014 10,000 snakes, one ID to collect them all. Minted by agents on BNB Chain. 12 shapes, 12 colors, true rarity \u2014 from Common to Legendary.';

let traitsPromise = null;

function loadTraits(env, request) {
  if (!traitsPromise) {
    traitsPromise = env.ASSETS.fetch(new URL('/traits.json', request.url)).then(
      async (res) => {
        if (!res.ok) throw new Error('traits.json asset missing: ' + res.status);
        return res.json();
      }
    );
  }
  return traitsPromise;
}

function buildMetadata(id, t) {
  return {
    name: 'SnakeID #' + id,
    description: DESCRIPTION,
    image: 'https://snakeid.xyz/snake-' + id + '.webp',
    external_url: 'https://snakeid.xyz',
    attributes: [
      { trait_type: 'Shape', value: t.shape },
      { trait_type: 'Body Color', value: t.color },
      { trait_type: 'Pattern', value: t.pattern },
      { trait_type: 'Background', value: t.bg },
      { trait_type: 'Food Dot', value: t.food ? 'Yes' : 'No' },
      { trait_type: 'Rarity', value: t.tier },
    ],
  };
}

// Reproduce Python json.dumps(obj, indent=2, ensure_ascii=True) byte-for-byte:
// 2-space indent, no trailing newline, non-ASCII escaped as \uXXXX.
function asciiJson(obj) {
  return JSON.stringify(obj, null, 2).replace(/[^\x00-\x7F]/g, (c) =>
    '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  );
}

function notFound() {
  return new Response(JSON.stringify({ error: 'not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const raw = context.params.id;
  // Strict: digits only, no leading zeros, 1..10000.
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return notFound();
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1 || id > 10000) return notFound();
  if (String(id) !== raw) return notFound();
  let traits;
  try {
    traits = await loadTraits(context.env, context.request);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'metadata unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const t = traits[String(id)];
  if (!t) return notFound();
  return new Response(asciiJson(buildMetadata(id, t)), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
