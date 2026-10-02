// All side-view silhouettes, merged from one file per group. Each shape is
// drawn in its own unit box (x 0..w, y 0..h, ground at y = h); layout.js
// scales it so its refX/refY equals the object's sourced measurement.

import { SHAPES as LIVING } from './silhouettes-living.js'
import { SHAPES as VEHICLES } from './silhouettes-vehicles.js'
import { SHAPES as PLACES } from './silhouettes-places.js'
import { SHAPES as G_MICRO } from './silhouettes-micro.js'
import { SHAPES as G_EVERYDAY } from './silhouettes-everyday.js'
import { SHAPES as G_SPORTS } from './silhouettes-sports.js'
import { SHAPES as G_PREHISTORIC } from './silhouettes-prehistoric.js'
import { SHAPES as G_ANIMALS2 } from './silhouettes-animals2.js'
import { SHAPES as G_VEHICLES2 } from './silhouettes-vehicles2.js'
import { SHAPES as G_STRUCTURES2 } from './silhouettes-structures2.js'
import { SHAPES as G_COSMOS } from './silhouettes-cosmos.js'

export const SHAPES = { ...LIVING, ...VEHICLES, ...PLACES, ...G_MICRO, ...G_EVERYDAY, ...G_SPORTS, ...G_PREHISTORIC, ...G_ANIMALS2, ...G_VEHICLES2, ...G_STRUCTURES2, ...G_COSMOS }
