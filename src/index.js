export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Data insert panra request (POST)
    if (request.method === "POST" && url.pathname === "/add") {
      try {
        const body = await request.json();
        
        await env.DB.prepare(
          "INSERT INTO items (title, description) VALUES (?, ?)"
        ).bind(body.title, body.description).run();

        return new Response(JSON.stringify({ success: true, message: "Data stored successfully!" }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 2. Data fetch panra request (GET)
    if (request.method === "GET" && url.pathname === "/items") {
      const { results } = await env.DB.prepare("SELECT * FROM items").all();
      return Response.json(results);
    }

    return new Response("Welcome to Cloudflare D1 Worker App!");
  },
};