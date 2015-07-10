var path = require('path');

/**
	Client object
**/
var Client = function(options) {

	// Read options
	this.username = options.username;
	this.password = options.password;

	// Proxy url
	this.httpProxy = 'http://172.25.250.41:8080/';
	this.httpsProxy = 'http://172.25.250.41:8080/';

	// Certificate files
	this.isCertCheck = false;
	this.certFiles = [
		'file://' + __dirname + '/../../cert/mcwlct1s.mc2ed.sjn.osakac.ac.jp.pem'
	];

	// Debug module
	this.isDebug = true;

};

/**
	Login to the network
	@param callback	Callback function: function(is_successful, [error_text])
**/
Client.prototype.login = function(callback) {
	var http = require('http');
	var client = this;

	// 1st request - GET for redirect to authentication-page
	var url = 'http://osakac.ac.jp/';
	this._dlog('login - GET: ' + url);
	http.get(url, function (res) { // When the 1st request was completed
		if (res.statusCode == 301 || res.statusCode == 302) { // Redirect
			var redirect_url = res.headers.location;

			// Go to 2nd request - POST for authentication with validation by certificate
			client._loginSecondRequest(redirect_url, callback);

		} else if (res.statusCode == 200) { // 1st request was successful; but not redirect
			callback(false, '1st request was successful; not redirect'); // May be already logged-in

		} else { // 1st request was failed
			callback(false, '1st request was failed');

		}

	});
};

/**
	2nd request for login
	(Processing for URL of Authentication-page that got by access to any web-page)
	@param url Request URL
	@param callback	Callback function: function(is_successful, [error_text])
**/
Client.prototype._loginSecondRequest = function(url, callback) {
	var self = this;

	// Get the sip parameter
	var base_url = null;
	var cert_file = null;
	if (url.match(/mcwlct1s\.mc2ed\.sjn\.osakac\.ac\.jp/)) {
		base_url = 'https://mcwlct1s.mc2ed.sjn.osakac.ac.jp:9998';
		cert_file = 'mcwlct1s.mc2ed.sjn.osakac.ac.jp.pem';
	} else {
		// Abort
		callback(false, 'Unknown 2nd URL: ' + url);
		return;
	}

	// Set a certificate for validate the authentication page
	var cert = null;
	if (self.isCertCheck && cert_file != null) {
		self._dlog('login - Load certificate: ' + cert_file);
		cert = require('fs').readFileSync(path.resolve(__dirname, '../../cert/' + cert_file));
	} else {
		self._dlog('login - Not load certificate');
	}

	// 2nd request - POST for authentication with validation by certificate
	self._dlog('login - POST: ' + base_url + '/login');
	var request = require('request');
	request.post({
		'url': base_url + '/login',
		'ca': cert,
		'followRedirect': false,
		'followAllRedirects': false,
		'rejectUnauthorized': true,
		'form': {
			'username': this.username,
			'password': this.password,
			'submit': 'Login'
		}
	}, function(err, res, body) { // When the 2st request was completed

		if (!err && (res.statusCode == 301 || res.statusCode == 302)) { // HTTP Redirect
			var redirect_url = res.headers.location;
			self._dlog('login - Detect HTTP Redirect: ' + redirect_url);

			// Go to 3rd request - Redirect-loop after authentication
			self._requestRedirectLoop(redirect_url, base_url, callback, 0);

		} else if (!err && res.statusCode == 200) {
			// Processing included resources
			self._requestIncludeResources(body, base_url);
			// Processing JavaScript code
			var redirect_url = self._getJsRedirectUrl(body, base_url);
			if (redirect_url != null) {
				// Go to 3rd request - Redirect-loop after authentication
				self._requestRedirectLoop(redirect_url, base_url, callback, 0);
			} else {
				self._dlog(body);
				callback(false, '2nd request was success ful; but not redirect');
			}

		} else { // 2nd request was failed
			callback(false, '2nd request was failed: ' + err);
		}

	});

};

/**
	Processing for redirect-loops (includes HTTP & JavaScript Redirect)
	@param url Request URL
	@param base_url Base URL for the redirect by relative path
	@param callback	Callback function: function(is_successful, [error_text])
**/
Client.prototype._requestRedirectLoop = function(url, base_url, callback, count) {
	var self = this;

	if (count == null) {
		count = 0;
	} else if (10 < count) {
		callback('Reached redirect count limit', null, null);
		return;
	}

	// Request
	var request = require('request');
	self._dlog('_requestRedirectLoop - GET(' + count + '): ' + url);
	request.get({
		'url': url,
		'followRedirect': false,
		'followAllRedirects': false
	}, function (err, res, body) {
		console.log(body);

		var redirect_url = null;
		if (!err && res.statusCode == 301 || res.statusCode == 302) { // HTTP Redirect
			redirect_url = res.headers.location;
			self._dlog('_requestRedirectLoop - Detect HTTP Redirect: ' + redirect_url);
		} else if (!err && res.statusCode == 200) {
			// Processing included resources
			self._requestIncludeResources(body, base_url);
			// Processing JavaScript code
			redirect_url = self._getJsRedirectUrl(body, base_url);
		}

		if (redirect_url == null) {
			if (res.statusCode == 200) {
				callback(true);
			} else {
				callback(false, err);
			}
		} else if (redirect_url.match(/auth\=failed/)) {
			callback(false, 'INVALID_AUTH');
		} else {
			self._requestRedirectLoop(redirect_url, base_url, callback, count + 1);
		}

	});
};

/**
	Processing for included resources (such as IMG tag for Web beacon)
	@param body Response Body (HTML code)
	@param base_url Base URL for the redirect by relative path
**/
Client.prototype._requestIncludeResources = function(body, base_url) {
	var img_url = null;
	if (body.match(/img src\=[\"\'](http:\/\/|)([^\"\']+)[\"\']/)) {
		img_url = RegExp.$2;
		if (RegExp.$1 == null || RegExp.$1.length == 0) {
			img_url = base_url + img_url;
		}
	} else if (body.match(/img\.src *\= *[\"\'](http:\/\/|)([^\"\']+)[\"\']/)) {
		img_url = RegExp.$2;
		if (RegExp.$1 == null || RegExp.$1.length == 0) {
			img_url = base_url + img_url;
		}
	}

	if (img_url == null) {
		return;
	}

	this._dlog('_requestIncludeResources - IMG GET: ' + img_url);

	var request = require('request');
	request.get(img_url);
}

/**
	Get a JavaScript Redirect URL from body content
	@param body Response Body
	@param base_url Base URL for the redirect by relative path
**/
Client.prototype._getJsRedirectUrl = function(body, base_url) {
	var redirect_url = null;
	if (body.match(/window\.location\.href\=[\"\'](http\:\/\/[^\'\"]+)[\"\']/)) { // JS Redirect
		redirect_url = RegExp.$1;
		this._dlog('_getJsRedirectUrl - Detect JS Redirect(A): ' + redirect_url);
	} else if (body.match(/window\.location\.href\=[\"\']([^\'\"]+)[\"\']/)) { // JS Redirect
		redirect_url = base_url + RegExp.$1;
		this._dlog('_getJsRedirectUrl - Detect JS Redirect(B): ' + redirect_url);
	}
	return redirect_url;
};

/**
	Check whether the user is logged-in
	@param callback	Callback function: function(is_logged_in)
	is_logged_in = true / false / null
**/
Client.prototype.checkLoginStatus = function(callback) {
	var self = this;

	var request = require('request');
	var now = new Date().getTime();

	// Access to WAN
	request('http://oden.oecu.jp/?client=odenwlan&t=' + now, function(err, res, body) {
		if (!err && res.statusCode == 200) {
			if (body.match(/無線LAN 利用者確認ページ/)) {
				callback(false); // Not logged-in
			} else {
				callback(true); // Logged-in or Connected to other network
			}
		} else { // If could not access to WAN
			self._dlog('Could not access to WAN!');
			// Access to authentication page
			request('http://wlanlogin.mc2ed.sjn.osakac.ac.jp/', function (err, res, body) {
				if (!err && res.statusCode == 200) {
					callback(false); // Not logged-in
				} else { // If could not access to authentication page
					callback(null); // It maybe offline
				}
			});
		}
	});
};

/**
	Output of debugging log
**/
Client.prototype._dlog = function(str) {
	if (this.isDebug) {
		console.log('' + str);
	}
};

module.exports = Client;
