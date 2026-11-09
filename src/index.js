import { Pool } from 'pg';

// ================= 1. DURABLE OBJECT CLASS =================
export class Counter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    let value = await this.state.storage.get("value") || 0;

    if (request.method === 'POST') {
      value++;
      await this.state.storage.put("value", value);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      durableObjectValue: value,
      message: "Handled inside Stateful Durable Object!" 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ================= 2. MAIN WORKER =================
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

    // ================= DURABLE OBJECT ROUTING =================
    if (url.pathname.startsWith('/do/')) {
      try {
        // Oru fixed ID use panrom (e.g., "global-counter-instance")
        let id = env.COUNTER_DO.idFromName("global-counter-instance");
        let stub = env.COUNTER_DO.get(id);
        
        // Request-a Durable Object-ku forward panrom
        let doRequestUrl = new URL(request.url);
        doRequestUrl.pathname = doRequestUrl.pathname.replace('/do', '');
        
        return await stub.fetch(new Request(doRequestUrl, request));
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/') {
      return new Response("thambiii from Cloudflare Worker! D1, R2, Hyperdrive, and Durable Objects are live!", {
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