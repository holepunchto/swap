# swap

> Atomically swap two filesystem paths

A Pear standalone-binary CLI that exchanges a `<source>` path with a `<target>` path. Swaps are atomic on macOS and Linux, and go via a temporary path on Windows.

Evergreen command via peer-to-peer over-the-air-updates.

## Install

```sh
pear install pear://swapb14acos6iasoz5jg8bj46zt8emdk9rmm4n9j18mtjmwbqmwo
```

## Usage

```sh
swap [flags] <source> <target>
```

Swaps the `<source>` path with the `<target>` path. Atomic on macOS and Linux; via a temporary path on Windows.

| Flag                      | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `--update-window`, `-w`   | wait for update (ms, default 30000)                   |
| `--update-cooldown`, `-c` | min. time between update checks (ms, default 1200000) |
| `--no-updates`, `-n`      | disable updates on this run                           |
| `--version`, `-v`         | version                                               |
| `--help`, `-h`            | show help                                             |

## Over-the-air Updates

Unless the `--no-updates` flag is used, `swap` spawns a short-lived, detached updater daemon that checks the peer-to-peer network for a newer build and applies it in place, then exits.

It waits up to `--update-window` milliseconds (default 30s) to discover an update; a download already in progress is never cut off. Only one updater runs per storage directory at a time (a lock file), and its output is written to `<storage>/updates.log`.

Updates are published over-the-air with the [Pear CLI](https://docs.pears.com/reference/pear/cli/) and consumed via [pear-runtime](https://docs.pears.com/reference/pear/runtime/). The tracked link is the `upgrade` field in [package.json](package.json).

## Development

```sh
npm install
npm start -- <source> <target>   # bare bin.mjs --no-updates
npm test                         # brittle-bare tests
npm run lint                     # prettier check + lunte
npm run format                   # prettier write
```

The `start` script passes `--no-updates` so local builds aren't swapped out while iterating. To exercise the updater in dev, run `bare bin.mjs <source> <target>` directly, or `bare bin.mjs --updater` to run the updater daemon on its own.

### Make Binaries

```sh
npm run make                 # auto-detect host os/arch
```

Targets: `darwin-arm64`, `darwin-x64`, `linux-arm64`, `linux-x64`, `win32-arm64`, `win32-x64`. Output goes to `out/<platform>-<arch>`.

## License

Apache-2.0
