const fs = require('fs')
const assert = require('./support/assert')
const rasterRendererFactory = require('../../lib/raster-renderer')
const { describe, it, before } = require('mocha')

describe('Render Metatile Cache Headers ', function () {
  const scenario = [
    { coords: [0, 0, 0], metatileCacheHeader: 'MISS' },

    { coords: [1, 0, 0], metatileCacheHeader: 'MISS' },
    { coords: [1, 0, 1], metatileCacheHeader: 'HIT' },
    { coords: [1, 1, 0], metatileCacheHeader: 'HIT' },
    { coords: [1, 1, 1], metatileCacheHeader: 'HIT' },

    { coords: [2, 0, 0], metatileCacheHeader: 'MISS' },
    { coords: [2, 0, 1], metatileCacheHeader: 'HIT' },
    { coords: [2, 1, 0], metatileCacheHeader: 'HIT' },
    { coords: [2, 1, 1], metatileCacheHeader: 'HIT' },

    { coords: [2, 0, 2], metatileCacheHeader: 'MISS' },
    { coords: [2, 0, 3], metatileCacheHeader: 'HIT' },
    { coords: [2, 1, 2], metatileCacheHeader: 'HIT' },
    { coords: [2, 1, 3], metatileCacheHeader: 'HIT' },

    { coords: [2, 2, 0], metatileCacheHeader: 'MISS' },
    { coords: [2, 2, 1], metatileCacheHeader: 'HIT' },
    { coords: [2, 3, 0], metatileCacheHeader: 'HIT' },
    { coords: [2, 3, 1], metatileCacheHeader: 'HIT' },

    { coords: [2, 2, 2], metatileCacheHeader: 'MISS' },
    { coords: [2, 2, 3], metatileCacheHeader: 'HIT' },
    { coords: [2, 3, 2], metatileCacheHeader: 'HIT' },
    { coords: [2, 3, 3], metatileCacheHeader: 'HIT' }
  ]

  describe('getTile()', function () {
    let renderer

    before(function () {
      renderer = rasterRendererFactory({
        xml: fs.readFileSync('./test/raster/data/world.xml', 'utf8'),
        base: './test/raster/data/',
        metatile: 2
      })
    })

    scenario.forEach(({ coords, metatileCacheHeader }) => {
      it(`Carto-Metatile-Cache for tile ${coords.join(',')} should be equal to ${metatileCacheHeader}`, async function () {
        const [ z, x, y ] = coords
        const { headers } = await renderer.getTile('png', z, x, y)

        assert.strictEqual(headers['Carto-Metatile-Cache'], metatileCacheHeader, `Tile: ${coords.join(',')}; Expected: ${metatileCacheHeader}; Actual: ${headers['Carto-Metatile-Cache']}`)
      })
    })
  })
})
