# MercadoLibre Opportunity Finder

Encuentra productos equivalentes a menor precio en MercadoLibre Venezuela.

## Que hace

1. Pegas la URL de un producto en MercadoLibre.
2. La app resuelve el producto y extrae sus atributos.
3. Genera queries de busqueda deterministas.
4. Busca candidatos en MercadoLibre.
5. Rankea candidatos con pre-score (sin IA).
6. Gemini evalua los top candidatos (mismo producto?).
7. Calcula rentabilidad (margin, ROI).
8. Clasifica oportunidades (HIGH/MEDIUM/REVIEW/REJECT).
9. Muestra resultados en la UI.

## Stack

- Next.js 15 + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL)
- Gemini API (IA)
- MercadoLibre API

## Setup

```bash
# Instalar dependencias
npm install

# Copiar .env.example a .env.local
cp .env.example .env.local

# Configurar variables de entorno (ver abajo)
# ...

# Ejecutar migrations de Supabase
# Copiar supabase/migrations/001_initial_schema.sql en el dashboard de Supabase

# Iniciar desarrollo
npm run dev
```

## Variables de entorno

```bash
# MercadoLibre
MELI_CLIENT_ID=tu_client_id
MELI_CLIENT_SECRET=tu_client_secret
ML_SITE_ID=MLV

# Gemini
GEMINI_API_KEY=tu_api_key
GEMINI_MODEL=gemini-2.0-flash

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

## Scripts

```bash
npm run dev          # Desarrollo
npm run build        # Build de produccion
npm run start        # Iniciar produccion
npm run lint         # Linting
npm run typecheck    # Verificar tipos
npm run test         # Ejecutar tests
```

## Arquitectura

```
src/
  app/
    api/
      item/          # GET /api/item?url=... (resolve producto)
      opportunity/   # POST /api/opportunity (pipeline completo)
      history/       # GET /api/history (analisis anteriores)
    page.tsx         # Home con URL form
    history/         # Pagina de historial
    settings/        # Configuracion de fees
  components/        # UI components
  lib/
    ai/              # Gemini provider + schemas
    analysis/        # Pipeline: normalize, search, matching, economics
    db/              # Supabase client + repositories
    ml/              # MercadoLibre client, search, resolve
    utils/           # Cache, retry, security
```

## API

### POST /api/opportunity

```json
{
  "url": "https://articulo.mercadolibre.com.ve/MLV-123456"
}
```

Response:
```json
{
  "ok": true,
  "sourceId": "MLV123456",
  "sourcePrice": 500,
  "channel": "fixture",
  "queries": ["iPhone 14 128GB"],
  "stats": {
    "totalFetched": 20,
    "uniqueCandidates": 15,
    "sentToAI": 10
  },
  "alternatives": [
    {
      "itemId": "MLV789",
      "title": "iPhone 14 128GB Nuevo",
      "price": 420,
      "currency": "USD",
      "savings": 80,
      "savingsPct": 0.16
    }
  ]
}
```

### GET /api/history

Lista analisis anteriores.

### GET /api/history?id=xxx

Detalle de un analisis con sus oportunidades.
