var BrowserWindow = require('browser-window');
var request = require('request');

module.exports = {

	/**
		Initialize the hidden window for worker
		@param browser_windows	Associative array of BrowserWindow
	**/
	initWorkerBrowser: function(browser_windows) {
		if (browser_windows.worker != null) {
			return;
		}

		// Make the hidden window
		browser_windows.worker = new BrowserWindow({
			width: 640,
			height: 480,
			show: false
		});
		browser_windows.worker.loadUrl('file://' + __dirname + '/../page/online-detector.html');
	},

	/**
		Initialize the about window
		@param browser_windows	Associative array of BrowserWindow
	**/
	initAboutWindow: function(browser_windows) {
		if (browser_windows.about != null) {
			browser_windows.about.loadUrl('file://' + __dirname + '/../page/about.html');
			return;
		}

		// Make the about window
		browser_windows.about = new BrowserWindow({
			width: 640,
			height: 480,
			show: false
		});
		browser_windows.about.setMenu(null);
		browser_windows.about.on('closed', function() {
			browser_windows.about = null;
		});
		browser_windows.about.loadUrl('file://' + __dirname + '/../page/about.html');
	},

	/**
		Show the about window
		@param browser_windows	Associative array of BrowserWindow
	**/
	showAboutWindow: function(browser_windows) {
		this.initAboutWindow(browser_windows);
		browser_windows.about.show();
	},

	/**
		Initialize the preferences window
		@param browser_windows	Associative array of BrowserWindow
	**/
	initPrefWindow: function(browser_windows) {
		if (browser_windows.pref != null) {
			browser_windows.pref.loadUrl('file://' + __dirname + '/../page/preferences.html');
			return;
		}

		// Make the preferences window
		browser_windows.pref = new BrowserWindow({
			width: 640,
			height: 480,
			show: false
		});
		browser_windows.pref.setMenu(null);
		browser_windows.pref.on('closed', function() {
			browser_windows.pref = null;
		});
		browser_windows.pref.loadUrl('file://' + __dirname + '/../page/preferences.html');
	},

	/**
		Show the preferences window
		@param browser_windows	Associative array of BrowserWindow
	**/
	showPrefWindow: function(browser_windows) {
		this.initPrefWindow(browser_windows);
		browser_windows.pref.show();
	}
};
