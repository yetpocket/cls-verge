import fs from "fs-extra";
import { chmodSync as ChmodSync } from "node:fs";
import zlib from "zlib";
import path from "path";
import AdmZip from "adm-zip";
import fetch from "node-fetch";
import proxyAgent from "https-proxy-agent";
import { execSync } from "child_process";

const cwd = process.cwd();
const TEMP_DIR = path.join(cwd, "node_modules/.verge");
const FORCE = process.argv.includes("--force");

/* ======= clash meta ======= */
const META_URL_PREFIX = `https://github.com/yetpocket/cls-meta/releases/download/latest`;
const SERVICE_URL =
  "https://github.com/yetpocket/cls-verge-service/releases/download/latest";

const resolveMmdb = () =>
  resolveResource({
    file: "Country.mmdb",
    downloadURL: `https://github.com/yetpocket/cls-rules-dat/releases/download/latest/Country.mmdb`,
  });
const resolveGeosite = () =>
  resolveResource({
    file: "geosite.dat",
    downloadURL: `https://github.com/yetpocket/cls-rules-dat/releases/download/latest/geosite.dat`,
  });
const resolveGeoIP = () =>
  resolveResource({
    file: "geoip.dat",
    downloadURL: `https://github.com/yetpocket/cls-rules-dat/releases/download/latest/geoip.dat`,
  });

const META_MAP = {
  "win32-x64": {
    name: "clash.meta-windows-amd64",
    host: "x86_64-pc-windows-msvc",
  },
  "darwin-x64": {
    name: "clash.meta-darwin-amd64",
    host: "x86_64-apple-darwin",
  },
  "darwin-arm64": {
    name: "clash.meta-darwin-arm64",
    host: "aarch64-apple-darwin",
  },
  "linux-x64": {
    name: "clash.meta-linux-amd64-compatible",
    host: "x86_64-unknown-linux-gnu",
  },
  "linux-arm64": {
    name: "clash.meta-linux-arm64",
    host: "aarch64-unknown-linux-gnu",
  },
};

/**
 * check available
 */

const { platform, arch } = process;

if (!META_MAP[`${platform}-${arch}`]) {
  throw new Error(`clash meta unsupported platform "${platform}-${arch}"`);
}

async function downloadAllClashMetaPlatformArch() {
  let futs = Object.keys(META_MAP).map(async (x) => {
    let [platform, arch] = x.split("-");
    let config = clashMeta(platform, arch, META_MAP[x].host);
    await resolveSidecar(config);
  });
  await Promise.all(futs);
}

function clashMeta(platform, arch, host) {
  const name = META_MAP[`${platform}-${arch}`].name;
  const isWin = platform === "win32";
  const urlExt = isWin ? "zip" : "gz";
  const downloadURL = `${META_URL_PREFIX}/${name}.${urlExt}`;
  const exeFile = `${name}${isWin ? ".exe" : ""}`;
  const zipFile = `${name}.${urlExt}`;

  return {
    name: "clash-meta",
    targetFile: `clash-meta-${host}${isWin ? ".exe" : ""}`,
    exeFile,
    zipFile,
    downloadURL,
  };
}

function consoleExecSync(cmd) {
  console.log(`cmd: ${cmd}. output: `, execSync(cmd).toString());
}

/**
 * download sidecar and rename
 */
async function resolveSidecar(binInfo) {
  const { name, targetFile, zipFile, exeFile, downloadURL } = binInfo;

  const sidecarDir = path.join(cwd, "src-tauri", "sidecar");
  const sidecarPath = path.join(sidecarDir, targetFile);

  await fs.mkdirp(sidecarDir);
  if (!FORCE && (await fs.pathExists(sidecarPath))) return;

  const tempDir = path.join(TEMP_DIR, name);
  const tempZip = path.join(tempDir, zipFile);
  const tempExe = path.join(tempDir, exeFile);

  await fs.mkdirp(tempDir);
  consoleExecSync(`ls -ila ${tempDir}`);
  try {
    if (!(await fs.pathExists(tempZip))) {
      await downloadFile(downloadURL, tempZip);
    }

    if (zipFile.endsWith(".zip")) {
      const zip = new AdmZip(tempZip);
      zip.getEntries().forEach((entry) => {
        console.log(`[DEBUG]: "${name}" entry name`, entry.entryName);
      });
      zip.extractAllTo(tempDir, true);
      await fs.rename(tempExe, sidecarPath);
      console.log(`[INFO]: "${name}" unzip finished`);
    } else {
      // gz
      const readStream = fs.createReadStream(tempZip);
      const writeStream = fs.createWriteStream(sidecarPath);
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          console.error(`[ERROR]: "${name}" gz failed:`, error.message);
          reject(error);
        };
        readStream
          .pipe(zlib.createGunzip().on("error", onError))
          .pipe(writeStream)
          .on("finish", async () => {
            console.log(`[INFO]: "${name}" gunzip finished`);
            ChmodSync(sidecarPath, 755);
            consoleExecSync(`chmod 755 ${sidecarPath}`);
            consoleExecSync(`ls -ila ${sidecarPath}`);
            console.log(`[INFO]: "${name}" chmod binary finished`);
            resolve();
          })
          .on("error", onError);
      });
    }
  } catch (err) {
    // 需要删除文件
    await fs.remove(sidecarPath);
    throw err;
  }
}

/**
 * only Windows
 * get the wintun.dll (not required)
 */
async function resolveWintun() {
  const { platform } = process;

  if (platform !== "win32") return;

  const wintunPath = path.join(cwd, "wintun/bin/amd64/wintun.dll");
  const targetPath = path.join(cwd, "src-tauri/resources", "wintun.dll");

  let d1 = await fs.readdir(path.join(cwd));
  let d2 = await fs.readdir(path.join(cwd, "wintun"));
  console.log("wintun dir", d1, d2);
  await fs.mkdirp(path.dirname(targetPath));
  await fs.copyFile(wintunPath, targetPath);

  console.log(`[INFO]: resolve wintun.dll finished`);
}

/**
 * download the file to the resources dir
 */
async function resolveResource(binInfo) {
  const { file, downloadURL } = binInfo;

  const resDir = path.join(cwd, "src-tauri/resources");
  const targetPath = path.join(resDir, file);

  if (!FORCE && (await fs.pathExists(targetPath))) return;

  await fs.mkdirp(resDir);
  await downloadFile(downloadURL, targetPath);

  console.log(`[INFO]: ${file} finished`);
}

/**
 * download file and save to `path`
 */
async function downloadFile(url, path) {
  const options = {};

  const httpProxy =
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy;

  if (httpProxy) {
    options.agent = proxyAgent(httpProxy);
  }

  const response = await fetch(url, {
    ...options,
    method: "GET",
    headers: { "Content-Type": "application/octet-stream" },
  });
  const buffer = await response.arrayBuffer();
  await fs.writeFile(path, new Uint8Array(buffer));

  console.log(`[INFO]: download finished "${url} at ${path}"`);
}

/**
 * main
 */

const resolveService = () =>
  resolveResource({
    file: "clash-verge-service.exe",
    downloadURL: `${SERVICE_URL}/clash-verge-service.exe`,
  });
const resolveInstall = () =>
  resolveResource({
    file: "install-service.exe",
    downloadURL: `${SERVICE_URL}/install-service.exe`,
  });
const resolveUninstall = () =>
  resolveResource({
    file: "uninstall-service.exe",
    downloadURL: `${SERVICE_URL}/uninstall-service.exe`,
  });

const tasks = [
  {
    name: "clash-meta",
    func: () => downloadAllClashMetaPlatformArch(),
    retry: 5,
  },
  { name: "wintun", func: resolveWintun, retry: 5, winOnly: true },
  { name: "service", func: resolveService, retry: 5, winOnly: true },
  { name: "install", func: resolveInstall, retry: 5, winOnly: true },
  { name: "uninstall", func: resolveUninstall, retry: 5, winOnly: true },
  { name: "mmdb", func: resolveMmdb, retry: 5 },
  { name: "geosite", func: resolveGeosite, retry: 5 },
  { name: "geoip", func: resolveGeoIP, retry: 5 },
];

async function runTask() {
  const task = tasks.shift();
  if (!task) return;
  if (task.winOnly && process.platform !== "win32") return runTask();

  for (let i = 0; i < task.retry; i++) {
    try {
      await task.func();
      break;
    } catch (err) {
      console.error(`[ERROR]: task::${task.name} try ${i} ==`, err.message);
      if (i === task.retry - 1) throw err;
    }
  }
  return runTask();
}

runTask();
