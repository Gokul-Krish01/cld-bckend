import { Client } from 'pg';

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

    // 1. Root path check
    if (url.pathname === '/') {
      return new Response("thambiii from Cloudflare Worker...CI/CD is working perfectly", {
        headers: corsHeaders
      });
    }

    // ================= D1 DATABASE ENDPOINTS =================

    // GET /items
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

    // POST /items
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

    // DELETE /items/:id
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

    // ================= NEON POSTGRES + HYPERDRIVE ENDPOINTS =================

   // GET /pg/items (Fetch from Neon Postgres via Hyperdrive)
    if (request.method === 'GET' && url.pathname === '/pg/items') {
      const client = new Client({
        connectionString: env.HYPERDRIVE.connectionString,
      });

      try {
        await client.connect();
        const result = await client.query('SELECT * FROM demo1 ORDER BY id ASC;'); // <-- items ku badhila demo1
        ctx.waitUntil(client.end());

        return new Response(JSON.stringify({ success: true, source: "Neon via Hyperdrive", data: result.rows }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        await client.end();
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /pg/items (Insert into Neon Postgres via Hyperdrive)
    if (request.method === 'POST' && url.pathname === '/pg/items') {
      const client = new Client({
        connectionString: env.HYPERDRIVE.connectionString,
      });

      try {
        const body = await request.json();
        await client.connect();

        if (body.text && body.text.trim() !== '') {
          await client.query('INSERT INTO demo1 (text) VALUES ($1);', [body.text.trim()]); // <-- items ku badhila demo1
        }

        const result = await client.query('SELECT * FROM demo1 ORDER BY id ASC;'); // <-- items ku badhila demo1
        ctx.waitUntil(client.end());

        return new Response(JSON.stringify({ success: true, source: "Neon via Hyperdrive", data: result.rows }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        await client.end();
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /pg/items (Insert into Neon Postgres via Hyperdrive)
    if (request.method === 'POST' && url.pathname === '/pg/items') {
      const client = new Client({
        connectionString: env.HYPERDRIVE.connectionString,
      });

      try {
        const body = await request.json();
        await client.connect();

        if (body.text && body.text.trim() !== '') {
          await client.query('INSERT INTO items (text) VALUES ($1);', [body.text.trim()]);
        }

        const result = await client.query('SELECT * FROM items ORDER BY id ASC;');
        ctx.waitUntil(client.end());

        return new Response(JSON.stringify({ success: true, source: "Neon via Hyperdrive", data: result.rows }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        await client.end();
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ================= R2 STORAGE ENDPOINTS =================

    // UPLOAD FILE: PUT /upload/:filename
    if (request.method === 'PUT' && url.pathname.startsWith('/upload/')) {
      try {
        const fileName = url.pathname.replace('/upload/', '');
        if (!fileName) {
          return new Response(JSON.stringify({ error: 'Filename is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.cld_bckend_bucket.put(fileName, request.body, {
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

    // LIST FILES: GET /files
    if (request.method === 'GET' && url.pathname === '/files') {
      try {
        const listed = await env.cld_bckend_bucket.list();
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

    // DELETE FILE: DELETE /files/:filename
    if (request.method === 'DELETE' && url.pathname.startsWith('/files/')) {
      try {
        const fileName = url.pathname.replace('/files/', '');
        if (!fileName) {
          return new Response(JSON.stringify({ error: 'Filename is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.cld_bckend_bucket.delete(fileName);

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