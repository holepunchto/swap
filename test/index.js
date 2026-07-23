const { test } = require('brittle')
const fs = require('bare-fs')
const os = require('bare-os')
const path = require('bare-path')
const App = require('../app.js')

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'swap-test-'))
}

test('swap exchanges the contents of two paths', (t) => {
  const dir = tmp()
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }))

  const a = path.join(dir, 'a')
  const b = path.join(dir, 'b')
  fs.writeFileSync(a, 'AAA')
  fs.writeFileSync(b, 'BBB')

  App.swap(a, b)

  t.is(fs.readFileSync(a, 'utf8'), 'BBB', 'source now holds target contents')
  t.is(fs.readFileSync(b, 'utf8'), 'AAA', 'target now holds source contents')
})

test('swap twice returns to the original state', (t) => {
  const dir = tmp()
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }))

  const a = path.join(dir, 'a')
  const b = path.join(dir, 'b')
  fs.writeFileSync(a, 'AAA')
  fs.writeFileSync(b, 'BBB')

  App.swap(a, b)
  App.swap(a, b)

  t.is(fs.readFileSync(a, 'utf8'), 'AAA', 'source restored')
  t.is(fs.readFileSync(b, 'utf8'), 'BBB', 'target restored')
})

test('swap throws when a path does not exist', (t) => {
  const dir = tmp()
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }))

  const a = path.join(dir, 'a')
  const missing = path.join(dir, 'missing')
  fs.writeFileSync(a, 'AAA')

  t.exception(() => App.swap(a, missing))
  t.is(fs.readFileSync(a, 'utf8'), 'AAA', 'existing path left untouched')
})
