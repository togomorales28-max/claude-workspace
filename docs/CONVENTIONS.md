# Convenciones de desarrollo

Guía breve para mantener todos los proyectos consistentes.

## Organización del repositorio

| Carpeta      | Uso                                                   |
|--------------|-------------------------------------------------------|
| `projects/`  | Un subdirectorio por proyecto web real                |
| `templates/` | Plantillas reutilizables para empezar proyectos nuevos |
| `docs/`      | Documentación y guías del entorno                     |

## Nombres

- Carpetas y archivos: `kebab-case` (`mi-proyecto`, `menu-movil.js`).
- Clases CSS: `kebab-case` descriptivo (`.site-header`, `.card-title`).
- JavaScript: `camelCase` para variables y funciones, `PascalCase` para clases, `UPPER_SNAKE_CASE` para constantes globales.

## HTML

- Usar etiquetas semánticas (`header`, `main`, `nav`, `section`, `footer`).
- Atributo `lang` en `<html>` y `alt` en todas las imágenes.
- Un solo `<h1>` por página.

## CSS

- Definir colores, espaciados y tipografía como variables en `:root`.
- Diseño *mobile-first*: estilos base para móvil y `@media (min-width: ...)` para pantallas mayores.
- Evitar `!important` y selectores por ID.

## JavaScript

- Usar `const` por defecto y `let` solo cuando haga falta reasignar.
- Módulos ES (`import`/`export`) para dividir el código.
- No dejar `console.log` de depuración en el código final.

## Git

- Mensajes de commit en imperativo y concisos: `Añade formulario de contacto`.
- Un commit por cambio lógico.
- Ramas: `feature/...`, `fix/...`, `docs/...`.
