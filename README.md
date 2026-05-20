# Mapa de Empresas y Riesgos Ambientales (Preliminar)

## Qué es
Sitio estático (HTML/CSS/JS) con Leaflet que carga `data/empresas.json` y dibuja marcadores si existen coordenadas.

## Cómo usar
1. Sube este repo a GitHub.
2. En Netlify: New site from Git -> elige el repo -> Deploy.
3. Para añadir puntos:
   - Edita `data/empresas.json` y agrega `location.lat` y `location.lng`.
   - Opcional: agrega teléfonos/website en `contacts`.

## Próximo paso recomendado (para ranking real multi-ciudad)
- Extraer RETC (SEMARNAT) por Estado/Municipio y normalizar por planta.
- Cruzar con: PROFEPA (sanciones), PAOT (ruido CDMX), SEDEMA (registros/descargas), IMEPLAN (inventarios AMG).
