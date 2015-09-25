var assert = require('assert');
var child_process = require('child_process');

describe('Basic test', function() {

	it('Launch under self testing mode', function (done) {

		try {
			// Execute the app under the self testing mode.
			// Note: That mode is provided by Updater.doSelfTestIfNeeded() in main.js.
			child_process.execSync(__dirname + '/../node_modules/.bin/electron ' + __dirname + '/../main.js --upd-self-test');
			done(); // Successful
		} catch (e) {
			throw e; // Failed
		}

	});

});
