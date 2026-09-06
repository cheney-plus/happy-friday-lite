#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.env.local"
DATA_DIR="$SCRIPT_DIR/data"

# 允许从任意工作目录（包括编辑器的 Run Code）执行此脚本。
cd "$SCRIPT_DIR"

usage() {
  cat <<'EOF'
Usage:
  ./start.sh          Start the enterprise API server.
  ./start.sh --init   Create the first organization owner, then start the server.

The first execution creates .env.local with persistent local keys and data/enterprise.db.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" != "" && "${1:-}" != "--init" ]]; then
  usage >&2
  exit 1
fi

mkdir -p "$DATA_DIR"

if [[ ! -f "$CONFIG_FILE" ]]; then
  umask 077
  jwt_secret="$(openssl rand -base64 32)"
  master_key="$(openssl rand -base64 32)"
  cat > "$CONFIG_FILE" <<EOF
SERVER_ADDR=:8080
DATABASE_PATH=$DATA_DIR/enterprise.db
JWT_SECRET=$jwt_secret
MASTER_KEY=$master_key
EOF
  echo "Created local server configuration: $CONFIG_FILE"
fi

set -a
# shellcheck disable=SC1090
source "$CONFIG_FILE"
set +a

if [[ "${1:-}" == "--init" ]]; then
  organization="happy-friday"
  email="admin@example.com"
  display_name="admin"
  password="admin@example.com"

  read -r -p "企业名称 [$organization]: " input || true
  organization="${input:-$organization}"
  read -r -p "管理员邮箱 [$email]: " input || true
  email="${input:-$email}"
  read -r -p "管理员姓名 [$display_name]: " input || true
  display_name="${input:-$display_name}"
  read -r -s -p "管理员密码（至少 12 位）[$password]: " input || true
  password="${input:-$password}"
  printf '\n'

  if [[ -z "$organization" || -z "$email" || -z "$display_name" || -z "$password" ]]; then
    echo "企业名称、邮箱、姓名和密码均不能为空。" >&2
    exit 1
  fi

  go run ./cmd/bootstrap \
    -organization "admin@example.com" \
    -email "admin@example.com" \
    -name "chenjie" \
    -password "admin@example.com"
fi

echo "Starting Happy Friday Enterprise API at http://127.0.0.1${SERVER_ADDR}"
exec go run .
