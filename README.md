# railway-env-demo

App Node (sem dependências) + front estilo moodboard, pra testar variáveis de ambiente e secrets no Railway.

## Variáveis

| Nome           | Tipo     | Uso                                                       |
|----------------|----------|-----------------------------------------------------------|
| `APP_NAME`     | comum    | Nome exibido no header/título                             |
| `APP_ENV`      | comum    | Ex: `production`, `staging`                               |
| `ACCENT_COLOR` | comum    | Cor de destaque (`#ff4d00`)                               |
| `API_SECRET`   | **secret** | Protege `/api/protected`. Nunca é enviado ao navegador  |
| `PORT`         | Railway  | Injetada automaticamente pelo Railway                     |

A página mostra o secret só como **configurado / tamanho / fingerprint SHA-256 (8 chars)**.
Pra conferir que o valor injetado é o certo:

```bash
printf '%s' "seu-secret" | sha256sum | cut -c1-8
```

## Rodar local

```bash
cp .env.example .env
npm run dev                       # http://localhost:3000

# ou com Docker
docker build -t railway-env-demo .
docker run -p 3000:3000 --env-file .env railway-env-demo
```

## Deploy no Railway

1. Suba esta pasta pra um repo no GitHub → **New Project → Deploy from GitHub repo**
   (ou `railway up` com a CLI). O Railway detecta o `Dockerfile` sozinho.
2. Em **Variables** do serviço, adicione `APP_NAME`, `APP_ENV`, `ACCENT_COLOR`.
3. Adicione `API_SECRET` e clique no ícone de cadeado pra marcá-la como **sealed**
   (o valor fica oculto na UI e na CLI, mas continua disponível pro app em runtime).
4. **Settings → Networking → Generate Domain**.
5. Teste:
   ```bash
   curl https://SEU-DOMINIO/api/config
   curl -H "Authorization: Bearer SEU_SECRET" https://SEU-DOMINIO/api/protected
   ```

## Escala horizontal (replicas + load balancer)

No Railway, escalar horizontalmente **não é criar outro service**: dois services ficam com domínios
separados e nada balanceia entre eles. O certo é aumentar as **replicas** do mesmo service:

1. Service → **Settings → Deploy → Replicas** (ou na seção *Scale*): coloque `2`.
2. Redeploy. O Railway sobe 2 containers atrás do mesmo domínio e distribui as requests.
3. Cada réplica recebe `RAILWAY_REPLICA_ID` (e `RAILWAY_REPLICA_REGION`), lidos pelo app.

Na página:
- O **dock translúcido** embaixo mostra qual réplica respondeu. Ative **Auto** pra consultar a cada 1,5s.
- O card **Load balancer** dispara 50 requests e mostra a distribuição por réplica.
- Toda resposta traz o header `x-replica-id`.

```bash
for i in $(seq 10); do curl -s https://SEU-DOMINIO/api/whoami | jq -r .short; done
```

O contador de `hits` vive em memória, então **cada réplica tem o seu**. É exatamente o problema que
aparece quando um site escala: sessão, cache, rate limit e uploads precisam ir pra fora do processo
(Redis, Postgres, bucket), senão o usuário vê dados diferentes dependendo de qual réplica caiu.

### Treinar localmente

```bash
npm run dev:lb               # LB em :3000 → réplicas alpha (:3001) e bravo (:3002), round-robin
REPLICAS=3 npm run dev:lb    # 3 réplicas
```

Endpoints: `/` (front), `/api/config`, `/api/whoami`, `/api/protected`, `/health`.
