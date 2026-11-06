let items = [];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. Root path check (Welcome message)
    if (url.pathname === '/') {
      return new Response("Hello from Cloudflare Worker! is working perfectly with testttttttt", {
        headers: corsHeaders
      });
    }

    // 2. GET /items
    if (request.method === 'GET' && url.pathname === '/items') {
      return new Response(JSON.stringify(items), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. POST /items
    if (request.method === 'POST' && url.pathname === '/items') {
      try {
        const body = await request.json();
        if (body.text && body.text.trim() !== '') {
          items.push(body.text.trim());
        }
        return new Response(JSON.stringify({ success: true, items }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 4. DELETE /items/:id
    if (request.method === 'DELETE' && url.pathname.startsWith('/items/')) {
      const index = parseInt(url.pathname.split('/')[2]);
      if (!isNaN(index) && index >= 0 && index < items.length) {
        items.splice(index, 1);
      }
      return new Response(JSON.stringify({ success: true, items }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};