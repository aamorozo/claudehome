#!/bin/bash
# ClaudeHome Setup — Mac
# Run from: ~/ClaudeHome/_setup/
# Usage: bash setup-mac.sh

CLAUDE_DIR="$HOME/.claude"
SETUP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Setting up Claude Code config on Mac..."

# 1. Copy skills
echo "Copying skills..."
mkdir -p "$CLAUDE_DIR/skills"
cp "$SETUP_DIR/skills/"* "$CLAUDE_DIR/skills/"
echo "  Done. Skills in $CLAUDE_DIR/skills/"

# 2. Copy settings.json (plugins list)
echo "Copying settings.json..."
cp "$SETUP_DIR/settings.json" "$CLAUDE_DIR/settings.json"
echo "  Done."

# 3. Set up mcp.json with token
read -p "Enter your REPLICATE_API_TOKEN (leave blank to skip MCP setup): " token
if [ -n "$token" ]; then
    sed "s|CLAUDE_DIR|$CLAUDE_DIR|g" "$SETUP_DIR/mcp-template.json" > "$CLAUDE_DIR/mcp.json"
    # Replace placeholder with actual token
    sed -i '' "s|\${REPLICATE_API_TOKEN}|$token|g" "$CLAUDE_DIR/mcp.json"
    echo "REPLICATE_API_TOKEN=$token" > "$HOME/.env.claude"
    echo "  MCP configured. Token saved to $HOME/.env.claude"
else
    echo "  Skipped MCP setup."
fi

echo ""
echo "Setup complete. Open Claude Code and set working directory to:"
echo "  $HOME/ClaudeHome"
