var BrowserWindow = require('browser-window');

module.exports = {

	// Initialize the hidden window for worker
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

	// Initialize the about window
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

	// Show the about window
	showAboutWindow: function(browser_windows) {
		this.initAboutWindow(browser_windows);
		browser_windows.about.show();
	},

	// Initialize the preferences window
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

	// Show the preferences window
	showPrefWindow: function(browser_windows) {
		this.initPrefWindow(browser_windows);
		browser_windows.pref.show();
	}
};
