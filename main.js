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
var appAuthProc = null;		// Authentication process
var appTray = null;			// Tray icon
var appPreferences = null;	// Preferences of app
var appUpdater = null;		// Updater module for auto updating of app
var browserWindows = {		// Instances of Browser Window
	about: null,			// About window
	pref: null,				// Preferences window
	worker: null,			// Hidden window for the online detection
};
var conChangedAt = -1;		// Epoch-time that connection has been changed (It will reset sometime )
var isDevMode = false;		// Development mode
var isOnline = null;		// Connection status
var isProcessing = false;	// Processing flag of main loop
var loginRetryCount = 0;	// Failed count of login processing

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

// Read a mManifest of the app
var mManifest = require('./package.json');

// Do self test if needed
require('electron-updater-gh-releases').doSelfTestIfNeeded();

// Don't exit the app when the window closed
app.on('window-all-closed', function() {
	return false;
});

// This method will be called when Electron has done initialization
app.on('ready', function() {

	// Initialize a tray icon
	appTray = Helper.initTrayIcon(app, mManifest, browserWindows, mLogger);
	appTray.on('clicked', function() {
		// Reset variables in order to login immediately
		conChangedAt = new Date().getTime();
		loginRetryCount = 0;
	});

	// Initialization of handlers for events which occurs from authentication module
	var initAuthProcessReceivers = function () {

		appAuthProc.on('message', function (msg) {

			if (msg.cmd == null || msg.cmd.indexOf('NODE_') != -1) return;

			mLogger.debug('main/checkLoop', 'Incoming message: ' + msg.cmd);

			try {

				if (msg.cmd == 'checkLoginStatus') { // Response of checkLoginStatus command

					if (msg.errorText != null) {
						mLogger.debug('main/checkLoop', msg.errorText);
						isProcessing = false;
						return;
					}

					var login_status = msg.loginStatus;
					if (login_status == null) { // It is offline or may be now connecting
						mLogger.info('main/checkLoop', 'Status: Offline :(');
						isProcessing = false;
						return;
					}

					if (login_status) { // Already online
						mLogger.info('main/checkLoop', 'Status: Online on any network :)');

						// Clear a failed count
						loginRetryCount = 0;
						// Change the status to online
						appTray.setImage(__dirname + '/images/icon_tray_online.png');
						appTray.setToolTip('odenwlan-node : Online');
						// Clear the connection changed time
						conChangedAt = -1;
						// Processing was done
						isProcessing = false;

						// Check whether there is newer version and download it
						Helper.execAutoUpdate(appUpdater);

						// Done
						return;
					}

					mLogger.info('main/checkLoop', 'Status: Not logged in :(');

					// Login
					mLogger.info('main/checkLoop', 'Trying to login (' + loginRetryCount + ')');
					appTray.setToolTip('odenwlan-node : Trying to login...');
					appAuthProc.send({ cmd: 'login' });

				} else if (msg.cmd == 'login') { // Response of login command

					var is_successful = msg.isSuccessful || false;
					var error_text = msg.errorText || null;

					if (is_successful) { // Authentication was successful

						mLogger.info('main/checkLoop', 'Authentication result: Successful');

						// Clear the retry count
						loginRetryCount = 0;
						// Change the status to online
						appTray.setImage(__dirname + '/images/icon_tray_online.png');
						appTray.setToolTip('odenwlan-node : Online (Login was successful)');

						// Check whether there is newer version and download it
						Helper.execAutoUpdate(appUpdater);

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

				}

			} catch (e) {
				mLogger.error('main/checkLoop', e);
			}

			// Processing was done
			isProcessing = false;

		});

	};

	// Check the current preferences
	ipc.on('fetch-preferences', function(event, args) {

		mLogger.debug('main/IPC.on', 'fetch-preferences');

		appPreferences = args;

		if (appPreferences.loginId == null || appPreferences.loginPw == null) {
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
			var is_debug_logging = isDevMode || appPreferences.isDebug || false;
			if (is_debug_logging) {
				var debug_str = '';
				for (var key in appPreferences) {
					if (debug_str.length != 0) debug_str = debug_str + '\n';
					debug_str += key + ' = ' + appPreferences[key];
				}
				mLogger.debug('main', 'Debug mode is enabled; Preferences: \n' + debug_str);
			}

			// Applying automatic launch
			if (!isDevMode) {
				Helper.applyAutoLaunch(appPreferences.isAutoLaunch || false);
			}

			// Initialize the authentication process
			if (appAuthProc != null) appAuthProc.kill('SIGHUP');
			appAuthProc = Helper.initAuthProcess(appPreferences, mManifest, is_debug_logging);
			initAuthProcessReceivers();

			// Initialize an instance of the updater module
			appUpdater = Helper.initUpdaterModule(args, mManifest, browserWindows, is_debug_logging, isDevMode);

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
		if (args.isOnline && appPreferences != null) {
			// Initialize the authentication process
			var is_debug_logging = isDevMode || appPreferences.isDebug || false;
			if (appAuthProc != null) appAuthProc.kill('SIGHUP');
			appAuthProc = Helper.initAuthProcess(appPreferences, mManifest, is_debug_logging);
			initAuthProcessReceivers();
		}
		isOnline = args.isOnline;
	});
	Helper.initWorkerBrowser(browserWindows);

	// Monitor the resume from resume
	/*require('power-monitor').on('resume', function () {

		mLogger.info('main', 'Resume from suspend state');
		if (appPreferences != null) {
			// Set a now time to the connection changed time
			conChangedAt = new Date().getTime();
			// Clear a failed count
			loginRetryCount = 0;
			// Initialize the authentication process
			var is_debug_logging = isDevMode || appPreferences.isDebug || false;
			if (appAuthProc != null) appAuthProc.kill('SIGHUP');
			appAuthProc = Helper.initAuthProcess(appPreferences, mManifest, is_debug_logging);
			initAuthProcessReceivers();

	});*/

	// Start a timer for the status checking
	setInterval(function(){

		var now = new Date();
		if (appAuthProc == null || isOnline == null || !isOnline || LOGIN_RETRY_COUNT_LIMIT <= loginRetryCount) {
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

		if (isProcessing) { // If In progress
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
		isProcessing = true;
		mLogger.info('main/checkLoop', 'Checking for login status');
		appTray.setToolTip('odenwlan-node : Checking...');
		appTray.setImage(__dirname + '/images/icon_tray_wait_a.png'); // Change the icon to waiting
		appAuthProc.send({ cmd: 'checkLoginStatus' });

	}, STATUS_CHECK_INTERVAL);

});
