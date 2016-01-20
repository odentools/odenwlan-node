# odenwlan-node
An automatic login tool for Wi-Fi of OECU.
It made with [Electron](http://electron.atom.io/).

This project is so experimental yet.

## Works on multi platforms
* Windows x32/x64
* Linux x32/x64
* Mac OS X x32/x64 (Untested)

# Download
Would you try it now?

Executable binaries for Windows, Linux and Mac OS X can be found on the [releases](https://github.com/odentools/odenwlan-node/releases) page.

# For developers

An result of automated testing for master branch:

[![Build Status](https://travis-ci.org/odentools/odenwlan-node.svg?branch=master)](https://travis-ci.org/odentools/odenwlan-node)

## How to build

Recommend environment:

* GNU/Linux

Required software:

* Node.js v0.12 or compatible version

Please run the following commands on your terminal.

	$ git clone git@github.com:odentools/odenwlan-node.git
	$ cd odenwlan-node/
	$ npm install

Now you can develop it. enjoy!

## Available commands

**Install the dependency libraries:**

	$ npm install

**Run the app:**

	$ npm start

**Run the test:**

	$ npm test

In current version, it executes only syntax check by ESLint.
Also "grunt test" command also run the same.

**Make a distribution package for some platforms:**

	$ grunt

In current version, it makes package for Linux and Windows.

# License

```
The MIT License (MIT).
Copyright (c) 2016 OdenTools Project.
```

Please see [LICENSE](https://github.com/odentools/odenwlan-node/blob/master/LICENSE) for details.
And third party licenses are included to [page/about.html](https://github.com/odentools/odenwlan-node/blob/master/page/about.html). Thank you.
