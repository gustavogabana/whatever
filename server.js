import http from "node:http";
import { readFile } from "node:fs/promises";
import { createHash, timingSafeEqual } from "node:crypto";
import { join, extname } from "node:path";

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(import.meta.dirname, "public");

// Variáveis comuns: podem ir pro front sem problema
const publicConfig = () => ({
  appName: process.env.APP_NAME || "Moodboard",
  appEnv: process.env.APP_ENV || "unset",
  accentColor: process.env.ACCENT_COLOR || "#ff4d00",
  railway: {
    environment: process.env.RAILWAY_ENVIRONMENT_NAME || null,
    service: process.env.RAILWAY_SERVICE_NAME || null,
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || null,
  },
});

// Secret: fica SÓ no servidor. Pro front vai apenas se existe + fingerprint.
const secret = process.env.API_SECRET || "";
const secretStatus = () => ({
  configured: secret.length > 0,
  length: secret.length,
  // compare localmente: printf '%s' "seu-secret" | sha256sum | cut -c1-8
  fingerprint: secret ? createHash("sha256").update(secret).digest("hex").slice(0, 8) : null,
});

const safeEqual = (a, b) => {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
};

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/health") return json(res, 200, { ok: true });

  if (url.pathname === "/api/config") {
    return json(res, 200, { ...publicConfig(), secret: secretStatus() });
  }

  // Endpoint protegido: exige Authorization: Bearer <API_SECRET>
  if (url.pathname === "/api/protected") {
    if (!secret) return json(res, 503, { error: "API_SECRET não configurado no servidor" });
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token || !safeEqual(token, secret)) return json(res, 401, { error: "unauthorized" });
    return json(res, 200, { message: "Acesso liberado — o secret bateu.", at: new Date().toISOString() });
  }

  // Arquivos estáticos
  const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const path = join(PUBLIC_DIR, file);
  if (!path.startsWith(PUBLIC_DIR)) return json(res, 403, { error: "forbidden" });
  try {
    const data = await readFile(path);
    res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
    res.end(data);
  } catch {
    json(res, 404, { error: "not found" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`▲ ${publicConfig().appName} on :${PORT} (env=${publicConfig().appEnv}, secret=${secret ? "set" : "missing"})`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
