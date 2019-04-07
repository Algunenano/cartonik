'use strict'

const vectorRendererFactory = require('../lib/vector-renderer')
const path = require('path')
const fs = require('fs')
const mapnik = require('@carto/mapnik')
const zlib = require('zlib')
const UPDATE = process.env.UPDATE
const createMapPool = require('../lib/map-pool')
const defaults = require('../lib/defaults')
const assert = require('assert')
const { it } = require('mocha')
const { promisify } = require('util')

mapnik.register_default_input_plugins()

// Load fixture data.
const xml = {
  a: fs.readFileSync(path.resolve(path.join(__dirname, '/fixtures/mmls/test-a.xml')), 'utf8'),
  b: fs.readFileSync(path.resolve(path.join(__dirname, '/fixtures/mmls/test-b.xml')), 'utf8'),
  c: fs.readFileSync(path.resolve(path.join(__dirname, '/fixtures/mmls/test-c.xml')), 'utf8')
}

it('should fail without xml', function () {
  assert.throws(() => vectorRendererFactory({}), { message: 'No XML provided' })
})

it('should fail with invalid xml', async function () {
  const renderer = vectorRendererFactory({ xml: 'bogus' })
  try {
    await renderer.getTile('mvt', 0, 0, 0)
    throw new Error('Should not throw this error')
  } catch (err) {
    assert.strictEqual(err.message, 'expected < at line 1')
  } finally {
    await renderer.close()
  }
})

it('should fail with invalid xml at map.acquire', async function () {
  const renderer = vectorRendererFactory({ xml: '<Map></Map>' })
  // manually break the map pool to deviously trigger later error
  // this should never happen in reality but allows us to
  // cover this error case nevertheless
  const uri = defaults({})
  renderer._mapPool = createMapPool(uri, 'bogus xml')
  try {
    await renderer.getTile('mvt', 0, 0, 0)
    throw new Error('Should not throw this error')
  } catch (err) {
    assert.strictEqual(err.message, 'expected < at line 1')
  } finally {
    await renderer.close()
  }
})

it('should fail with out of bounds x or y', async function () {
  const renderer = vectorRendererFactory({ xml: xml.a, base: path.join(__dirname, '/fixtures/datasources/shapefiles/world-borders') })
  try {
    await renderer.getTile('mvt', 0, 0, 1)
    throw new Error('Should not throw this error')
  } catch (err) {
    assert.strictEqual(err.message, 'required parameter y is out of range of possible values based on z value')
  } finally {
    await renderer.close()
  }
})

it('should load with callback', async function () {
  const renderer = vectorRendererFactory({ xml: xml.a, base: path.join(__dirname, '/fixtures/datasources/shapefiles/world-borders') })
  await renderer.close()
})

var sources = {
  a: { xml: xml.a, base: path.join(__dirname, '/fixtures/datasources/shapefiles/world-borders'), blank: true },
  b: { xml: xml.b, base: path.join(__dirname, '/fixtures/datasources/shapefiles/world-borders') },
  c: { xml: xml.a, base: path.join(__dirname, '/fixtures/datasources/shapefiles/world-borders'), blank: false }
}
var tests = {
  a: ['0.0.0', '1.0.0', '1.0.1', { key: '10.0.0', empty: true }, { key: '10.765.295' }],
  b: ['0.0.0'],
  c: [{ key: '10.0.0', empty: true }, { key: '10.765.295' }]
}
Object.keys(tests).forEach(function (source) {
  it('setup', function () {
    sources[source] = vectorRendererFactory(sources[source])
  })
})
Object.keys(tests).forEach(function (source) {
  tests[source].forEach(function (obj) {
    var key = obj.key ? obj.key : obj
    var z = key.split('.')[0] | 0
    var x = key.split('.')[1] | 0
    var y = key.split('.')[2] | 0
    it('should render ' + source + ' (' + key + ')', async function () {
      const { tile, headers } = await sources[source].getTile('mvt', z, x, y)
      // Test that empty tiles are so.
      if (obj.empty) {
        assert.strictEqual(tile.length, 0)
        assert.strictEqual(headers['x-tilelive-contains-data'], false)
        return
      }

      assert.strictEqual(headers['Content-Type'], 'application/x-protobuf')
      assert.strictEqual(headers['Content-Encoding'], 'gzip')

      // Test solid key generation.
      if (obj.solid) {
        assert.strictEqual(tile.solid, obj.solid)
      }

      const buffer = await promisify(zlib.gunzip)(tile)

      var filepath = path.join(__dirname, '/fixtures/output/pbfs/' + source + '.' + key + '.vector.pbf')
      if (UPDATE || !fs.existsSync(filepath)) fs.writeFileSync(filepath, buffer)

      var expected = fs.readFileSync(filepath)
      var vtile1 = new mapnik.VectorTile(+z, +x, +y)
      var vtile2 = new mapnik.VectorTile(+z, +x, +y)

      vtile1.setDataSync(expected)
      vtile2.setDataSync(buffer)

      assert.vectorEqualsFile(filepath, vtile1, vtile2)
      assert.strictEqual(expected.length, buffer.length)
      assert.deepStrictEqual(expected, buffer)
    })
  })
})

Object.keys(tests).forEach(function (source) {
  it('teardown', async function () {
    assert.strictEqual(1, sources[source]._mapPool.size)
    await sources[source].close()
    assert.strictEqual(0, sources[source]._mapPool.size)
  })
})
