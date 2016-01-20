/**
 * Authentication process
 */

// Get the arguments
var login_id = process.env.LOGIN_ID,
	login_pw = process.env.LOGIN_PW,
	user_agent = process.env.USER_AGENT,
	is_debug = process.env.DEBUG_LOGGING || false;

// Initialize the authentication modules
// TODO: For now, supported only one module.
var AUTH_MODULE_NAMES = ['mc2wifi'];
var mAuthModules = {};
AUTH_MODULE_NAMES.forEach(function (module_name) {

	var Auth = require(__dirname + '/../auth/' + module_name);
	mAuthModules[module_name] = new Auth({
		username: login_id,
		password: login_pw,
		userAgent: user_agent,
		isDebug: is_debug
	});

});

// Make a receiver for incoming message from main process
process.on('message', function (msg) {

	if (msg.cmd == null) {
		return;
	}

	var module_name;

	if (msg.cmd == 'checkLoginStatus') { // checkLoginStatus command
		for (module_name in mAuthModules) {
			mAuthModules[module_name].checkLoginStatus(function (status) {
				// Send a response to the main process
				process.send({
					cmd: msg.cmd,
					loginStatus: status,
					errorText: null
				});
			});
		}
	} else if (msg.cmd == 'login') { // login command
		for (module_name in mAuthModules) {
			mAuthModules[module_name].login(function (is_successful, error_text) {
				// Send a response to the main process
				process.send({
					cmd: msg.cmd,
					isSuccessful: is_successful,
					errorText: error_text
				});
			});
		}
	}

});

process.on('exit', function () {
	return;
});
