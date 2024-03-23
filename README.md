### FAQ

#### 1. **macOS** "Clash Verge" is damaged and can't be opened


修改后Verge只有Meta内核

```bash
sudo xattr -r -d com.apple.quarantine /Applications/ClashVerge.app
sudo chown root:admin /Applications/ClashVerge.app/Contents/MacOS/clash-meta
sudo chmod +sx /Applications/ClashVerge.app/Contents/MacOS/clash-meta
```
#### Linux enable tun report Permission denied

```
sudo setcap cap_net_bind_service,cap_net_admin=+ep /usr/bin/clash-meta
```

## Development

### setup

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

### install, run, build

```shell
yarn install
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

build
```shell
yarn build
```
