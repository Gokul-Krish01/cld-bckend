import { Pool } from 'pg';

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
      return new Response("thambiii from Cloudflare Worker!CI/CD is working perfectly", {
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
        return new Response(JSON.stringify({ error: 'Invalid JSON or Request' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ================= HYPERDRIVE + NEON POSTGRES ENDPOINTS =================

    if (request.method === 'GET' && url.pathname === '/pg/items') {
      try {
        const pool = new Pool({
          connectionString: env.HYPERDRIVE.connectionString,
          max: 1,
        });

        const client = await pool.connect();
        
        await client.query(`
          CREATE TABLE IF NOT EXISTS demo1 (
            id SERIAL PRIMARY KEY,
            name TEXT,
            dob DATE
          );
        `);

        const res = await client.query('SELECT * FROM demo1 ORDER BY id ASC;');
        
        client.release();
        await pool.end();

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Hyperdrive + Neon connected successfully!", 
          data: res.rows 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/pg/items') {
      try {
        const body = await request.json();
        const pool = new Pool({
          connectionString: env.HYPERDRIVE.connectionString,
          max: 1,
        });

        const client = await pool.connect();

        await client.query(`
          CREATE TABLE IF NOT EXISTS demo1 (
            id SERIAL PRIMARY KEY,
            name TEXT,
            dob DATE
          );
        `);

        if (body.name && body.name.trim() !== '') {
          await client.query('INSERT INTO demo1 (name) VALUES ($1);', [body.name.trim()]);
        }

        const res = await client.query('SELECT * FROM demo1 ORDER BY id ASC;');
        
        client.release();
        await pool.end();

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Item inserted via Hyperdrive!", 
          data: res.rows 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ================= R2 STORAGE ENDPOINTS =================

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