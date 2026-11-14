#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy somente do frontend/Worker principal; nao aplica migracoes nem publica Edge Functions.
cd "$(dirname "$0")/.."

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "ERRO: execute na branch main." >&2
  exit 1
fi

git fetch origin main
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "ERRO: sua main local nao esta sincronizada. Rode git pull --ff-only origin main." >&2
  exit 1
fi

if [[ "$(node -p 'process.versions.node.split(".")[0]')" != "24" ]]; then
  echo "ERRO: use Node 24 (nvm install 24 && nvm use 24)." >&2
  exit 1
fi

export NEXT_PUBLIC_SUPABASE_URL="https://jzchlrvxdaffnrgbvabv.supabase.co"
if [[ -z "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  echo "Informe apenas a chave PUBLICAVEL do projeto Supabase (sb_publishable_... ou anon)."
  read -r -s -p "Chave publicavel: " NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  echo
  export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
fi

node - <<'NODE'
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
let ok = key.startsWith("sb_publishable_");
if (!ok && key.startsWith("eyJ")) {
  try { ok = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon"; }
  catch { ok = false; }
}
if (!ok) { console.error("ERRO: use somente chave publica Supabase, nunca service_role ou secret."); process.exit(1); }
NODE

echo "== Validando frontend =="
npm ci
npm run typecheck
npm run lint
npm test
npm run build:pages

test -f out/entrar.html || test -f out/entrar/index.html || {
  echo "ERRO: pagina de entrada nao foi exportada." >&2
  exit 1
}

echo "== Verificando conta Cloudflare =="
npx wrangler whoami

echo
echo "Destino: Worker de PRODUCAO meu-vendedor (sem preview)."
echo "Este deploy atualizara os arquivos estaticos e o Worker, preservando secrets remotos (keep_vars)."
read -r -p "Digite PUBLICAR para continuar: " confirm
if [[ "$confirm" != "PUBLICAR" ]]; then
  echo "Publicacao cancelada."
  exit 1
fi

npx wrangler deploy --name meu-vendedor

url="https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/entrar"
echo "== Validando pagina publicada =="
status="$(curl -L -sS -o /dev/null -w '%{http_code}' "$url")"
if [[ "$status" != "200" ]]; then
  echo "ATENCAO: deploy executado, mas a pagina retornou HTTP $status. Verifique a Cloudflare." >&2
  exit 1
fi
echo "Deploy concluido. Pagina retornou HTTP 200: $url#google"
