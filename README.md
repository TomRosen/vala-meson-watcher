# vala-meson-watcher

A tool that automatically looks for source files in a directory and adds them as sources to the `meson.build` file.

<!--toc:start-->

- [vala-meson-watcher](#vala-meson-watcher)
  - [Installation](#installation)
  - [Build from source](#build-from-source)
  - [Usage](#usage)
  - [Options](#options)
  - [Requirements](#requirements)
  - [Examples](#examples)
  - [Note](#note)
  <!--toc:end-->

## Installation

Run `npx vala-meson-watcher` to run the tool.

## Build from source

Run `npm run build` to build the TypeScript source code into JavaScript.\
Make sure you have TypeScript installed globally (`npm i -g typescript`).\
Run `npm install -g` to install the tool globally on your system.

## Usage

```
vala-meson-watcher [options]
```

## Options

- `-d, --dir <path>`: Directory to watch for changes. Default `./src`
- `-m, --meson <path>`: Path to meson.build file. Default `./meson.build`
- `-i, --include <ext>`: File extensions to include in meson.build (extensions must start with a dot). Default `.vala`
- `--ros`: Change sources in Meson file when starting the tool. Default: `false`
- `--subdir`: Include subdirectories. Default `true`
- `--log`: Enable logging. Default: `true`
- `-v, --version`: Print version
- `-h, --help`: Display this help message

## Requirements

- meson build file must have a `#vmw-anchor-top` and `#vmw-anchor-bottom` for the tool to know where to insert the sources
- nodejs runtime

## Examples

```
vala-meson-watcher -d /path/to/src -m /path/to/meson.build -i .vala,.c
```

This command will watch the directory `/path/to/src` for changes, and when it detects changes it will add the new files to the meson build file located at `/path/to/meson.build`. It will only include files with extensions `.vala` and `.c`.

```
vala-meson-watcher --ros
```

This command will watch the default directory `./src` for changes, and when it detects changes it will add the new files to the default meson build file located at `./meson.build`. It will include files with the `.vala` extensions by default.

## Note

- This tool is designed to work with vala projects, but it can also be used with other projects with the correct configuration.
- The script uses the `fs.watch` method of the `fs` module, which is not supported on all platforms.
