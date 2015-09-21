var path = require('path'), Helper = require('../helper');

/**
 * Authentication client module for MC2Wifi and MC2Phone
 * @param  {Object} options Options for module
 * @return {Object}         Instance
 */
var Client = function(options) {

	// Read options
	this.username = options.username;
	this.password = options.password;

	// Proxy url
	this.httpProxy = 'http://172.25.250.41:8080/';
	this.httpsProxy = 'http://172.25.250.41:8080/';

	// WAN connection check url (It must be HTTP page; Don't to HTTPS)
	this.wanOnlineCheckUrl = 'http://odentools.github.io/online/';

	// User-Agent string
	this.userAgent = options.userAgent || 'odenwlan-node';

	// Timeout for request (milisecond)
	this.timeout = 4000;

	// Certificate files for login processing
	this.isCertCheck = false;
	this.certFiles = [
		'file://' + __dirname + '/../../cert/mcwlct1s.mc2ed.sjn.osakac.ac.jp.pem'
	];

	// Debug mode
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
	client._dlog('login - GET: ' + url);
	var req = http.get(url, function (res) { // When the 1st request was completed
		client._dlog('login - Response received for GET');
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
	req.on('error', function(err) { // Error handling for internal error (g.g, dns error)
		client._dlog('login - Internal error occured: ' + err);
		callback(false, '1st request was failed');
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
	var request = self._getRequestModule();
	request({
		method: 'POST',
		url: base_url + '/login',
		ca: cert,
		followRedirect: false,
		followAllRedirects: false,
		rejectUnauthorized: true,
		form: {
			username: self.username,
			password: self.password,
			submit: 'Login'
		},
		timeout: self.timeout
	}, function(err, res, body) { // When the 2st request was completed

		var redirect_url = null;
		self._dlog('login - Response received for POST');

		if (!err && (res.statusCode == 301 || res.statusCode == 302)) { // HTTP Redirect
			redirect_url = res.headers.location;
			self._dlog('login - Detect HTTP Redirect: ' + redirect_url);

			// Go to 3rd request - Redirect-loop after authentication
			self._requestRedirectLoop(redirect_url, base_url, callback, 0);

		} else if (!err && res.statusCode == 200) {
			// Processing included resources
			self._requestIncludeResources(body, base_url);
			// Processing JavaScript code
			redirect_url = self._getJsRedirectUrl(body, base_url);
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
	var request = self._getRequestModule();
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
	var self = this;

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

	self._dlog('_requestIncludeResources - IMG GET: ' + img_url);
	var request = self._getRequestModule();
	request({
		url: img_url,
		timeout: self.timeout,
		proxy: null
	}, function(err, res, body) {
		if (err) {
			self._dlog('_requestIncludeResources - Result: ' + err.toString() + ' (error)');
		} else {
			self._dlog('_requestIncludeResources - Result: ' + res.statusLine);
		}
	});
};


/**
	Get a JavaScript Redirect URL from body content
	@param body Response Body
	@param base_url Base URL for the redirect by relative path
**/
Client.prototype._getJsRedirectUrl = function(body, base_url) {
	var self = this;

	var redirect_url = null;
	if (body.match(/window\.location\.href\=[\"\'](http\:\/\/[^\'\"]+)[\"\']/)) { // JS Redirect
		redirect_url = RegExp.$1;
		self._dlog('_getJsRedirectUrl - Detect JS Redirect(A): ' + redirect_url);
	} else if (body.match(/window\.location\.href\=[\"\']([^\'\"]+)[\"\']/)) { // JS Redirect
		redirect_url = base_url + RegExp.$1;
		self._dlog('_getJsRedirectUrl - Detect JS Redirect(B): ' + redirect_url);
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

	var request = self._getRequestModule();
	var now = new Date().getTime();

	// Access to WAN without proxy
	self._dlog('checkLoginStatus - Trying to access to WAN without proxy...');
	request({
		url: self.wanOnlineCheckUrl + '?action=check-wan-connection&t=' + now,
		headers: {
			'User-Agent': self.userAgent
		},
		timeout: self.timeout,
		proxy: null
	}, function(err, res, body) {

		if (!err && res.statusCode == 200) {
			if (body.match(/無線LAN 利用者確認ページ/)) {
				self._dlog('checkLoginStatus - Could not access to WAN without proxy! (Redirected to auth page)');
				callback(false); // Not logged-in
			} else {
				self._dlog('checkLoginStatus - Okay; Could access to WAN without proxy :)');
				callback(true); // Logged-in to MC2phone or Connected to other network
			}
			return;
		}

		// If could not access to WAN without proxy
		self._dlog('checkLoginStatus - Could not access to WAN without proxy!');
		if (err != null) self._dlog('-- Details: ' + err.toString());

		// Access to WAN with proxy
		self._dlog('checkLoginStatus - Trying to access to WAN with proxy... (' + self.httpProxy + ')');
		request({
			url: self.wanOnlineCheckUrl + '?action=check-wan-connection&t=' + now,
			headers: {
				'User-Agent': self.userAgent
			},
			timeout: self.timeout,
			proxy: self.httpProxy
		}, function(err, res, body) {

			if (!err && res.statusCode == 200) {
				self._dlog('checkLoginStatus - Okay; Could access to WAN with proxy :)');
				callback(true); // Logged-in to MC2wifi
				return;
			}

			// If could not access to WAN without proxy
			self._dlog('checkLoginStatus - Could not access to WAN with proxy!');
			if (err != null) self._dlog('-- Details: ' + err.toString());

			// Access to authentication page without proxy
			self._dlog('checkLoginStatus - Trying to access to LAN...');
			request({
				url: 'http://wlanlogin.mc2ed.sjn.osakac.ac.jp/',
				timeout: self.timeout,
				proxy: null
			}, function (err, res, body) {

				if (!err && res.statusCode == 200) {
					self._dlog('checkLoginStatus - Okay; Could access to LAN :)');
					callback(false); // Not logged-in
					return;
				}

				// If could not access to authentication page
				self._dlog('checkLoginStatus - Could not access to LAN!');
				callback(null); // It maybe offline

			});

		});

	});
};


/**
	Get a new instance of the request module
**/
Client.prototype._getRequestModule = function(str) {
	// Clear a cache of the request module
	delete require.cache[require.resolve('request')];
	// Return a new instance
	return require('request');
};


/**
	Output of debugging log
**/
Client.prototype._dlog = function(str) {
	if (this.isDebug) {
		Helper.dlog(str);
	}
};


/* ---- */

module.exports = Client;
