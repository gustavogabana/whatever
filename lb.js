// Load balancer local pra treinar escala horizontal sem deploy.
// Sobe N instâncias do server.js (cada uma com seu REPLICA_ID) e distribui
// as requests em round-robin, parecido com o que o edge do Railway faz com as replicas.
//
//   npm run dev:lb            → 2 réplicas, LB em :3000
//   REPLICAS=3 npm run dev:lb → 3 réplicas
import http from "node:http";
import { spawn } from "node:child_process";
import { join } from "node:path";

try { process.loadEnvFile(); } catch {} // carrega .env se existir; as réplicas herdam

const PORT = Number(process.env.PORT) || 3000;
const N = Number(process.env.REPLICAS) || 2;
const names = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"];

const upstreams = Array.from({ length: N }, (_, i) => {
  const port = PORT + 1 + i;
  const id = `${names[i] ?? "replica" + i}-${port}`;
  const child = spawn(process.execPath, [join(import.meta.dirname, "server.js")], {
    env: { ...process.env, PORT: String(port), REPLICA_ID: id },
    stdio: "inherit",
  });
  return { port, id, child };
});

let next = 0;
const server = http.createServer((req, res) => {
  const up = upstreams[next++ % upstreams.length];
  const proxied = http.request(
    { host: "127.0.0.1", port: up.port, path: req.url, method: req.method, headers: req.headers },
    (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); },
  );
  proxied.on("error", () => { res.writeHead(502, { "content-type": "application/json" }); res.end(`{"error":"replica ${up.id} down"}`); });
  req.pipe(proxied);
});

server.listen(PORT, () => console.log(`⇄ LB on :${PORT} → ${upstreams.map((u) => `${u.id}`).join(", ")}`));

const stop = () => { upstreams.forEach((u) => u.child.kill("SIGTERM")); server.close(() => process.exit(0)); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
