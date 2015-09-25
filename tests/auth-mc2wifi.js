var assert = require('assert');
var fs = require('fs');

var MC2Wifi = require(__dirname + '/../scripts/auth/mc2wifi.js');
var auth = new MC2Wifi({
	username: 'mt15a000',
	password: 'test',
	userAgent: 'odenwlan-node/test',
	isDebug: true
});

describe('_isAuthPageContent', function() {

	it('Detecting authentication page - Shijonawate', function () {

		// Read a sample html
		var content = fs.readFileSync(__dirname + '/samples/auth-sjn.html', {
			encoding: 'utf-8'
		});
		// Check it
		assert.equal(auth._isAuthPageContent(content), true);

	});

});
