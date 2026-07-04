#!/usr/bin/env bash
# TokenOS — one-command install
set -e

API_URL="${TOKENOS_API:?Set TOKENOS_API — e.g. curl ... | TOKENOS_API=https://your-site.vercel.app bash}"
REPO="${TOKENOS_REPO:-https://github.com/gulnozausmon/Tokens_AI.git}"
INSTALL_DIR="${TOKENOS_DIR:-$HOME/.tokenos}"

echo "→ Installing TokenOS..."
echo "  API: $API_URL"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "→ Updating existing install..."
  git -C "$INSTALL_DIR" pull --quiet
else
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR/extension"
npm install --silent
npm run compile --silent

mkdir -p "$INSTALL_DIR/.vscode"
cat > "$INSTALL_DIR/.vscode/settings.json" << EOF
{
  "tokenos.apiUrl": "$API_URL"
}
EOF

echo ""
echo "✓ TokenOS installed."
echo ""
echo "  1. Open $INSTALL_DIR/extension in VS Code or Cursor"
echo "  2. Press F5"
echo "  3. Run: TokenOS: AI Optimize Task"
echo ""
