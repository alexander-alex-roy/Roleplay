export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Base CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': '*',
    };

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      const body = await request.json();

      // Route to appropriate NVIDIA API endpoint
      if (path === '/v1/chat/completions' || body.messages) {
        // Chat completions endpoint
        const { model, messages, temperature, max_tokens, top_p, stream, apiKey } = body;

        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'Missing API key' }), {
            status: 401,
            headers: { 
              'Content-Type': 'application/json', 
              ...corsHeaders 
            },
          });
        }

        const nvidiaResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: temperature ?? 0.8,
            max_tokens: max_tokens ?? 1024,
            top_p: top_p ?? 0.9,
            stream: stream ?? false,
          }),
        });

        if (!nvidiaResponse.ok) {
          const errorText = await nvidiaResponse.text();
          return new Response(errorText, {
            status: nvidiaResponse.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }

        if (stream) {
          return new Response(nvidiaResponse.body, {
            status: nvidiaResponse.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        }

        const data = await nvidiaResponse.json();
        return new Response(JSON.stringify(data), { 
          status: nvidiaResponse.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          }
        });

      } else if (path === '/v1/genai/stabilityai/stable-diffusion-3-medium' || body.prompt) {
        // Image generation endpoint (Stability AI via NVIDIA NIM)
        const { prompt, cfg_scale, aspect_ratio, seed, steps, negative_prompt, apiKey } = body;

        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'Missing API key' }), {
            status: 401,
            headers: { 
              'Content-Type': 'application/json', 
              ...corsHeaders 
            },
          });
        }

        const nvidiaResponse = await fetch('https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-medium', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            prompt: prompt,
            cfg_scale: cfg_scale ?? 5,
            aspect_ratio: aspect_ratio ?? "1:1",
            seed: seed ?? 0,
            steps: steps ?? 50,
            negative_prompt: negative_prompt ?? "",
          }),
        });

        if (!nvidiaResponse.ok) {
          const errorText = await nvidiaResponse.text();
          return new Response(errorText, {
            status: nvidiaResponse.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }

        const data = await nvidiaResponse.json();
        return new Response(JSON.stringify(data), { 
          status: nvidiaResponse.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          }
        });
      }

      return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      });
    }
  },
};