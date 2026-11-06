export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

    // ================= D1 DATABASE ENDPOINTS =================

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
          const { results } = await env.DB.prepare("SELECT id FROM items ORDER BY id ASC").all();
          if (index < results.length) {
            const targetId = results[index].id;
            await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(targetId).run();
          }
        }

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

    // ================= R2 STORAGE ENDPOINTS =================

    // 5. UPLOAD FILE: PUT /upload/:filename
    if (request.method === 'PUT' && url.pathname.startsWith('/upload/')) {
      try {
        const fileName = url.pathname.replace('/upload/', '');
        if (!fileName) {
          return new Response(JSON.stringify({ error: 'Filename is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.MY_BUCKET.put(fileName, request.body, {
          httpMetadata: { contentType: request.headers.get('content-type') || 'application/octet-stream' }
        });

        return new Response(JSON.stringify({ success: true, uploaded: fileName }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 6. LIST FILES: GET /files
    if (request.method === 'GET' && url.pathname === '/files') {
      try {
        const listed = await env.MY_BUCKET.list();
        const files = listed.objects.map(obj => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded
        }));

        return new Response(JSON.stringify({ success: true, files }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 7. DELETE FILE: DELETE /files/:filename
    if (request.method === 'DELETE' && url.pathname.startsWith('/files/')) {
      try {
        const fileName = url.pathname.replace('/files/', '');
        if (!fileName) {
          return new Response(JSON.stringify({ error: 'Filename is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.MY_BUCKET.delete(fileName);

        return new Response(JSON.stringify({ success: true, deleted: fileName }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },
};