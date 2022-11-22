#! /usr/bin/env node

const fs = require('fs');

let fileStructure = new Map();
let fileWatchers = new Map();

let dir = './src';
let mesonFilePath = './meson.build';
let includeExtensions = ['.vala'];
let runOnStart = false;
let checkSubDirs = true;

let arg;
let argIndex = 2;
while ((arg = process.argv[argIndex])) {
	switch (arg) {
		case '-d':
		case '--dir':
			dir = process.argv[++argIndex];
			break;
		case '-m':
		case '--meson':
			mesonFilePath = process.argv[++argIndex];
			break;
		case '-i':
		case '--include':
			if (process.argv[argIndex + 1].startsWith('.')) {
				includeExtensions.push(process.argv[++argIndex].split(','));
			} else {
				console.error('Include extensions must start with a dot');
				return;
			}
			break;
		case '--ros':
			if (
				process.argv[argIndex + 1]?.toLowerCase === 'true' ||
				process.argv[argIndex + 1]?.toLowerCase === 'false'
			) {
				runOnStart = process.argv[++argIndex].toLowerCase() === 'true';
			} else {
				runOnStart = true;
			}
			break;
		case '--subdir':
			if (
				process.argv[argIndex + 1]?.toLowerCase === 'true' ||
				process.argv[argIndex + 1]?.toLowerCase === 'false'
			) {
				checkSubDirs = process.argv[++argIndex].toLowerCase() === 'true';
			}
			break;
		case '-h':
		case '--help':
			console.log('Usage: vala-meson-watcher [options]');
			console.log('Options:');
			console.log('-d, --dir <path>        Directory to watch for changes');
			console.log('-m, --meson <path>      Path to meson.build file');
			console.log(
				'-i, --include <ext>     File extensions to include in meson.build'
			);
			console.log('--ros                   Run on start');
			console.log('-v, --version           Print version');
			console.log('-h, --help              Display this help message');
			return;
			break;
		case '-v':
		case '--version':
			console.log('vala-meson-watcher v0.1.0');
			return;
			break;
		default:
			console.error('Unknown argument: ' + arg);
			break;
	}
	argIndex++;
}

if (!fs.existsSync(mesonFilePath)) {
	console.error('Meson build file not found');
	return;
}

addWatcher(dir);
getAllFilesFromDir(dir || './src');
if (runOnStart) updateMeson();

//watch for changes in the directory
function addWatcher(path) {
	console.log('Watching: ' + path);
	let watcher = fs.watch(path || './src', (eventType, filename) => {
		console.log(`${eventType} event occurred on ${filename}`);
		getAllFilesFromDir(path || './src');
		updateMeson();
	});
	fileWatchers.set(path, watcher);
}

function stripPrefix(str) {
	if (str.startsWith('/')) {
		return str.substring(1);
	} else if (str.startsWith('./')) {
		return str.substring(2);
	} else {
		return str;
	}
}

function fileStructureToString() {
	let str = '';
	for (let [key, value] of fileStructure) {
		let formattedKey = "'" + stripPrefix(key).replace(/\//g, "' / '") + "'";
		for (let i = 0; i < value.length; i++) {
			str += formattedKey + ' / ' + `'${value[i]}'` + ',\n';
		}
	}
	return str;
}

function updateMeson() {
	let mesonBuildFile = fs.readFileSync(mesonFilePath, 'utf8');
	let anchorTop = mesonBuildFile.indexOf('#vmw-anchor-top');
	let anchorBottom = mesonBuildFile.indexOf('#vmw-anchor-bottom');

	if (anchorTop === -1 || anchorBottom === -1) {
		console.error('Meson build file does not contain anchor');
		return;
	}
	//remove everything between the top & bottom anchor
	let mesonBuildFileWithoutAnchor =
		mesonBuildFile.slice(0, anchorTop + '#vmw-anchor-top'.length) +
		mesonBuildFile.slice(anchorBottom);
	//add the new files between the top & bottom anchor
	let fileString = fileStructureToString();

	anchorTop = mesonBuildFileWithoutAnchor.indexOf('#vmw-anchor-top');
	anchorBottom = mesonBuildFileWithoutAnchor.indexOf('#vmw-anchor-bottom');

	let mesonBuildFileWithNewFiles =
		mesonBuildFileWithoutAnchor.slice(0, anchorTop + '#vmw-anchor-top'.length) +
		'\n' +
		fileString +
		mesonBuildFileWithoutAnchor.slice(anchorBottom);

	fs.writeFileSync('./meson.build', mesonBuildFileWithNewFiles);
}

function getAllFilesFromDir(path) {
	fileStructure.set(path, []);
	const filesInDir = () => {
		files = fs.readdirSync(path, { withFileTypes: true });
		files.forEach((file) => {
			if (
				file.isDirectory() &&
				checkSubDirs &&
				!fileWatchers.has(path + '/' + file.name)
			) {
				addWatcher(path + '/' + file.name);
				getAllFilesFromDir(path + '/' + file.name);
			} else {
				if (includeExtensions.includes('.' + file.name.split('.').pop())) {
					fileStructure.get(path).push(file.name);
				}
			}
		});
	};
	filesInDir();
}

//cleanup watch on close
process.on('SIGINT', () => {
	console.log('Closing...');
	fileWatchers.forEach((watcher, path) => {
		console.log('Closing watcher: ' + path);
		watcher.close();
	});
	process.exit();
});
