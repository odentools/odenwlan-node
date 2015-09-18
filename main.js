/**
*	odenwlan-node
*	(C) OdenTools Project
**/
'use strict';

// Make an instance of the application
var app = require('app');

// Load modules for desktop environments
var Menu = require('menu');
var Tray = require('tray');
var BrowserWindow = require('browser-window');

// Const values
var STATUS_CHECK_INTERVAL = 2000; 			// Status checking works every 2 seconds
var STATUS_CHECK_LOOP_TIMEOUT = 60000;		// 1 minutes after connection changed
var LOGIN_RETRY_COUNT_LIMIT = 8;			// Retry count limit for login

// Instances
var ipc = require('ipc'); 		// IPC module
var mHelper = require(__dirname + '/js/helper'); // Helper module
var mAuth = null;			// Authentication module
var isOnline = null;		// Connection status
var conChangedAt = -1;		// Epoch-time that connection has been changed (It will reset sometime )
var loginRetryCount = 0;	// Failed count of login processing
var appTray = null;			// Tray icon
var browserWindows = {		// Instances of Browser Window
	about: null,			// About window
	pref: null,				// Preferences window
	worker: null,			// Hidden window for the online detection
};

// Read a manifest of the app
var manifest = require('./package.json');

// Don't exit the app when the window closed
app.on('window-all-closed', function() {
	return false;
});

// This method will be called when Electron has done initialization
app.on('ready', function() {

	// Make a tray icon
	appTray = new Tray(__dirname + '/img/icon_tray_offline.png');
	var contextMenu = Menu.buildFromTemplate([
		{
			label: 'odenwlan-node v' + manifest.version,
			enabled: false
		},
		{
			label: 'About',
			click: function() {
				mHelper.showAboutWindow(browserWindows);
			}
		},
		{
			type: 'separator'
		},
		{
			label: 'Preferences',
			click: function() {
				mHelper.showPrefWindow(browserWindows);
			}
		},
		{
			label: 'Quit',
			accelerator: 'Command+Q',
			click: function(){
				appTray.destroy();
				app.quit();
			}
		},
	]);
	appTray.setContextMenu(contextMenu);
	appTray.setToolTip('odenwlan-node');
	appTray.on('clicked', function() {
		// Reset variables in order to login immediately
		conChangedAt = new Date().getTime();
		loginRetryCount = 0;
	});

	// Check the current preferences
	ipc.on('fetch-preferences', function(event, args) {
		console.log('IPC Received: fetch-preferences');
		if (args.loginId == null || args.loginPw == null) {
			// First setup
			require('dialog').showMessageBox(null, {
				type: 'info',
				title: 'Welcome to odenwlan-node',
				message: 'Thanks for installing :)\nPlease input your MC2-account id and password.',
				buttons: ['OK']
			});
			mHelper.showPrefWindow(browserWindows);
		} else {
			// Initialize an instance of the authentication module
			var Wifi = require(__dirname + '/js/auth/mc2wifi');
			mAuth = new Wifi({
				'username': args.loginId,
				'password': args.loginPw
			});

			// Clear a failed count
			loginRetryCount = 0;
		}
	});
	mHelper.initPrefWindow(browserWindows);
	var is_init_load_preferences = false;
	browserWindows.pref.webContents.on('did-finish-load', function() {
		if (!is_init_load_preferences) {
			is_init_load_preferences = true;
			browserWindows.pref.webContents.executeJavaScript('sendPreferencesToMainProcess();');
		}
	});

	// Make a browser for the online detection
	ipc.on('online-status-changed', function(event, args) {
		console.log('IPC Received: online-status-changed - ' + args.isOnline);
		if (isOnline == null || args.isOnline != isOnline) { // Changed to online
			// Set a now time to the connection changed time
			conChangedAt = new Date().getTime();
			// Clear a failed count
			loginRetryCount = 0;
		}
		isOnline = args.isOnline;
	});
	mHelper.initWorkerBrowser(browserWindows);

	// Start a timer for the status checking
	var is_processing = false;
	setInterval(function(){

		var now = new Date();
		if (mAuth == null || isOnline == null || !isOnline || LOGIN_RETRY_COUNT_LIMIT <= loginRetryCount) {
			// Change the status to offline
			appTray.setImage(__dirname + '/img/icon_tray_offline.png');
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
			appTray.setImage(__dirname + '/img/icon_tray_offline.png');
			appTray.setToolTip('odenwlan-node : Check loop was timeouted');
			return;

		}

		if (is_processing) { // If In progress
			// Tray icon animation
			var n = now.getSeconds() % 4;
			if (n == 0 || n == 1) {
				appTray.setImage(__dirname + '/img/icon_tray_wait_a.png');
			} else {
				appTray.setImage(__dirname + '/img/icon_tray_wait_b.png');
			}

			// Wait for progress
			return;
		}

		// Status check
		is_processing = true;
		console.log('-- Checking for login status --');
		appTray.setToolTip('odenwlan-node : Checking...');
		appTray.setImage(__dirname + '/img/icon_tray_wait_a.png'); // Change the icon to waiting
		try {
			mAuth.checkLoginStatus(function(login_status) {
				console.log('Login status: ' + login_status);

				if (login_status == null) { // It may be connecting now
					is_processing = false;
					return;
				}

				if (!login_status) {
					// Login
					console.log('-- Trying to login (' + loginRetryCount + ') --');
					appTray.setToolTip('odenwlan-node : Trying to login...');
					mAuth.login(function(is_successful, error_text) {

						if (is_successful) { // Authentication was successful
							// Clear the retry count
							loginRetryCount = 0;
							// Change the status to online
							appTray.setImage(__dirname + '/img/icon_tray_online.png');
							appTray.setToolTip('odenwlan-node : Online (Login was successful)');

						} else if (error_text.match(/INVALID_AUTH/)) { // Autentication was failed
							// Don't retry
							loginRetryCount = LOGIN_RETRY_COUNT_LIMIT;
							// Show a message
							require('dialog').showMessageBox(null, {
								type: 'info',
								title: 'Authentication was failed',
								message: 'Authentication was failed.\nPlease check your MC2-account id and password.',
								buttons: ['OK']
							});

						} else { // Other error (e.g. Network error)
							// Increment the retry count
							loginRetryCount++;
							// Change the status to offline
							appTray.setImage(__dirname + '/img/icon_tray_offline.png');
							appTray.setToolTip('odenwlan-node : Offline (Login was failed)');
							// Show the error message
							if (error_text != null) {
								console.error('[ERROR] ' + error_text);
							}

						}

						console.log('Login result: ' + is_successful);
						// Processing was done
						is_processing = false;

					});

				} else {
					console.log('Already logged-in :)');
					// Clear a failed count
					loginRetryCount = 0;
					// Change the status to online
					appTray.setImage(__dirname + '/img/icon_tray_online.png');
					appTray.setToolTip('odenwlan-node : Online');
					// Clear the connection changed time
					conChangedAt = -1;
					// Processing was done
					is_processing = false;

				}
			});

		} catch (e) {
			console.log('[ERROR] ' + e);
			is_processing = false;
		}

	}, STATUS_CHECK_INTERVAL);
});
