# Herramientas, API keys y costes

Precios y límites tomados de la documentación de cada repositorio (noviembre de 2026).
Confírmalos en la web del proveedor antes de pagar nada.

| Skill | Necesita | Coste | Límite |
|---|---|---|---|
| local-client-prospector | Nada (WebSearch / WebFetch de Claude Code) | Gratis (tu plan de Claude) | Pensada para 10-30 leads; no hace scraping masivo |
| b2b-lead-finder | Nada. Opcional: CLI `firecrawl`, skills de Apify | Gratis | Más lenta: verifica cada lead |
| local-lead-finder (AIPM) | `APIFY_API_TOKEN` | ~0.0064 USD por negocio. Cuenta gratis: ~5 USD/mes de crédito (600-800 negocios) | Máx. ~4 USD por ejecución recomendado |
| google-maps-lead-generation | Una key de LLM: `GEMINI_API_KEY` (nivel gratis), `OPENAI_API_KEY` o `ANTHROPIC_API_KEY` (pago por uso), u Ollama local (gratis) | Gratis con Gemini/Ollama; con OpenAI/Anthropic, céntimos por página | Google Maps puede bloquear el scraping directo |
| seo-local, seo-audit, seo-page, seo-technical (AIPM) | Nada para el análisis básico | Gratis | Algunos scripts y referencias no vienen en el repo |
| seo-maps (AIPM) | Gratis: Overpass/Nominatim; Geoapify (key gratis); DataForSEO (pago) | Nivel 0 gratis | Referencias no incluidas en el repo |

Opcionales de AIPM para el envío (no configurados, no necesarios para prospectar):
`RESEND_API_KEY` (correo, nivel gratis, requiere dominio propio ~10-12 USD/año),
Google Sheet / CRM (`SHEETS_WEBHOOK_URL`, `CRM_URL`), Make.com (API solo en plan de pago).

## Dónde poner las keys

- Apify: `~/.claude/skills/local-lead-finder/.env` (línea `APIFY_API_TOKEN=`).
- LLM para ScrapeGraphAI: un `.env` en la carpeta del trabajo, o variable de entorno.
- En Claude Code en la nube, lo más seguro es guardarlas como secretos del entorno, no en
  archivos del repositorio. Nunca hagas commit de un `.env`.
