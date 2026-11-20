# Plantilla: web-basic

Punto de partida para sitios web estáticos con HTML, CSS y JavaScript, sin dependencias.

## Estructura

```
web-basic/
├── index.html        # Página principal
├── css/
│   ├── reset.css     # Normaliza estilos entre navegadores
│   └── styles.css    # Variables de diseño y estilos del proyecto
├── js/
│   └── main.js       # Lógica de la página (módulo ES)
└── assets/
    ├── img/          # Imágenes
    └── fonts/        # Fuentes locales
```

## Cómo verlo en el navegador

Como `main.js` es un módulo ES, ábrelo con un servidor local en vez de con doble clic. Por ejemplo, desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

Y visita http://localhost:8000
