#!/bin/bash
# Tunnel script - starts Metro bundler + ngrok tunnel
# Use: npm run tunnel

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "=== Melodix Tunnel ==="

# Kill existing processes
pkill -9 -f "expo start" 2>/dev/null
pkill -9 -f "ngrok http" 2>/dev/null
sleep 2

# Start Metro bundler
npx expo start --no-dev --minify > /tmp/expo-tunnel.log 2>&1 &
EXPO_PID=$!
echo "Metro PID: $EXPO_PID"

# Wait for Metro to be ready
echo "Waiting for Metro..."
for i in $(seq 1 20); do
  if curl -s -o /dev/null -w "" http://localhost:8081/ 2>/dev/null; then
    echo "Metro ready on http://localhost:8081 (after ${i}s)"
    break
  fi
  sleep 2
done

# Start ngrok tunnel
ngrok http 8081 --log=stdout > /tmp/ngrok-tunnel.log 2>&1 &
NGROK_PID=$!
echo "Ngrok PID: $NGROK_PID"
sleep 6

# Get the ngrok public URL
TUNNEL_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for t in data.get('tunnels', []):
        if t['public_url']:
            print(t['public_url'])
except: pass
" 2>/dev/null)

echo ""
echo "=============================================="
echo "  App:       Melodix"
echo "  Metro:     http://localhost:8081"
echo "  Tunnel:    $TUNNEL_URL"
echo ""
echo "  Escanea con Expo Go o conecta via tunnel URL"
echo "=============================================="
echo ""
echo "Para detener: npm run tunnel:stop"
