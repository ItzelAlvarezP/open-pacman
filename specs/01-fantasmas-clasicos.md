# SPEC 01 — Fantasmas con personalidades clásicas

> **Estado:** Aprobado
> **Depende de:** ninguna (primera spec)
> **Fecha:** 2026-11-09
> **Objetivo:** Tener 4 fantasmas arcade —uno de ellos agresivo— cada uno con su propia IA y salida escalonada de la pen.

## Scope

**In:**

- 4 fantasmas con personalidades clásicas arcade: `blinky` (agresivo), `pinky` (emboscador), `inky` (flanqueador), `clyde` (tímido).
- Salida de la pen escalonada: 0 / 2 / 5 / 8 s (0 / 120 / 300 / 480 frames a 60 fps).
- Regla de puerta: una vez un fantasma ha salido, la puerta de la pen le es muro y no puede reentrar.
- Blinky más rápido que el resto: 0.11 celdas/frame de base, 0.125 cuando quedan ≤30 dots («Cruise Elroy» simplificado).

**Out of scope (para futuras specs):**

- Píldoras de poder y modo frightened (requieren tiles nuevos y su propia máquina de estados).
- Modo scatter global temporizado.
- Sprites/animaciones nuevas, puntos por comer fantasmas, dificultad por nivel.

## Data model

```js
// maze.js — única fuente de verdad de posiciones y personalidades
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'blinky', releaseDelay: 0 },
  { x: 14, y: 14, kind: 'pinky', releaseDelay: 120 },
  { x: 11, y: 14, kind: 'inky', releaseDelay: 300 },
  { x: 16, y: 14, kind: 'clyde', releaseDelay: 480 },
];

// game.js — objeto fantasma; añadidos: released y exited
{ x, y, dir: 'up', speed: GHOST_SPEED, kind, released: false, exited: false }

// render.js — color entra por kind, no por índice
const GHOST_COLORS = { blinky: '#ff0000', pinky: '#ffb8ff', inky: '#00ffff', clyde: '#ffb852' };
```

Convenciones: coordenadas en celdas; velocidades en celdas/frame; `pinky`, `inky` y `clyde` corren a 0.10 como hoy y `blinky` usa la excepción arriba; alcance de objetivos por **distancia euclídea** con desempate de dirección `up > left > down > right`.

## Implementation plan

1. `maze.js`: sustituir `GHOST_STARTS` por las 4 entradas con `kind` y `releaseDelay`. `render.js`: mapa `GHOST_COLORS` por `kind`. Prueba manual: se ven 4 fantasmas en la pen con sus colores correctos.
2. `game.js`: salida de la pen — `createGame`/`resetPositions` inicializan `released`/`exited`; cada update decrementa los frames pendientes de `releaseDelay`; el fantasma liberado marcha a la columna de puerta más cercana y sube; al llegar a la fila 11 marca `exited = true`, y desde entonces `isWall` le bloquea la puerta (`v === 3`). Prueba manual: salidas escalonadas y nadie reentra.
3. `game.js`: `decideGhost` por personalidad con helper `pickDir(g, target)`: entre direcciones válidas sin reversa de 180° (salvo callejón), elige la de menor distancia euclídea al objetivo. Objetivos: `blinky` → celda de Pac-Man; `pinky` → 4 celdas delante según `pacman.dir`; `inky` → punto 2 celdas delante de Pac-Man reflejado/duplicado respecto a Blinky; `clyde` → su esquina (1, 29) si distancia a Pac-Man ≤8 celdas, si no celda de Pac-Man. Prueba manual: cada fantasma se comporta distinto.
4. `game.js`: velocidad de Blinky recalculada en cada frame desde `game.dotsRemaining` (0.11, o 0.125 con ≤30 dots). Prueba manual: aceleración visible en el tramo final del nivel.
5. `game.js`: al perder una vida, todo vuelve a su estado inicial de pen (`released`/`exited` false, delays intactos) y se repite el escalonado. Prueba manual: tras cada muerte vuelve el desfase de salidas.

## Acceptance criteria

- [ ] Al iniciar hay 4 fantasmas visibles en colores rojo, cian, rosa y naranja.
- [ ] Blinky sale inmediatamente; pinky a ~2 s, inky a ~5 s, clyde a ~8 s.
- [ ] Blinky toma en cada cruce la dirección que reduce la distancia euclídea a Pac-Man y se le ve ir directo a él.
- [ ] Blinky va a 0.11 celdas/frame y pasa a 0.125 cuando quedan ≤30 dots.
- [ ] Pinky apunta 4 celdas delante de Pac-Man y se anticipa a sus giros (emboscada).
- [ ] Inky apunta al vector duplicado desde Blinky hacia el punto 2 celdas delante de Pac-Man.
- [ ] Clyde persigue con >8 celdas de distancia y se retira a su esquina con ≤8.
- [ ] Ningún fantasma hace reversa de 180° salvo en callejón sin salida.
- [ ] Ningún fantasma vuelve a entrar por la puerta una vez salió.
- [ ] Tras perder vida, los 4 vuelven a la pen y repiten la salida escalonada.
- [ ] La consola no muestra errores de JavaScript.

## Decisions

- **Sí:** personalidades clásicas — máximo contraste de comportamientos, literalmente lo pedido.
- **No:** modo scatter global — Clyde ya crea descansos al huir a su esquina; otra spec si se quiere fidelidad total.
- **No:** píldoras de poder / frightened — features propias, spec propia.
- **Sí:** lógica en `game.js` sin archivo nuevo — es poco código y evita tocar `index.html`.
- **Sí:** distancia euclídea con desempate `up > left > down > right` — como el arcade original.
- **Sí:** retrasos fijos en frames (0/120/300/480) — rAF corre a ~60 fps; nada de relojes externos.
- **No:** el «bug del up» de Pinky — objetivo siempre calculado con la dirección actual.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Fantasma atrapado por target fuera del laberinto (pinky/inky apuntan fuera) | El target solo guía la elección de dirección; `canMove` y `isWall` restringen siempre a celdas reales. |
| Embotellamiento en la puerta si salen a la vez | Los retrasos escalonados lo minimizan; sin colisión entre fantasmas, como en el arcade. |
| rAF variable hace irregular el escalonado | Delays medidos en frames de juego; variación invisible a escala de segundos. |

## Qué está **no** en esta spec

- Píldoras de poder, frightened y puntos por comer fantasmas.
- Scatter global temporizado.
- Sprites, animaciones, sonido, niveles de dificultad.

Cada una de esas, si aterriza, va en su propia spec.
