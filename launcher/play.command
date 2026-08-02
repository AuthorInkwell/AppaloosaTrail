#!/bin/bash
# The Appaloosa Trail - launcher for macOS and Linux.
# Double-click on macOS, or run ./play.command from a terminal.

cd "$(dirname "$0")" || exit 1
ROOT="$(pwd)"
PORT=8731

while lsof -i ":$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  if [ "$PORT" -gt 8760 ]; then
    echo "Could not find a free port."
    read -r -p "Press ENTER to close"
    exit 1
  fi
done

URL="http://127.0.0.1:$PORT/"

echo ""
echo "   THE APPALOOSA TRAIL"
echo "   ==================="
echo ""
echo "   The game is running at $URL"
echo ""
echo "   Keep this window open while you play. Press Ctrl+C when you are done."
echo ""

# The music folder sits beside the launcher, so list it and link it into the
# served tree; that is what the Windows launcher does in PowerShell.
if [ -d "$ROOT/music" ]; then
  files=$(ls -1 "$ROOT/music" 2>/dev/null | grep -Ei '\.(mid|midi|ogg|mp3|wav|m4a)$' | sed 's/^/"/; s/$/"/' | paste -sd, -)
  printf '{"files":[%s]}' "$files" > "$ROOT/music/manifest.json"
  [ -e "$ROOT/game/music" ] || ln -s "$ROOT/music" "$ROOT/game/music" 2>/dev/null
fi

if command -v python3 >/dev/null 2>&1; then
  (sleep 1; open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null) &
  cd game && exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v node >/dev/null 2>&1; then
  (sleep 1; open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null) &
  cd game && exec npx --yes serve -l "$PORT" .
else
  echo "   Neither python3 nor node was found."
  echo "   Open game/index.html in a browser instead."
  read -r -p "   Press ENTER to close"
fi
