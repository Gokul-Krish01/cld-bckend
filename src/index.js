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
      return new Response("thambiii from Cloudflare Worker! CI/CD is working perfectly with testttttttt", {
        headers: corsHeaders
      });
    }

    // 2. GET /items
    if (request.method === 'GET' && url.pathname === '/items') {
      try {
        const { results } = await env.DB.prepare("SELECT text FROM items ORDER BY id ASC").all();
        const itemsList = results.map(row => row.text);

        return new Response(JSON.stringify(itemsList), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 3. POST /items
    if (request.method === 'POST' && url.pathname === '/items') {
      try {
        const body = await request.json();
        if (body.text && body.text.trim() !== '') {
          await env.DB.prepare("INSERT INTO items (text) VALUES (?)").bind(body.text.trim()).run();
        }

        // Return updated items list from DB to match original response format
        const { results } = await env.DB.prepare("SELECT text FROM items ORDER BY id ASC").all();
        const itemsList = results.map(row => row.text);

        return new Response(JSON.stringify({ success: true, items: itemsList }), {
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
      try {
        const index = parseInt(url.pathname.split('/')[2]);
        
        if (!isNaN(index) && index >= 0) {
          // Find the exact item id based on index position to safely delete
          const { results } = await env.DB.prepare("SELECT id FROM items ORDER BY id ASC").all();
          if (index < results.length) {
            const targetId = results[index].id;
            await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(targetId).run();
          }
        }

        // Return updated items list after deletion
        const { results } = await env.DB.prepare("SELECT text FROM items ORDER BY id ASC").all();
        const itemsList = results.map(row => row.text);

        return new Response(JSON.stringify({ success: true, items: itemsList }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};