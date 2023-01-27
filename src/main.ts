import * as fs from "fs";

const enum LogType {
  default = "",
  red = "\x1b[31m%s\x1b[0m",
  green = "\x1b[32m%s\x1b[0m",
  yellow = "\x1b[33m%s\x1b[0m",
  blue = "\x1b[34m%s\x1b[0m",
}

let fileStructure: Map<string, string[]> = new Map();
let fileWatchers: Map<string, fs.FSWatcher> = new Map();

let dir: string = "./src";
let mesonFilePath: string = "./meson.build";
let includeExtensions: string[] = [".vala"];
let runOnStart: boolean = false;
let checkSubDirs: boolean = true;
let logging: boolean = true;

let arg: string;
let argIndex: number = 2;
while ((arg = process.argv[argIndex])) {
  switch (arg) {
    case "-d":
    case "--dir":
      dir = process.argv[++argIndex];
      break;
    case "-m":
    case "--meson":
      mesonFilePath = process.argv[++argIndex];
      break;
    case "-i":
    case "--include":
      if (process.argv[argIndex + 1].startsWith(".")) {
        includeExtensions.push(...process.argv[++argIndex].split(","));
      } else {
        console.error(LogType.red, "Include extensions must start with a dot");
        process.exit(1);
      }
      break;
    case "--ros":
      if (
        process.argv[argIndex + 1]?.toLowerCase() === "true" ||
        process.argv[argIndex + 1]?.toLowerCase() === "false"
      ) {
        runOnStart = process.argv[++argIndex].toLowerCase() === "true";
      } else {
        runOnStart = true;
      }
      break;
    case "--subdir":
      if (
        process.argv[argIndex + 1]?.toLowerCase() === "true" ||
        process.argv[argIndex + 1]?.toLowerCase() === "false"
      ) {
        checkSubDirs = process.argv[++argIndex].toLowerCase() === "true";
      }
      break;
    case "--log":
      if (
        process.argv[argIndex + 1]?.toLowerCase() === "true" ||
        process.argv[argIndex + 1]?.toLowerCase() === "false"
      ) {
        logging = process.argv[++argIndex].toLowerCase() === "true";
      }
      break;
    case "-h":
    case "--help":
      console.log("Usage: vala-meson-watcher [options]");
      console.log("Options:");
      console.log("-d, --dir <path>        Directory to watch for changes");
      console.log("-m, --meson <path>      Path to meson.build file");
      console.log(
        "-i, --include <ext>     File extensions to include in meson.build"
      );
      console.log(
        "--ros                   Change sources in Meson file when starting the tool (default: false)"
      );
      console.log(
        "--subdir                Include subdirectories (default: true)"
      );
      console.log("--log                   Enable logging (default: true)");
      console.log("-v, --version           Print version");
      console.log("-h, --help              Display this help message");
      process.exit(0);
    case "-v":
    case "--version":
      console.log("vala-meson-watcher v0.1.2");
      process.exit(0);
    default:
      console.error(LogType.red, "Unknown argument: " + arg);
      break;
  }
  argIndex++;
}

function log(message: string, type: LogType = LogType.default): void {
  if (logging) console.log(type, message);
}

if (!fs.existsSync(mesonFilePath)) {
  console.error(LogType.red, "Meson build file not found");
  process.exit(1);
}

addWatcher(dir);
getAllFilesFromDir(dir || "./src");
if (runOnStart) updateMeson();

//watch for changes in the directory
function addWatcher(path: string): void {
  log(`Watching ${path}`);
  let watcher: fs.FSWatcher = fs.watch(
    path || "./src",
    (eventType: string, filename: string) => {
      log(`${eventType} event occurred on ${filename}`);
      getAllFilesFromDir(path || "./src");
      updateMeson();
    }
  );
  fileWatchers.set(path, watcher);
}

function stripPrefix(str: string): string {
  if (str.startsWith("/")) {
    return str.substring(1);
  } else if (str.startsWith("./")) {
    return str.substring(2);
  } else {
    return str;
  }
}

function fileStructureToString(): string {
  let str: string = "";
  for (let [key, value] of fileStructure) {
    let formattedKey: string = `'${stripPrefix(key).replace(/\//g, "' / '")}'`;
    for (let i: number = 0; i < value.length; i++) {
      str += formattedKey + " / " + `'${value[i]}'` + ",\n";
    }
  }
  return str;
}

function updateMeson(): void {
  let mesonBuildFile: string = fs.readFileSync(mesonFilePath, "utf8");
  let anchorTop: number = mesonBuildFile.indexOf("#vmw-anchor-top");
  let anchorBottom: number = mesonBuildFile.indexOf("#vmw-anchor-bottom");

  if (anchorTop === -1 || anchorBottom === -1) {
    console.error(LogType.red, "Meson build file does not contain anchor");
    return;
  }
  //remove everything between the top & bottom anchor
  let mesonBuildFileWithoutAnchor: string =
    mesonBuildFile.slice(0, anchorTop + "#vmw-anchor-top".length) +
    mesonBuildFile.slice(anchorBottom);
  //add the new files between the top & bottom anchor
  let fileString: string = fileStructureToString();

  anchorTop = mesonBuildFileWithoutAnchor.indexOf("#vmw-anchor-top");
  anchorBottom = mesonBuildFileWithoutAnchor.indexOf("#vmw-anchor-bottom");

  let mesonBuildFileWithNewFiles: string = `${mesonBuildFileWithoutAnchor.slice(
    0,
    anchorTop + "#vmw-anchor-top".length
  )}\n${fileString}${mesonBuildFileWithoutAnchor.slice(anchorBottom)}`;

  fs.writeFileSync("./meson.build", mesonBuildFileWithNewFiles);
}

function getAllFilesFromDir(path: string): void {
  fileStructure.set(path, []);
  let files: fs.Dirent[] = fs.readdirSync(path, { withFileTypes: true });
  files.forEach((file: fs.Dirent): void => {
    if (
      file.isDirectory() &&
      checkSubDirs &&
      !fileWatchers.has(path + "/" + file.name)
    ) {
      addWatcher(`${path}/${file.name}`);
      getAllFilesFromDir(`${path}/${file.name}`);
    } else {
      if (includeExtensions.includes(`.${file.name.split(".").pop()}`)) {
        fileStructure.get(path).push(file.name);
      }
    }
  });
}

//cleanup watch on close
process.on("SIGINT", () => {
  log("Closing...");
  fileWatchers.forEach((watcher, path) => {
    log(`Closing watcher: ${path}`);
    watcher.close();
  });
  process.exit();
});
