import { neon } from '@neondatabase/serverless';

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

    if (url.pathname === '/') {
      return new Response("thambiii from Cloudflare Worker! CI/CD is working perfectly with testttttttt", {
        headers: corsHeaders
      });
    }

    // ================= D1 DATABASE ENDPOINTS =================

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

    // ================= NEON POSTGRES (DIRECT POOLER VIA SECRET) =================

    if (request.method === 'GET' && url.pathname === '/pg/items') {
      try {
        const sql = neon(env.NEON_URL);
        
        await sql`
          CREATE TABLE IF NOT EXISTS demo1 (
            id SERIAL PRIMARY KEY,
            name TEXT,
            dob DATE
          );
        `;

        const rows = await sql`SELECT * FROM demo1 ORDER BY id ASC;`;

        return new Response(JSON.stringify({ success: true, source: "Neon Direct Pooler", data: rows }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/pg/items') {
      try {
        const body = await request.json();
        const sql = neon(env.NEON_URL);

        await sql`
          CREATE TABLE IF NOT EXISTS demo1 (
            id SERIAL PRIMARY KEY,
            name TEXT,
            dob DATE
          );
        `;

        if (body.name && body.name.trim() !== '') {
          await sql`INSERT INTO demo1 (name) VALUES (${body.name.trim()});`;
        }

        const rows = await sql`SELECT * FROM demo1 ORDER BY id ASC;`;

        return new Response(JSON.stringify({ success: true, source: "Neon Direct Pooler", data: rows }), {
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
    
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },
};