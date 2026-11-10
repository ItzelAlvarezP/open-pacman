// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame
const BLINKY_SPEED = 1 / 9; // 1/9 celda/frame -> alinea cada 9 frames
const ELROY_DOTS = 30;      // dots restantes para el turbo de Blinky
const ELROY_SPEED = 0.125;  // 1/8 celda/frame, par con Pac-Man en el tramo final
const CLYDE_SHY_RANGE = 8;  // celdas de distancia para que Clyde huya

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      releaseDelay: g.releaseDelay,
      // blinky nace activo sobre la puerta; el resto espera en la pen
      released: g.kind === 'blinky',
      exited: g.kind === 'blinky',
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado por pared (1); la puerta (3) solo deja pasar a un
//           fantasma que aun no ha salido de la pen (no puede reentrar)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return actor === 'pacman' || actor.exited;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Distancia euclidea entre dos puntos (en celdas).
function euclidDist( ax, ay, bx, by ) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt( dx * dx + dy * dy );
}

// Celda n celdas por delante de Pac-Man segun su direccion actual
// (sin el "bug del up": se usa siempre la direccion actual).
function cellAhead( p, n ) {
  const d = DIRS[ p.dir ];
  return { x: Math.round( p.x ) + d.x * n, y: Math.round( p.y ) + d.y * n };
}

// Esquina a la que se retira Clyde cuando Pac-Man esta demasiado cerca.
const CLYDE_CORNER = { x: 1, y: 29 };

// Punto de mira de cada fantasma segun su personalidad, en celdas:
//   blinky -> celda de Pac-Man (persecucion directa).
//   pinky  -> 4 celdas por delante de Pac-Man (emboscada).
//   inky   -> punto 2 celdas delante de Pac-Man, duplicado respecto a
//             Blinky (flanqueo).
//   clyde  -> su esquina si esta a <= 8 celdas; si no, persigue.
function ghostTarget( game, g ) {
  const p = game.pacman;
  const pc = { x: Math.round( p.x ), y: Math.round( p.y ) };

  switch ( g.kind ) {
    case 'blinky':
      return pc;
    case 'pinky':
      return cellAhead( p, 4 );
    case 'inky': {
      const pivot = cellAhead( p, 2 );
      const blinky = game.ghosts[ 0 ]; // blinky: primera entrada de GHOST_STARTS
      return {
        x: pivot.x * 2 - Math.round( blinky.x ),
        y: pivot.y * 2 - Math.round( blinky.y ),
      };
    }
    case 'clyde':
      if ( euclidDist( g.x, g.y, pc.x, pc.y ) <= CLYDE_SHY_RANGE ) return CLYDE_CORNER;
      return pc;
  }
}

// El arcade resuelve el empate prefiriendo up > left > down > right.
const TIE_BREAK = [ 'up', 'left', 'down', 'right' ];

// Elige entre las direcciones validas sin reversa de 180 (salvo callejon
// sin salida) la que menor distancia euclidea deje al objetivo.
function pickDir( grid, g, target ) {
  const valid = TIE_BREAK.filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, g )
  );
  // Sin salida (callejon): la reversa de 180 es la única opcion.
  const choices = valid.length ? valid : [ OPPOSITE[ g.dir ] ];

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dist = euclidDist( g.x + d.x, g.y + d.y, target.x, target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  g.dir = pickDir( game.grid, g, ghostTarget( game, g ) );
}

// Columna (x) de la puerta que mas cerca este de x. Escanea el grid,
// sin magic numbers: la puerta es cualquier celda con valor 3.
function nearestDoorCol( grid, x ) {
  let best = null;
  let bestDist = Infinity;
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let c = 0; c < grid[ 0 ].length; c++ ) {
      if ( grid[ y ][ c ] !== 3 ) continue;
      const d = Math.abs( c - x );
      if ( d < bestDist ) {
        bestDist = d;
        best = c;
      }
    }
  }
  return best;
}

// Marcha de salida de la pen: hacia la columna de puerta mas cercana
// por la fila actual y luego hacia arriba; al pisar la fila 11 queda fuera.
function exitPen( game, g ) {
  const grid = game.grid;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.y === 11 ) {
      g.exited = true;
      return; // no avanza mas este frame
    }
    const col = nearestDoorCol( grid, g.x );
    if ( g.x < col ) g.dir = 'right';
    else if ( g.x > col ) g.dir = 'left';
    else g.dir = 'up';
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
}

// Cruise Elroy simplificado: Blinky acelera en el tramo final del nivel.
function ghostSpeed( game, g ) {
  if ( g.kind === 'blinky' ) {
    return game.dotsRemaining <= ELROY_DOTS ? ELROY_SPEED : BLINKY_SPEED;
  }
  return GHOST_SPEED;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;
  g.speed = ghostSpeed( game, g ); // recalculada en cada frame

  // Aun en la pen: cuenta atras de salida en frames de juego.
  if ( !g.released ) {
    if ( g.releaseDelay > 0 ) g.releaseDelay--;
    if ( g.releaseDelay === 0 ) g.released = true;
    return;
  }
  // Liberado sin salir: marcha determinista hacia la puerta.
  if ( !g.exited ) {
    exitPen( game, g );
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, g ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.releaseDelay = GHOST_STARTS[ i ].releaseDelay;
    g.released = false;
    g.exited = false;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
