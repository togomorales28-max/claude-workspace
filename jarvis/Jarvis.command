#!/bin/bash
# Doble clic para encender Jarvis en Mac (abre su propia ventana).
cd "$(dirname "$0")" && exec node server.js --open
