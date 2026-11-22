#!/bin/bash
# Enciende Jarvis en Linux (abre su propia ventana).
cd "$(dirname "$0")" && exec node server.js --open
