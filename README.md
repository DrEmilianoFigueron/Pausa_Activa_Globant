# Pausa Activa — Globant Uruguay

Pantalla dinámica de pausas activas para Salud Ocupacional. Guía a los colaboradores a través de un circuito de estiramientos (cuello, espalda, brazos y piernas, con respiración consciente) y un modo de descanso visual basado en la regla 20/20/20.

Desarrollada para Globant Uruguay como parte del servicio de asesoría en Salud Ocupacional.

**App en línea:** https://dremilianofigueron.github.io/Pausa_Activa_Globant/

## Funcionalidades

- **Pausas activas**: circuito guiado de 10 ejercicios con temporizador, indicaciones por fase y lado (derecho/izquierdo), e imágenes de referencia.
- **Fatiga visual**: ejercicio 20/20/20 con temporizador de 20 segundos de alto contraste y recomendaciones de salud visual.
- **Cierre del circuito**: recomendación final de hidratación y movimiento.
- **Aviso sonoro**: un gong marca el fin de cada ejercicio, del circuito completo y de la fatiga visual.

La app entra directo al circuito: no solicita registro previo.

## Identidad visual

Paleta tomada de la marca Globant:

| Rol | Color |
|---|---|
| Marca / texto | `#111111` negro |
| Acento | `#BFD732` verde lima (flecha del logo) |
| Header | blanco |
| Footer | `#111111` negro |
| Fondo | blanco |
| Texto secundario | `#5C5C5C` gris |

En el timer, el anillo va en verde lima durante la fase de sostener la postura y en negro durante la transición entre posturas. El logo del header lleva el wordmark en negro sobre fondo blanco; en el footer negro se usa la versión clara.

Tipografía: títulos en grotesque tech (Space Grotesk) y texto en sans neutra (Inter).

## Desarrollo local

**Requisitos:** Node.js

```bash
npm install
npm run dev
```

## Publicación

Cada push a `main` se publica automáticamente en GitHub Pages mediante GitHub Actions (`.github/workflows/deploy.yml`).

> **Pendiente:** crear la propiedad GA4 de Globant Uruguay y activarla en `index.html` (el bloque está comentado, a la espera del Measurement ID).

## Licencia

© 2026 Dr. Emiliano Figuerón

Este trabajo está licenciado bajo [Creative Commons Atribución-NoComercial-SinDerivadas 4.0 Internacional (CC BY-NC-ND 4.0)](https://creativecommons.org/licenses/by-nc-nd/4.0/).

Podés compartir y redistribuir este material siempre que se atribuya al autor original, no se use con fines comerciales y no se realicen modificaciones.
