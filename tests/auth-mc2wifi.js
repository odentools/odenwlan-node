var assert = require('assert');
var fs = require('fs');

var MC2Wifi = require(__dirname + '/../scripts/auth/mc2wifi.js');
var auth = new MC2Wifi({
	username: 'mt15a000',
	password: 'test',
	userAgent: 'odenwlan-node/test',
	isDebug: true
});

describe('_getAuthSubmitBaseUrlByRedirectedUrl', function() {

	it('Detecting authentication redirect url - Shijonawate-A', function () {

		assert.equal(auth._getAuthSubmitBaseUrlByRedirectedUrl('http://mcwlct1s.mc2ed.sjn.osakac.ac.jp/user/index.jsp'), 'https://mcwlct1s.mc2ed.sjn.osakac.ac.jp:9998');

	});

	it('Detecting authentication redirect url - Shijonawate-B', function () {

		assert.equal(auth._getAuthSubmitBaseUrlByRedirectedUrl('http://mcwlct2s.mc2ed.sjn.osakac.ac.jp/user/index.jsp'), 'https://mcwlct2s.mc2ed.sjn.osakac.ac.jp:9998');

	});

	it('Detecting authentication redirect url - Invalid', function () {

		// Check it
		assert.equal(auth._getAuthSubmitBaseUrlByRedirectedUrl('http://example.com/'), null);

	});

});
