#!/bin/sh

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "BookSaver necesita Node.js 22 o superior."
  echo "Instalalo y vuelve a abrir este archivo."
  exit 1
fi

echo "Abriendo BookSaver en http://127.0.0.1:5173 ..."
(sleep 2 && open "http://127.0.0.1:5173") >/dev/null 2>&1 &
node src/server.js
