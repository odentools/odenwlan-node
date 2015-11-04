/**
 * odenwlan-node
 * ---------------
 * Released under MIT License by OdenTools Project.
 * https://github.com/odentools/odenwlan-node/
 */
'use strict';

// Make an instance of the application
var app = require('app');

// Load modules for desktop environments
var BrowserWindow = require('browser-window');

// Load helper module
var Helper = require(__dirname + '/scripts/helper'); // It include static methods

// Const values
var STATUS_CHECK_INTERVAL = 2000; 			// Status checking works every 2 seconds
var STATUS_CHECK_LOOP_TIMEOUT = 60000;		// 1 minutes after connection changed
var LOGIN_RETRY_COUNT_LIMIT = 8;			// Retry count limit for login

// Instances
var ipc = require('ipc'); 	// IPC module
var mAuth = null;			// Authentication module
var mUpdater = null;		// Updater module for auto updating of app
var isDevMode = false;		// Development mode
var isOnline = null;		// Connection status
var conChangedAt = -1;		// Epoch-time that connection has been changed (It will reset sometime )
var loginRetryCount = 0;	// Failed count of login processing
var appTray = null;			// Tray icon
var browserWindows = {		// Instances of Browser Window
	about: null,			// About window
	pref: null,				// Preferences window
	worker: null,			// Hidden window for the online detection
};

// Start logging
var mLogger = require('onmem-logger').getInstance();
mLogger.debug('main', 'App has been started.');

// Check for whether a own is development version
process.argv.forEach(function(element, index, array) {
	if (element.match(/^--env=(.+)$/) && RegExp.$1 == 'development') {
		isDevMode = true;
		mLogger.info('main', 'Detected the development environment!'
			+ ' -- Debug logging is enabled and Updater is dry-run mode.');
	}
});

// Set a catcher for uncaught exceptions
process.on('uncaughtException', function (error) {
	mLogger.error('main', 'An uncaught exception occured!\n' + error.stack);
	if (!isDevMode && Helper) Helper.restartApp();
});

// Read a manifest of the app
var manifest = require('./package.json');

// Do self test if needed
require('electron-updater-gh-releases').doSelfTestIfNeeded();

// Don't exit the app when the window closed
app.on('window-all-closed', function() {
	return false;
});

// This method will be called when Electron has done initialization
app.on('ready', function() {

	// Initialize a tray icon
	appTray = Helper.initTrayIcon(app, manifest, browserWindows, mLogger);
	appTray.on('clicked', function() {
		// Reset variables in order to login immediately
		conChangedAt = new Date().getTime();
		loginRetryCount = 0;
	});

	// Check the current preferences
	ipc.on('fetch-preferences', function(event, args) {

		mLogger.debug('main/IPC.on', 'fetch-preferences');

		if (args.loginId == null || args.loginPw == null) {
			// First setup
			require('dialog').showMessageBox(null, {
				type: 'info',
				title: 'Welcome to odenwlan-node',
				message: 'Thanks for installing :)\nPlease input your MC2-account id and password.',
				buttons: ['OK']
			});
			Helper.showPrefWindow(browserWindows);
		} else {
			// Debug logging
			var is_debug_logging = isDevMode || args.isDebug || false;
			if (is_debug_logging) {
				var debug_str = '';
				for (var key in args) {
					if (debug_str.length != 0) debug_str = debug_str + '\n';
					debug_str += key + ' = ' + args[key];
				}
				mLogger.debug('main', 'Debug mode is enabled; Preferences: \n' + debug_str);
			}

			// Initialize an instance of the authentication module
			mAuth = Helper.initAuthModule(args, manifest, is_debug_logging);

			// Initialize an instance of the updater module
			mUpdater = Helper.initUpdaterModule(args, manifest, browserWindows, is_debug_logging, isDevMode);

			// Clear a failed count
			loginRetryCount = 0;
		}

	});

	Helper.initPrefWindow(browserWindows);
	var is_init_load_preferences = false;

	browserWindows.pref.webContents.on('did-finish-load', function() {

		if (!is_init_load_preferences) {
			is_init_load_preferences = true;
			browserWindows.pref.webContents.executeJavaScript('sendPreferencesToMainProcess();');
		}

	});

	// Make a worker browser for the online detection
	ipc.on('online-status-changed', function(event, args) {
		mLogger.debug('main/IPC.on', 'online-status-changed - ' + args.isOnline);
		if (isOnline == null || args.isOnline != isOnline) { // Changed to online
			// Set a now time to the connection changed time
			conChangedAt = new Date().getTime();
			// Clear a failed count
			loginRetryCount = 0;
		}
		isOnline = args.isOnline;
	});
	Helper.initWorkerBrowser(browserWindows);

	// Start a timer for the status checking
	var is_processing = false;
	setInterval(function(){

		var now = new Date();
		if (mAuth == null || isOnline == null || !isOnline || LOGIN_RETRY_COUNT_LIMIT <= loginRetryCount) {
			// Change the status to offline
			appTray.setImage(__dirname + '/images/icon_tray_offline.png');
			if (LOGIN_RETRY_COUNT_LIMIT <= loginRetryCount) { // Reached retry limit
				appTray.setToolTip('odenwlan-node : Reached retry limit');
			} else {
				appTray.setToolTip('odenwlan-node : Offline');
			}
			return;

		} else if (conChangedAt == -1) {
			return;

		} else if (conChangedAt < now.getTime() - STATUS_CHECK_LOOP_TIMEOUT) {
			// Change the status to offline
			appTray.setImage(__dirname + '/images/icon_tray_offline.png');
			appTray.setToolTip('odenwlan-node : Check loop was timeouted');
			return;

		}

		if (is_processing) { // If In progress
			// Tray icon animation
			var n = now.getSeconds() % 4;
			if (n == 0 || n == 1) {
				appTray.setImage(__dirname + '/images/icon_tray_wait_a.png');
			} else {
				appTray.setImage(__dirname + '/images/icon_tray_wait_b.png');
			}

			// Wait for progress
			return;
		}

		// Status check
		is_processing = true;
		mLogger.info('main/checkLoop', 'Checking for login status');
		appTray.setToolTip('odenwlan-node : Checking...');
		appTray.setImage(__dirname + '/images/icon_tray_wait_a.png'); // Change the icon to waiting
		try {
			mAuth.checkLoginStatus(function(login_status) {

				if (login_status == null) { // It is offline or may be now connecting
					mLogger.info('main/checkLoop', 'Status: Offline :(');
					is_processing = false;
					return;
				}

				if (!login_status) {
					mLogger.info('main/checkLoop', 'Status: Not logged in :(');

					// Login
					mLogger.info('main/checkLoop', 'Trying to login (' + loginRetryCount + ')');
					appTray.setToolTip('odenwlan-node : Trying to login...');
					mAuth.login(function(is_successful, error_text) {

						if (is_successful) { // Authentication was successful

							mLogger.info('main/checkLoop', 'Authentication result: Successful');

							// Clear the retry count
							loginRetryCount = 0;
							// Change the status to online
							appTray.setImage(__dirname + '/images/icon_tray_online.png');
							appTray.setToolTip('odenwlan-node : Online (Login was successful)');

							// Check whether there is newer version and download it
							Helper.execAutoUpdate(mUpdater);

						} else if (error_text.match(/INVALID_AUTH/)) { // Autentication was failed

							mLogger.info('main/checkLoop', 'Authentication result: Failed; Invalid id or password');

							// Don't retry
							loginRetryCount = LOGIN_RETRY_COUNT_LIMIT;
							// Show a message
							require('dialog').showMessageBox(null, {
								type: 'info',
								title: 'Authenticate was failed',
								message: 'Authenticate was failed.\nPlease check your MC2-account id and password.',
								buttons: ['OK']
							});

						} else { // Other error (e.g. Network error)

							// Show the error message
							if (error_text != null) {
								mLogger.info('main/checkLoop', 'Authentication result: Failed - ' + error_text);
							} else {
								mLogger.info('main/checkLoop', 'Authentication result: Failed');
							}

							// Increment the retry count
							loginRetryCount++;
							// Change the status to offline
							appTray.setImage(__dirname + '/images/icon_tray_offline.png');
							appTray.setToolTip('odenwlan-node : Offline (Login was failed)');

						}

						// Processing was done
						is_processing = false;

					});

				} else {
					mLogger.info('main/checkLoop', 'Status: Online on any network :)');

					// Clear a failed count
					loginRetryCount = 0;
					// Change the status to online
					appTray.setImage(__dirname + '/images/icon_tray_online.png');
					appTray.setToolTip('odenwlan-node : Online');
					// Clear the connection changed time
					conChangedAt = -1;
					// Processing was done
					is_processing = false;

					// Check whether there is newer version and download it
					Helper.execAutoUpdate(mUpdater);

				}
			});

		} catch (e) {
			mLogger.debug('main/checkLoop', e.toString());
			is_processing = false;
		}

	}, STATUS_CHECK_INTERVAL);

});
