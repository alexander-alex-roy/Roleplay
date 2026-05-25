const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Expose-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_IMAGE_BASE = 'https://ai.api.nvidia.com/v1/genai';

export default {
  async fetch(request, _env, _ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'POST') {
      return jsonError('Method not allowed', 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body', 400);
    }

    const { apiKey } = body;
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return jsonError('Missing or invalid API key', 401);
    }

    if (body.prompt && !body.messages) {
      return handleImageGen(body, apiKey);
    }

    if (body.messages) {
      return handleChat(body, apiKey);
    }

    return jsonError('Cannot determine request type — provide either messages (chat) or prompt (image)', 400);
  },
};

async function handleChat(body, apiKey) {
  const { model, messages, temperature, max_tokens, top_p, stream } = body;
  const isStream = stream === true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let nvidiaRes;
  try {
    nvidiaRes = await fetch(NVIDIA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model ?? '',
        messages: messages ?? [],
        temperature: temperature ?? 0.8,
        max_tokens: max_tokens ?? 1024,
        top_p: top_p ?? 0.9,
        stream: isStream,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Request timed out after 120 seconds'
      : (err instanceof Error ? err.message : 'Upstream fetch failed');
    return jsonError(message, 502);
  }

  clearTimeout(timeout);

  if (!nvidiaRes.ok) {
    let message = `NVIDIA API error (${nvidiaRes.status})`;
    try {
      const errJson = await nvidiaRes.json();
      if (errJson?.detail) {
        const details = Array.isArray(errJson.detail)
          ? errJson.detail.map(d => d.msg || JSON.stringify(d)).join('; ')
          : String(errJson.detail);
        message += `: ${details}`;
      } else if (errJson?.error?.message) {
        message += `: ${errJson.error.message}`;
      } else {
        message += `: ${JSON.stringify(errJson).slice(0, 200)}`;
      }
    } catch {
      const raw = await nvidiaRes.text().catch(() => '');
      if (raw) message += `: ${raw.slice(0, 200)}`;
    }
    return jsonError(message, nvidiaRes.status);
  }

  if (isStream) {
    // FIX: Pass NVIDIA's stream directly without rewriting.
    // The client (ai-engine.ts) handles cumulative content correctly,
    // and the previous SSE rewriting was causing character repetition bugs.
    return new Response(nvidiaRes.body, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  const data = await nvidiaRes.json().catch(() => null);
  return new Response(JSON.stringify(data), {
    status: nvidiaRes.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function handleImageGen(body, apiKey) {
  const {
    prompt, model: requestedModel,
    cfg_scale, aspect_ratio, seed, steps,
    negative_prompt, height, width, image,
  } = body;

  const modelName = requestedModel || 'stabilityai/stable-diffusion-3-medium';
  const endpoint = `${NVIDIA_IMAGE_BASE}/${modelName}`;
  const requestBody = buildImageBody(modelName, { prompt, cfg_scale, aspect_ratio, seed, steps, negative_prompt, height, width, image });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let nvidiaRes;
  try {
    nvidiaRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Request timed out after 120 seconds'
      : (err instanceof Error ? err.message : 'Upstream fetch failed');
    return jsonError(message, 502);
  }

  clearTimeout(timeout);

  if (!nvidiaRes.ok) {
    let message = `NVIDIA API error (${nvidiaRes.status})`;
    try {
      const errJson = await nvidiaRes.json();
      if (errJson?.detail) {
        const details = Array.isArray(errJson.detail)
          ? errJson.detail.map(d => d.msg || JSON.stringify(d)).join('; ')
          : String(errJson.detail);
        message += `: ${details}`;
      } else if (errJson?.error?.message) {
        message += `: ${errJson.error.message}`;
      } else {
        message += `: ${JSON.stringify(errJson).slice(0, 200)}`;
      }
    } catch {
      const raw = await nvidiaRes.text().catch(() => '');
      if (raw) message += `: ${raw.slice(0, 200)}`;
    }
    return jsonError(message, nvidiaRes.status);
  }

  const data = await nvidiaRes.json().catch(() => null);
  return new Response(JSON.stringify(data), {
    status: nvidiaRes.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function buildImageBody(modelName, opts) {
  const { prompt, cfg_scale, aspect_ratio, seed, steps, negative_prompt, height, width, image } = opts;

  if (modelName === 'stabilityai/stable-diffusion-xl') {
    return {
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: cfg_scale ?? 5,
      height: height ?? 1024,
      width: width ?? 1024,
      clip_guidance_preset: 'NONE',
      sampler: 'K_DPM_2_ANCESTRAL',
      samples: 1,
      seed: seed ?? 0,
      steps: steps ?? 25,
      style_preset: 'none',
    };
  }

  if (modelName === 'black-forest-labs/flux.1-dev') {
    return {
      prompt,
      height: height ?? 1024,
      width: width ?? 1024,
      cfg_scale: cfg_scale ?? 5,
      mode: 'base',
      samples: 1,
      seed: seed ?? 0,
      steps: steps ?? 50,
    };
  }

  if (modelName === 'black-forest-labs/flux.1-schnell') {
    return {
      prompt,
      height: height ?? 1024,
      width: width ?? 1024,
      cfg_scale: 0,
      mode: 'base',
      samples: 1,
      seed: seed ?? 0,
      steps: steps ?? 4,
    };
  }

  if (modelName === 'black-forest-labs/flux.2-klein-4b') {
    return {
      prompt,
      height: height ?? 1024,
      width: width ?? 1024,
      cfg_scale: 1,
      samples: 1,
      seed: seed ?? 0,
      steps: steps ?? 4,
    };
  }

  if (modelName === 'stabilityai/stable-diffusion-3-medium') {
    return {
      prompt,
      cfg_scale: cfg_scale ?? 5,
      aspect_ratio: aspect_ratio ?? '1:1',
      seed: seed ?? 0,
      steps: steps ?? 50,
      negative_prompt: negative_prompt ?? '',
    };
  }



  if (modelName === 'black-forest-labs/flux.1-kontext-dev') {
    const body = {
      prompt,
      guidance_scale: cfg_scale ?? 7,
      num_inference_steps: steps ?? 28,
    };
    if (image) body.image = image;
    return body;
  }

  return {
    prompt,
    cfg_scale: cfg_scale ?? 5,
    aspect_ratio: aspect_ratio ?? '1:1',
    seed: seed ?? 0,
    steps: steps ?? 50,
    negative_prompt: negative_prompt ?? '',
  };
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}