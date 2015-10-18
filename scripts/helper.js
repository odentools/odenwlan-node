var BrowserWindow = require('browser-window'), Logger = require('./logger');

/**
 * An helper which include static methods
 */
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
		browser_windows.worker.loadUrl('file://' + __dirname + '/../pages/online-detector.html');
	},

	/**
		Initialize the about window
		@param browser_windows	Associative array of BrowserWindow
	**/
	initAboutWindow: function(browser_windows) {
		if (browser_windows.about != null) {
			browser_windows.about.loadUrl('file://' + __dirname + '/../pages/about.html');
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
		browser_windows.about.loadUrl('file://' + __dirname + '/../pages/about.html');
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
			browser_windows.pref.loadUrl('file://' + __dirname + '/../pages/preferences.html');
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
		browser_windows.pref.loadUrl('file://' + __dirname + '/../pages/preferences.html');
	},

	/**
		Show the preferences window
		@param browser_windows	Associative array of BrowserWindow
	**/
	showPrefWindow: function(browser_windows) {
		this.initPrefWindow(browser_windows);
		browser_windows.pref.show();
	},

	/**
		Initialize the logger window
		@param browser_windows	Associative array of BrowserWindow
	**/
	initLoggerWindow: function(browser_windows) {
		if (browser_windows.logger != null) {
			browser_windows.logger.loadUrl('file://' + __dirname + '/../pages/logger.html');
			return;
		}

		// Make the logger window
		browser_windows.logger = new BrowserWindow({
			width: 800,
			height: 600,
			show: false
		});
		browser_windows.logger.setMenu(null);
		browser_windows.logger.on('closed', function() {
			browser_windows.logger = null;
		});
		browser_windows.logger.loadUrl('file://' + __dirname + '/../pages/logger.html');
	},

	/**
		Show the logger window
		@param browser_windows	Associative array of BrowserWindow
		@param logger_instance	Logger instance
	**/
	showLoggerWindow: function(browser_windows, logger_instance) {
		this.initLoggerWindow(browser_windows);
		browser_windows.logger.show();
		setTimeout(function() {
			browser_windows.logger.webContents.send('send-logs', logger_instance.getLogs());
		}, 500);
	},

	/**
		Save a value to preference (localStorage)
		@param browser_windows	Associative array of BrowserWindow
		@param key		Key of item
		@param value 	Value of item
	**/
	savePref: function(browser_windows, key, value) {
		var self = this;

		if (browser_windows.pref == null) {
			console.log('[WARN] Helper - savePref - browser_windows.pref is null!');
			return;
		}

		if (self.objectTypeIs(value, 'Number')) {
			browser_windows.pref.webContents.executeJavaScript('savePreference(\"' + key + '\", ' + value + ', true);');
		} else if (self.objectTypeIs(value, 'String')) {
			browser_windows.pref.webContents.executeJavaScript('savePreference(\"' + key + '\", \"' + value + '\", true);');
		} else {
			console.log('[ERROR] Helper - savePref - Unsupported value type: ' + value);
			throw 'Helper - savePref - Unsupported value type';
		}
	},

	/**
		Check the object type
	**/
	objectTypeIs: function(obj, type) {
		// Thanks: http://qiita.com/Layzie/items/465e715dae14e2f601de
		var clas = Object.prototype.toString.call(obj).slice(8, -1);
		return obj !== undefined && obj !== null && clas === type;
	},

	/**
		Check whether there is newer version and download it
		@param updater Instance of Updater
	**/
	execAutoUpdate: function(updater) {
		var self = this;

		var mLogger = Logger.getInstance();

		if (updater == null) {
			mLogger.wlog('helper/execAutoUpdate', 'updater is null!');
			return;
		}

		// Check whether there is newer version and update myself
		updater.checkAndUpdate(function(is_successful, is_available, version_str, error_str) {
			if (error_str) {
				mLogger.elog('helper/execAutoUpdate', 'Update check failed: ' + error_str);
			} else if (is_successful && is_available) {
				mLogger.ilog('helper/execAutoUpdate', 'Update successful: v' + version_str);
			} else if (!is_available) {
				mLogger.ilog('helper/execAutoUpdate', 'Update successful: v' + version_str + ' (already latest)');
			}
		});
	},

	/**
		Restart the application
	**/
	restartApp: function() {

		var app = require('app'),
			child_process = require('child_process'),
			mLogger = Logger.getInstance();

		// Get the command and parameters of myself
		var argv = process.argv.concat(); // Copy the arguments array
		var cmd = argv.shift();

		// Start the new app
		mLogger.dlog('helper/restartApp', 'Start the cmd: ' + cmd);
		var child = null;
		try {
			child = child_process.spawn(cmd, argv, {
				detached: true,
				stdio: [ 'ignore', 'ignore', 'ignore' ]
			});
			child.unref();
		} catch (e) {
			mLogger.elog('helper/restartApp', e.toString());
			return;
		}

		// Quit myself
		var timer = setTimeout(function() {
			process.exit(0);
		}, 1000);

	}

};
