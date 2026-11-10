# SPEC 03 — Píldoras de poder y modo frightened

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-10
> **Objetivo:** Añadir las 4 píldoras de poder al laberinto: al comerlas Pac-Man puede comer fantasmas asustados durante 6 s con puntuación en cadena 200/400/800/1600.

## Scope

**In:**

- Tile nuevo `4` (letra `o` en `MAZE_STR`) en las celdas (1,3), (26,3), (1,23) y (26,23), sustituyendo los dots que ya había: el total de comibles del nivel no cambia.
- Comer una píldora: +50 puntos, decrementa `dotsRemaining` (cuenta para ganar el nivel y para el Cruise Elroy) y lanza un modo frightened global de 360 frames (6 s a 60 fps).
- Frightened: los 4 fantasmas se asustan, incluidos los que aún están dentro de la pen; si el timer sigue activo al salir, lo siguen siendo.
- Fantasmas asustados: velocidad 1/20 celda/frame y dirección aleatoria en cada cruce, sin reversa de 180° (salvo callejón), con las mismas opciones de `pickDir`.
- Reversa inmediata de 180° en el frame de comer la píldora para los fantasmas que ya salieron de la pen (`exited`).
- Cuerpo del fantasma asustado azul, con flash azul/blanco los últimos 120 frames.
- Comer un fantasma asustado: 200/400/800/1600 según el orden dentro del mismo fright; el fantasma reaparece en su celda de `GHOST_STARTS` (teleport) y sale por la puerta tras ~1 s reutilizando la lógica de `exitPen` de SPEC 01/02.
- Perder vida cancela el fright: `resetPositions` limpia el timer y el flag.

**Out of scope (para futuras specs):**

- Popup flotante con los puntos al comer fantasma.
- Ojos que vuelven caminando al pen.
- Vida extra a los 10 000 puntos.
- Duración decreciente por nivel, scatter, sprites, sonido, dificultad.

## Data model

```js
// maze.js — nueva letra en MAZE_STR: 'o' = píldora de poder (tile 4).
// Cambian solo 4 celdas: cols 1 y 26 de las filas 3 y 23.
'#o####.#####.##.#####.####o#', // 3
'#o..##................##..o#', // 23

// game.js — nuevas constantes
const PELLET_TILE         = 4;
const PELLET_POINTS       = 50;
const FRIGHT_FRAMES       = 360;  // 6 s a 60 fps
const FRIGHT_BLINK_FRAMES = 120;  // los últimos 2 s parpadea
const FRIGHT_GHOST_SPEED  = 0.05; // 1/20 celda/frame
const EATEN_RELEASE_DELAY = 60;   // ~1 s en la pen tras ser comido
const GHOST_POINTS        = [200, 400, 800, 1600]; // indexado por pelletChain

// game.js — campos nuevos en createGame y por fantasma
{
  ..., frightTimer: 0, pelletChain: 0,
  ghosts: [ { ..., frightened: false } ],
}
```

Convenciones: coordenadas en celdas; velocidades en celdas/frame; el fright corre en frames de juego a 60 fps como los timers de SPEC 01/02. `parseTile('o')` devuelve 4; el tile 4 es transitable (`isWall` no necesita cambios). El orden de `update` pasa a ser: comer píldora → decrementar `frightTimer` (al llegar a 0 limpia flags) → mover fantasmas → colisiones; así expirar el timer y una colisión nunca compiten.

## Implementation plan

1. `maze.js`: `parseTile` devuelve 4 para `o` y cambian las filas 3 y 23. `render.js`: nueva `drawPellets` (círculo de radio ~5 px, parpadeo con `frame`, llamada desde `draw`). Prueba manual: se ven las 4 píldoras parpadeando en (1,3), (26,3), (1,23) y (26,23); el resto del laberinto intacto.
2. `game.js`: `createGame` añade `frightened: false` a cada fantasma y `frightTimer: 0, pelletChain: 0`; `movePacman` come el tile 4 igual que el 2 (+50, `dotsRemaining--`) y llama a `triggerFright`: timer 360, chain 0, flags a true y media vuelta a los `exited`; `update` decrementa el timer una vez por frame y al llegar a 0 limpia flags. Prueba manual: la píldora suma 50, los dots siguen valiendo 10 y nada más cambia de momento.
3. `game.js`: `ghostSpeed` devuelve `FRIGHT_GHOST_SPEED` si `g.frightened` (por encima del Elroy) y `decideGhost` elige al azar entre las opciones de `pickDir` (sin reversa, callejón como hoy). Prueba manual: tras una píldora, los fantasmas en el mapa van a mitad de velocidad y serpentean 6 s; al terminar recuperan su IA de SPEC 01.
4. `game.js`: comer fantasma — colisión con `frightened` suma `GHOST_POINTS[min(pelletChain, 3)]`, incrementa `pelletChain` y teleporta al fantasma a `GHOST_STARTS[i]` con `released: false, exited: false, dir: 'up', releaseDelay: EATEN_RELEASE_DELAY, frightened: false`; el bucle de colisiones sigue tras comer (puede comer a otro en el mismo frame); perder vida con fantasma normal mantiene el `break` y `resetPositions` limpia timer y flags. Prueba manual: 200+400 en cadena; el comido sale de la pen a ~1 s ya no azul aunque quede fright; morir con fright activo lo cancela.
5. `render.js`: `drawGhost` pinta el cuerpo `#2121de` si `g.frightened` y, en los últimos `FRIGHT_BLINK_FRAMES`, alterna blanco cada 10 frames usando `frame` y `game.frightTimer`; ojos sin cambios. Prueba manual: cuerpos azules, flash en los últimos 2 s y colores normales al acabar.

## Acceptance criteria

- [ ] Se ven 4 píldoras grandes parpadeando en las celdas (1,3), (26,3), (1,23) y (26,23).
- [ ] Comer una píldora suma exactamente 50 puntos; los dots siguen sumando 10.
- [ ] Al comer una píldora los 4 fantasmas se vuelven azules ~6 s, incluidos los que están en la pen.
- [ ] En los últimos ~2 s los cuerpos alternan azul y blanco.
- [ ] Durante el fright los fantasmas en el mapa van a mitad de velocidad y en cada cruce eligen dirección válida al azar, sin reversa de 180°.
- [ ] Comer la píldora hace dar media vuelta a los fantasmas que ya salieron de la pen.
- [ ] Chocar con un fantasma azul lo come: 200, 400, 800 y 1600 en orden; la cadena se reinicia con cada píldora nueva.
- [ ] El fantasma comido reaparece en su celda de la pen y sale por la puerta en ~1 s con color normal (no comible), aunque el fright siga activo.
- [ ] Chocar con un fantasma no asustado durante el fright sigue costando una vida (regresión).
- [ ] Perder vida cancela el fright: tras el reset nadie está azul y corre el reposicionado de SPEC 02.
- [ ] Al terminar el fright los fantasmas recuperan color, velocidad e IA de SPEC 01.
- [ ] No se gana el nivel sin comer las 4 píldoras: todas cuentan para `dotsRemaining`.
- [ ] La consola no muestra errores de JavaScript.

Todas las pruebas son manuales en navegador (`python3 -m http.server -d src`); el repo no tiene toolchain.

## Decisions

- **Sí:** puntuación en cadena 200/400/800/1600 vía `pelletChain`. Opción recomendada al usuario; el contador se reinicia con cada píldora como en el arcade.
- **Sí:** teleport del fantasma comido a la pen y salida ~1 s. Decisión cerrada del usuario; reutiliza `GHOST_STARTS`, `released`/`exited` y `exitPen`, que ya existen.
- **Sí:** IA aleatoria y velocidad 1/20 para los asustados. Fiel al arcade y barata; la velocidad mantiene la alineación a celdas (1/20 aterriza en enteros).
- **Sí:** reversa de 180° al comer la píldora, solo para `exited`. Una línea por fantasma y efecto visible.
- **Sí:** asustar también dentro de la pen (flag) y fantasma comido sale ya no asustado: fiel al arcade.
- **Sí:** timer global `frightTimer` + flag por fantasma `frightened`. Un contador, comparación barata; el flag por fantasma permite el caso del revivido.
- **Sí:** tile `4` con letra `o` en `MAZE_STR`. El mapa sigue siendo la única fuente de verdad, mismo patrón que dots y puerta.
- **Sí:** 50 puntos por píldora y cuenta para ganar y Elroy. Fidelidad arcade; el total de comibles no cambia.
- **No:** ojos que regresan caminando. Más fiel visualmente pero exige estado y render nuevos; el teleport lo cubre. Spec aparte si algún día se quiere.
- **No:** popup flotante de puntos. El SCORE del HUD basta; otra spec si se desea.
- **No:** boca ondulada nueva para el frightened, ni duración/velocidad por nivel. Con cuerpo azul y flash el estado se lee bien.
- **No:** reversa para fantasmas en marcha de salida de la pen: `exitPen` fuerza la dirección y sobrescribiría la reversa; queda sin efecto.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Timer expira en el mismo frame de una colisión | Orden fijo en `update`: tick antes de mover fantasmas y resolver colisiones; si llega a 0, el fantasma ya no es comable y cuesta vida. Determinista. |
| La reversa inmediata apunta fuera del laberinto o a un callejón | `moveGhost` ya consulta `canMove` y para si no puede; en el cruce siguiente la decisión normal sin reversa lo reconduce. |
| El Cruise Elroy se activa «antes» si quedan píldoras por comer | Fiel al arcade: los energizers cuentan en `dotsRemaining`; no se toca `ghostSpeed` salvo por fright. |

## Qué está **no** en esta spec

- Popup flotante con los puntos del fantasma comido.
- Ojos que vuelven caminando al pen.
- Vida extra a los 10 000 puntos.
- Sonido, sprites, scatter, duración decreciente por nivel, dificultad.

Cada una de esas, si aterriza, va en su propia spec.
