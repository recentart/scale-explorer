// All side-view silhouettes, merged from one file per group. Each shape is
// drawn in its own unit box (x 0..w, y 0..h, ground at y = h); layout.js
// scales it so its refX/refY equals the object's sourced measurement.

import { SHAPES as LIVING } from './silhouettes-living.js'
import { SHAPES as VEHICLES } from './silhouettes-vehicles.js'
import { SHAPES as PLACES } from './silhouettes-places.js'

export const SHAPES = { ...LIVING, ...VEHICLES, ...PLACES }
