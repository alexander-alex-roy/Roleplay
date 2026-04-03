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

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    try {
      const body = await request.json();
      const { model, messages, temperature, max_tokens, top_p, stream, apiKey } = body;

      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Missing API key' }), {
          status: 401,
          headers: { 
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Origin': '*' 
          },
        });
      }

      // NVIDIA expects model IDs in format like "meta/llama-3.1-405b-instruct"
      // Your client is sending IDs like "meta/llama-3.1-405b-instruct" which should work
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

      // Base CORS headers for all responses
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': '*',
      };

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
        // For streaming, we need to pipe the response but add CORS headers
        // Create a new Response with the same body but our headers
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
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          'Access-Control-Allow-Origin': '*' 
        },
      });
    }
  },
};