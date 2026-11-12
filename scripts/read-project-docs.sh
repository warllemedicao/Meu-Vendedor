#!/usr/bin/env bash

set -uo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$script_dir/.." rev-parse --show-toplevel)" || {
  printf 'Erro: nao foi possivel localizar a raiz do repositorio Git.\n' >&2
  exit 1
}

cd "$repo_root" || exit 1

markdown_files=()
while IFS= read -r -d '' path; do
  if [[ "${path,,}" == *.md ]]; then
    markdown_files+=("$path")
  fi
done < <(git ls-files -z)

printf 'Documentos Markdown versionados encontrados: %d\n' "${#markdown_files[@]}"
for path in "${markdown_files[@]}"; do
  printf '  - %q\n' "$path"
done

read_count=0
failure_count=0
for path in "${markdown_files[@]}"; do
  if [[ -L "$path" || ! -f "$path" ]]; then
    printf 'Nao foi possivel ler (arquivo ausente ou link simbolico): %q\n' "$path" >&2
    ((failure_count += 1))
    continue
  fi

  if cat -- "$path" > /dev/null; then
    ((read_count += 1))
  else
    printf 'Erro ao ler: %q\n' "$path" >&2
    ((failure_count += 1))
  fi
done

printf 'Conteudos lidos sem exibicao: %d/%d\n' "$read_count" "${#markdown_files[@]}"
printf 'Este relatorio nao carrega os documentos para o contexto do Copilot.\n'

if (( failure_count > 0 )); then
  printf 'Falhas de leitura: %d\n' "$failure_count" >&2
  exit 1
fi
