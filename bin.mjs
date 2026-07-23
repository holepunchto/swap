import { command, arg, flag, summary, bail, description } from 'paparam'
import { persistent } from 'bare-storage'
import os from 'bare-os'
import { isWindows } from 'which-runtime'
import path from 'bare-path'
import FileLog from 'bare-file-logger'
import Console from 'bare-console'
import pkg from './package.json'
import App from './app.js'

const appName = pkg.productName || pkg.name
const isDev = path.basename(Bare.argv[0]) === 'bare'
const name = isWindows ? appName + '.exe' : appName

const cmd = command(
  appName,
  summary('swap source path with target path'),
  description('swaps atomically on macOS & Linux\nswaps via temporary path on Windows'),
  arg('<source>', 'source path'),
  arg('<target>', 'target path'),
  flag('--storage <dir>', 'custom storage directory').hide(),
  flag('--updater', 'run updater daemon').hide(),
  flag('--update-window|-w [ms=30_000]', 'wait for update (30s)'),
  flag('--update-cooldown|-c [ms=1.2e6]', 'min. time between update checks (20m)'),
  flag('--no-updates|-n', 'disable updates on this run'),
  flag('--version|-v', 'version'),
  swap,
  bail(async (bail) => {
    const flags = bail.command.flags
    if (flags.updater) {
      await update(bail.command)
      return
    }
    updates(bail.command)
    if (flags.version) {
      console.log('v' + pkg.version)
      Bare.exit()
    }
    if (bail.err) {
      console.error(bail.err)
      Bare.exit(1)
    }
    if (bail.reason === 'MISSING_ARG') {
      console.error('ERROR:', bail.arg.value, 'is required')
    } else {
      console.error(bail.reason)
    }
    console.log('\n' + bail.command.usage())
    Bare.exit(1)
  })
)

cmd.parse(Bare.argv.slice(isDev ? 2 : 1))

if (cmd.flags.help) {
  updates(cmd)
  Bare.exit()
}

function updates(cmd) {
  if (!cmd.flags.updates || cmd.flags.updater) return
  const storage =
    cmd.flags.storage ||
    (isDev ? path.join(os.tmpdir(), 'pear', appName) : path.join(persistent(), appName))
  App.updates(
    storage,
    os.execPath(),
    cmd.flags.updateCooldown ? Number(cmd.flags.updateCooldown) : undefined
  )
}

function swap(cmd) {
  try {
    updates(cmd)
    App.swap(cmd.args.source, cmd.args.target)
    Bare.exit()
  } catch (err) {
    console.error(err)
    Bare.exit(1)
  }
}

async function update(cmd) {
  const storage =
    cmd.flags.storage ||
    (isDev ? path.join(os.tmpdir(), 'pear', appName) : path.join(persistent(), appName))

  const app = new App({
    dir: storage,
    app: isDev ? null : os.execPath(),
    updates: true,
    version: pkg.version,
    upgrade: pkg.upgrade,
    name
  })

  const console = new Console(
    new FileLog(path.join(storage, 'updates.log'), { maxSize: 1024 * 1024 })
  )

  app.on('updating', () => console.log('[updater] downloading update'))
  app.on('update-applied', () => console.log('[updater] update applied'))
  app.on('error', (err) => console.error(err))

  try {
    await app.updater(cmd.flags.updateWindow ? Number(cmd.flags.updateWindow) : undefined)
  } catch (err) {
    console.error(err)
    await app.exit(1)
  }
  await app.exit()
}
