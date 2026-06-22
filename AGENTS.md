# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Tunnel (ngrok)

`expo start --tunnel` NO funciona porque @expo/ngrok v4.1.3 usa ngrok v2.3.41
pero el authtoken disponible es de ngrok v3.

Solución: `npm run tunnel` — inicia Metro + ngrok v3 por separado.
  - npm run tunnel        — inicia el túnel
  - npm run tunnel:stop   — detiene todo

El script está en scripts/tunnel.sh.
