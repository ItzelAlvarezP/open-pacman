# SPEC 02 — Salida fiable de los fantasmas de la pen

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-10
> **Objetivo:** Que los 4 fantasmas acaben en el laberinto: Blinky nace en el mapa sobre la puerta y pinky, inky y clyde salen escalonados sin quedar nunca congelados en la pen.

## Por qué existe esta spec

SPEC 01 definió la salida escalonada, pero en juego real pinky, inky y clyde acaban congelados para siempre en la pen: cada muerte repone los delays completos (0/120/300/480 frames) y con muertes frecuentes inky y clyde jamás acumulan los 5 y 8 s de su cuenta atrás. Diagnóstico confirmado ejecutando el engine real (`maze.js` + `game.js`) en Node: a los 690 frames, inky y clyde seguían con `released: false`. La mecánica de salida `exitPen` en sí funciona; el fallo es el reinicio del escalonado.

## Scope

**In:**

- Blinky empieza en el mapa, en la celda (13, 11), sobre la puerta: `released: true` y `exited: true` desde `createGame`.
- `resetPositions` siembra el escalonado corto (0/60/120/180 frames) tras perder vida y devuelve a Blinky a su celda del mapa activo.
- Constante nueva `RESET_RELEASE_DELAYS` en `maze.js`.
- Los delays de primera salida de SPEC 01 (0/120/300/480) se mantienen intactos.

**Out of scope (para futuras specs):**

- Gatillo de salida por dots comidos (propuesta valorada y descartada, ver Decisions).
- Espaciado o colisión entre fantasmas cuando comparten columna de puerta.
- Píldoras de poder, frightened, scatter global (siguen fuera desde SPEC 01).

## Data model

```js
// maze.js — blinky nace en el mapa, sobre la puerta; delays de 1.ª salida intactos
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky', releaseDelay: 0 },
  { x: 14, y: 14, kind: 'pinky', releaseDelay: 120 },
  { x: 11, y: 14, kind: 'inky', releaseDelay: 300 },
  { x: 16, y: 14, kind: 'clyde', releaseDelay: 480 },
];

// maze.js — delays al reaparecer tras perder vida (mismo orden que GHOST_STARTS)
const RESET_RELEASE_DELAYS = [0, 60, 120, 180];
```

Ninguna estructura nueva en `game.js`: se ajustan los valores iniciales de `released`, `exited` y `releaseDelay` que ya existen. `exitPen`, `isWall`, `decideGhost` y demás no cambian. Convenciones: delays en frames a 60 fps; coordenadas en celdas.

## Implementation plan

1. `maze.js`: mover a blinky a (13, 11) en `GHOST_STARTS` y añadir `RESET_RELEASE_DELAYS` exportado a `window`. Prueba manual: blinky pintado en el corredor de la fila 11 (aún quieto tras Start) y pinky/inky/clyde en la pen.
2. `game.js`: `createGame` marca a blinky `released: true, exited: true` en construcción. Prueba manual: blinky persigue desde el primer frame y pinky sale a los ~2 s.
3. `game.js`: `resetPositions` coloca a blinky en (13, 11) activo y usa `RESET_RELEASE_DELAYS[i]` para pinky/inky/clyde. Prueba manual: perder una vida y ver la salida en ~1/2/3 s.

## Acceptance criteria

- [ ] Al pulsar Start, Blinky está en el corredor de la fila 11 (fuera de la pen) y persigue a Pac-Man desde el primer frame.
- [ ] Primera partida: pinky sale por la puerta ~2 s, inky ~5 s y clyde ~8 s (±1 s).
- [ ] Ningún fantasma pasa más que su delay dentro de la pen sin haber empezado a salir.
- [ ] Tras perder una vida, pinky, inky y clyde salen en ~1, ~2 y ~3 s respectivamente (±0.5 s).
- [ ] Tras perder una vida, Blinky reaparece fuera de la pen ya activo.
- [ ] Ningún fantasma reentra por la puerta una vez salió (regresión de SPEC 01).
- [ ] Personalidades y velocidades de SPEC 01 intactas.
- [ ] La consola no muestra errores de JavaScript.

Todas las pruebas son manuales en navegador (`python3 -m http.server -d src`); el repo no tiene toolchain.

## Decisions

- **Sí:** timers de SPEC 01 (0/2/5/8 s) para la primera salida. Decisión cerrada del usuario; el gatillo por dots se descarta.
- **Sí:** escalonado corto (0/60/120/180 frames) tras perder vida. El reset completo de SPEC 01 es la causa raíz del atasco; sustituye el paso 5 del plan de SPEC 01.
- **Sí:** Blinky nace en (13, 11), fiel al arcade. La puerta queda libre y él está «en el mapa» desde el inicio.
- **Sí:** conservar el dot de la celda (13, 11) bajo Blinky. Sin caso especial en `createGame`; los fantasmas no lo comen.
- **No:** Blinky entre celdas (13.5, 11) como en el arcade. El engine solo decide dirección en posiciones alineadas; (13, 11) es la celda válida más cercana.
- **No:** gatillo de salida por dots comidos (blinky/pinky inmediatos, inky 30 dots, clyde 60). Propuesta del diagnóstico, descartada por el usuario a favor de los timers.
- **No:** reset completo del escalonado tras cada muerte (plan de SPEC 01). Deja a inky y clyde sin moverse nunca si el jugador muere rápido.
- **No:** script Node de simulación permanente en el repo. Sirvió de diagnóstico; la verificación de la spec es manual y el repo no lleva tests.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Pinky y clyde comparten la columna de puerta 14 y pueden cruzarse dentro de la pen | No hay colisión entre fantasmas (como en el arcade); el escalonado corto reduce el solape visual. |
| rAF variable a 60 fps desplaza los delays | Idem SPEC 01: delays en frames de juego; variación invisible a escala de segundos. |
| Reordenar `GHOST_STARTS` rompería a inky, que lee `game.ghosts[0]` como blinky | No se reordena el array; blinky sigue primero. |

## Qué está **no** en esta spec

- Gatillo de salida por dots comidos.
- Colisión o espaciado entre fantasmas en la puerta.
- Píldoras de poder, frightened, puntos por comer fantasmas, scatter global, sprites, sonido, dificultad por nivel.

Cada una de esas, si aterriza, va en su propia spec.
