const fs = require('bare-fs')
const fsx = require('fs-native-extensions')
const daemon = require('bare-daemon')
const path = require('bare-path')
const { isWindows } = require('which-runtime')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const PearRuntime = require('pear-runtime')
const ReadyResource = require('ready-resource')

module.exports = class App extends ReadyResource {
  static swap(source, target) {
    if (isWindows) {
      nonAtomicSwap()
      return
    }
    fsx.swapSync(source, target)
  }

  static updates(dir, app, cooldown = 1.2e6) {
    const lock = path.join(dir, 'updater.lock')
    try {
      // time-lock: the daemon stamps this file's mtime each check, so skip the
      // spawn entirely if one ran (or is running) within the cooldown.
      if (Date.now() - fs.statSync(lock).mtimeMs < cooldown) return null
    } catch {} // no lock yet: first run, go ahead

    const args = []
    if (path.basename(app) === 'bare') args.push(Bare.argv[1])
    args.push('--updater', '--storage', dir)
    return daemon.spawn(app, args)
  }

  constructor({ dir, app, updates, version, upgrade, name }) {
    super()
    fs.mkdirSync(dir, { recursive: true })
    this.dir = dir
    this.app = app
    this.updates = updates
    this.version = version
    this.upgrade = upgrade
    this.name = name

    this.store = null
    this.swarm = null
    this.pear = null
    this.timeout = null
    this.lock = null
  }

  _open() {
    const store = new Corestore(path.join(this.dir, 'pear-runtime', 'corestore'))
    const swarm = new Hyperswarm()
    const pear = new PearRuntime({
      dir: this.dir,
      app: this.app,
      updates: this.updates,
      version: this.version,
      upgrade: this.upgrade,
      name: this.name,
      store,
      swarm
    })

    this.store = store
    this.swarm = swarm
    this.pear = pear

    pear.updater.on('error', (err) => this.emit('error', err))

    if (this.updates === false) return

    pear.updater.on('updating', () => {
      clearTimeout(this.timeout) // a download started; don't cut it off
      this.emit('updating')
    })
    pear.updater.on('updated', () => this._applyUpdate())

    swarm.on('connection', (connection) => {
      store.replicate(connection)
    })
    swarm.join(pear.updater.drive.core.discoveryKey, {
      client: true,
      server: false
    })
  }

  async _close() {
    clearTimeout(this.timeout)

    if (this.lock !== null) {
      fsx.unlock(this.lock)
      fs.closeSync(this.lock)
      this.lock = null
    }

    const store = this.store
    const swarm = this.swarm
    const pear = this.pear

    this.store = null
    this.swarm = null
    this.pear = null

    await swarm?.destroy()
    await pear?.close()
    await store?.close()
  }

  async _applyUpdate() {
    this.emit('updated')
    try {
      await this.pear.updater.applyUpdate()
      this.emit('update-applied')
    } catch (err) {
      this.emit('error', err)
    }
  }

  async updater(wait = 30_000) {
    if (this.updates === false) return

    const lockPath = path.join(this.dir, 'updater.lock')
    const lock = fs.openSync(lockPath, 'a+')
    if (fsx.tryLock(lock) === false) {
      fs.closeSync(lock)
      return
    }
    this.lock = lock
    fs.utimesSync(lockPath, new Date(), new Date()) // stamp the check time

    await this.ready()

    await new Promise((resolve) => {
      this.timeout = setTimeout(resolve, wait)
      this.once('update-applied', resolve)
      this.once('error', resolve)
    })
  }

  async exit(code = 0) {
    Bare.exitCode = code
    await this.close()
  }
}

// nonAtomicSwap needed until addressed in fs-native-extensions
// https://github.com/holepunchto/fs-native-extensions/blob/945789b34d638deb6b36ce4712321a27ab68b623/test/swap.js#L8
function nonAtomicSwap(source, target) {
  fs.statSync(source)
  fs.statSync(target)

  const stash = path.join(
    path.dirname(source),
    '.' + path.basename(source) + '.swap-' + Date.now().toString(36)
  )

  fs.renameSync(source, stash)
  try {
    fs.renameSync(target, source)
    fs.renameSync(stash, target)
  } catch (err) {
    try {
      fs.renameSync(stash, source)
    } catch {}
    throw err
  }
}
