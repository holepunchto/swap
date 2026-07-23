#!/bin/sh

set -eu

REPO="holepunchto/swap"
ASSET="by-arch.tar.gz"

DEST="./by-arch"

URL="https://github.com/$REPO/releases/latest/download/$ASSET"


TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading $URL"
curl -fSL --retry 3 -o "$TMP/$ASSET" "$URL"

mkdir -p "$DEST"
echo "Extracting to $DEST"
tar -xzf "$TMP/$ASSET" --strip-components=1 -C "$DEST"

cd "$DEST"

UPGRADE="$(npm pkg get upgrade | tr -d '"')"
SOURCE="$(pear touch)"

echo "Done: $DEST"
