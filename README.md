### FAQ

#### 1. **macOS** "Clash Verge" is damaged and can't be opened


修改后Verge只有Meta内核

```bash
sudo xattr -r -d com.apple.quarantine /Applications/ClashVerge.app
sudo chown root:admin /Applications/ClashVerge.app/Contents/MacOS/clash-meta
sudo chmod +sx /Applications/ClashVerge.app/Contents/MacOS/clash-meta
```

## Development

You should install Rust and Nodejs, see [here](https://tauri.app/v1/guides/getting-started/prerequisites) for more details. Then install Nodejs packages.

```shell
yarn install
```

Then download the clash binary... Or you can download it from [clash premium release](https://github.com/Dreamacro/clash/releases/tag/premium) and rename it according to [tauri config](https://tauri.studio/docs/api/config/#tauri.bundle.externalBin).

```shell
# force update to latest version
# yarn run check --force

yarn run check
```

Then run

```shell
yarn dev

# run it in another way if app instance exists
yarn dev:diff
```

Or you can build it

https://tauri.app/v1/guides/getting-started/prerequisites/#setting-up-linux

```bash
apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev -y
```

```shell
yarn build
```
