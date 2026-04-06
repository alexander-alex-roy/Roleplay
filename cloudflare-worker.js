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
    return jsonError(err instanceof Error ? err.message : 'Upstream fetch failed', 502);
  }

  clearTimeout(timeout);

  if (!nvidiaRes.ok) {
    const errorText = await nvidiaRes.text().catch(() => `HTTP ${nvidiaRes.status}`);
    return new Response(errorText, {
      status: nvidiaRes.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
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

/**
 * Rewrite NVIDIA NIM SSE stream so every data chunk carries a true delta.
 *
 * FIX: emittedLength is now tracked per choice index to handle multi-choice
 * responses correctly, and null delta.content is handled for finish_reason chunks.
 */
async function rewriteNvidiaSSE(readable, writable) {
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';
  // Per-choice cursor: tracks how many characters we have already forwarded
  // for each choice index. NVIDIA sends cumulative content so we slice the
  // new suffix each chunk.
  const emittedLengthByChoice = {};

  const reader = readable.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) {
          await writer.write(encoder.encode(line + '\n'));
          continue;
        }

        if (!trimmed.startsWith('data:')) {
          await writer.write(encoder.encode(line + '\n'));
          continue;
        }

        const dataStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);

        if (dataStr === '[DONE]') {
          await writer.write(encoder.encode('data: [DONE]\n\n'));
          continue;
        }

        let chunk;
        try { chunk = JSON.parse(dataStr); }
        catch {
          await writer.write(encoder.encode(line + '\n'));
          continue;
        }

        if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
          const choice = chunk.choices[0];
          const delta = choice?.delta;
          const finishReason = choice?.finish_reason;
          const choiceIndex = choice?.index ?? 0;

          if (delta && typeof delta.content === 'string') {
            // NVIDIA sends cumulative content — slice to get only the new suffix.
            if (emittedLengthByChoice[choiceIndex] === undefined) {
              emittedLengthByChoice[choiceIndex] = 0;
            }
            const cumulativeContent = delta.content;
            const deltaOnly = cumulativeContent.slice(emittedLengthByChoice[choiceIndex]);
            emittedLengthByChoice[choiceIndex] = cumulativeContent.length;

            // Skip chunks with no new content and no finish_reason.
            if (!deltaOnly && !finishReason) continue;

            chunk.choices[0].delta.content = deltaOnly;
          }
          // If delta.content is null/undefined but there's a finish_reason,
          // fall through and forward the chunk as-is (don't drop it).
        }

        await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
    }

    if (buffer.trim()) {
      await writer.write(encoder.encode(buffer));
    }
  } catch {
    // Stream closed or aborted — nothing to do.
  } finally {
    writer.close().catch(() => undefined);
    reader.releaseLock();
  }
}

async function handleImageGen(body, apiKey) {
  const {
    prompt, model: requestedModel,
    cfg_scale, aspect_ratio, seed, steps,
    negative_prompt, height, width,
  } = body;

  const modelName = requestedModel || 'stabilityai/stable-diffusion-3-medium';
  const endpoint = `${NVIDIA_IMAGE_BASE}/${modelName}`;
  const requestBody = buildImageBody(modelName, { prompt, cfg_scale, aspect_ratio, seed, steps, negative_prompt, height, width });

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
    return jsonError(err instanceof Error ? err.message : 'Upstream fetch failed', 502);
  }

  clearTimeout(timeout);

  if (!nvidiaRes.ok) {
    const errorText = await nvidiaRes.text().catch(() => `HTTP ${nvidiaRes.status}`);
    return new Response(errorText, {
      status: nvidiaRes.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const data = await nvidiaRes.json().catch(() => null);
  return new Response(JSON.stringify(data), {
    status: nvidiaRes.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function buildImageBody(modelName, opts) {
  const { prompt, cfg_scale, aspect_ratio, seed, steps, negative_prompt, height, width } = opts;

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