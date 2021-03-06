var path = require('path'), Logger = require('onmem-logger');

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

	// Debug mode
	this.isDebug = true;

	// Logger
	this.logger = Logger.getInstance();

};


/**
	Login to the network
	@param callback	Callback function: function(is_successful, [error_text])
**/
Client.prototype.login = function(callback) {

	var self = this;

	var request = self._getRequestModule();

	var url = 'http://osakac.ac.jp/';
	self.logger.debug('mc2wifi/login', 'GET: ' + url);

	// Get the host name to make a camelized header.
	// Because transparent proxy expected camelized string to HTTP header name,
	// but request module will using lower case in default.
	var req_host = require('url').parse(url).hostname;

	// 1st request - GET for redirect to authentication-page
	self.logger.debug('mc2wifi/login', 'Connect to WAN without proxy...');
	request({
		url: url,
		headers: {
			'User-Agent': self.userAgent,
			'Host': req_host // Host header; It must be indicated with camelize case.
		},
		timeout: self.timeout,
		proxy: null,
		strictSSL: false,
		followRedirect: false,
		followAllRedirects: false,
		rejectUnauthorized: false
	}, function (err, res, body) {

		if (res) {
			if (res.statusCode == 301 || res.statusCode == 302) {
				self.logger.debug('mc2wifi/login', 'Response received for GET');
				// Go to 2nd request - POST for authentication with validation by certificate
				var redirect_url = self._getAuthSubmitBaseUrlByRedirectedUrl(res.headers.location);
				self._loginSecondRequest(redirect_url, callback);
				return;
			} else if (res.statusCode == 200) { // 1st request was successful; but not redirect
				callback(false, '1st request was successful; not redirect'); // May be already logged-in
				return;
			} else { // 1st request was failed
				callback(false, '1st request was failed: ' + res.toString());
			}
		} else { // 1st request was failed
			callback(false, '1st request was failed');
		}

	})
	.on('error', function(err) {

		if (err) {
			self.logger.error('mc2wifi/login', 'Internal error occured (ignored): ' + err);
		} else {
			self.logger.error('mc2wifi/login', 'Internal error occured (ignored)');
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
	var base_url = self._getAuthSubmitBaseUrlByRedirectedUrl(url) || null;
	var cert_file = null; // Certiticate check is disabled for now
	if (base_url == null) {
		// Abort
		callback(false, 'Unknown 2nd URL: ' + url);
		return;
	}

	// Set a certificate for validate the authentication page
	var cert = null;
	if (self.isCertCheck && cert_file != null) {
		self.logger.debug('mc2wifi/_loginSecondRequest', 'Load certificate: ' + cert_file);
		cert = require('fs').readFileSync(path.resolve(__dirname, '../../certs/' + cert_file));
	} else {
		self.logger.debug('mc2wifi/_loginSecondRequest', 'Not load certificate');
	}

	// 2nd request - POST for authentication with validation by certificate
	self.logger.debug('mc2wifi/_loginSecondRequest', 'POST: ' + base_url + '/login');
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
		self.logger.debug('mc2wifi/_loginSecondRequest', 'Response received for POST');

		if (!err && (res.statusCode == 301 || res.statusCode == 302)) { // HTTP Redirect
			redirect_url = res.headers.location;
			self.logger.debug('mc2wifi/_loginSecondRequest', 'Detect HTTP Redirect: ' + redirect_url);

			// Go to 3rd request - Redirect-loop after authentication
			self._requestRedirectLoop(redirect_url, base_url, callback, 0);

		} else if (!err && res.statusCode == 200) {
			// Processing included resources
			self._requestIncludeResources(body, base_url);
			// Processing JavaScript code
			redirect_url = self._getJsRedirectUrl(body, base_url);
			if (redirect_url != null && redirect_url.match(/auth\=failed/)) {
				callback(false, 'INVALID_AUTH');
			} else if (redirect_url != null) {
				// Go to 3rd request - Redirect-loop after authentication
				self._requestRedirectLoop(redirect_url, base_url, callback, 0);
			} else {
				self.logger.debug('mc2wifi/_loginSecondRequest', body);
				callback(false, '2nd request was success ful; but not redirect');
			}

		} else { // 2nd request was failed
			callback(false, '2nd request was failed: ' + res.statusCode);
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
	self.logger.debug('mc2wifi/_requestRedirectLoop', 'GET(' + count + '): ' + url);
	request.get({
		'url': url,
		'followRedirect': false,
		'followAllRedirects': false
	}, function (err, res, body) {

		var redirect_url = null;
		if (!err && res.statusCode == 301 || res.statusCode == 302) { // HTTP Redirect
			redirect_url = res.headers.location;
			self.logger.debug('mc2wifi/_requestRedirectLoop', 'Detect HTTP Redirect: ' + redirect_url);
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

	if (!img_url.match(/^(http|https):\/\/.*/) && !img_url.match(/^\/.*/)) {
		img_url = '/' + img_url;
	}

	self.logger.debug('mc2wifi/_requestIncludeResources', 'IMG GET: ' + img_url);
	var request = self._getRequestModule();
	request({
		url: img_url,
		timeout: self.timeout,
		proxy: null
	}, function(err, res, body) {
		if (err) {
			self.logger.error('mc2wifi/_requestIncludeResources', 'Result: ' + err.toString() + ' (error)');
		} else {
			self.logger.debug('mc2wifi/_requestIncludeResources', 'Result: ' + res.statusLine);
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
		self.logger.debug('mc2wifi/_getJsRedirectUrl', 'Detect JS Redirect(A): ' + redirect_url);
	} else if (body.match(/window\.location\.href\=[\"\']([^\'\"]+)[\"\']/)) { // JS Redirect
		redirect_url = base_url + RegExp.$1;
		self.logger.debug('mc2wifi/_getJsRedirectUrl', 'Detect JS Redirect(B): ' + redirect_url);
	}
	return redirect_url;

};


/**
	Check whether the user is logged-in
	@param callback	Callback function: function(is_logged_in)
	is_logged_in: true = Online (Logged in) / false = Online (Not logged in) / null = Offline
**/
Client.prototype.checkLoginStatus = function(callback) {

	var self = this;

	// Connect to WAN without proxy
	self._execTestWANNoProxy(function(is_success, is_logged_in) {

		if (is_success && !is_logged_in) { // If redirected to authenticate page in intranet
			callback(false); // Not logged in
			return;
		} else if (is_success) { // If could connect to WAN without proxy
			callback(true); // Online on any network -- Logged in
			return;
		}

		// Connect to WAN with proxy
		self._execTestWANWithProxy(function (is_success) {

			if (is_success) { // If could connect to WAN with proxy
				callback(true); // Online on MC2wifi or network of labs -- Logged in
				return;
			}

			// Connect to Authenticate page of Intranet
			self._execTestIntra(function (is_success) {

				if (is_success) { // If could connect to authentication page in intranet
					callback(false); // Not logged in
					return;
				}

				callback(null); // Offline

			});

		});

	});

};


/**
	Connect to WAN without proxy
	@param callback	Callback function: function(is_successful, is_logged_in)
**/
Client.prototype._execTestWANNoProxy = function(callback) {

	var self = this;

	var request = self._getRequestModule();

	// Make a request url
	var now = new Date().getTime();
	var url = self.wanOnlineCheckUrl + '?action=check-wan-connection&t=' + now;

	// Get the host name to make a camelized header.
	// Because transparent proxy expected camelized string to HTTP header name,
	// but request module will using lower case in default.
	var req_host = require('url').parse(url).hostname;

	// Connect to WAN page without proxy
	self.logger.debug('mc2wifi/_execTestWANNoProxy', 'Connect to WAN without proxy...');
	request({
		url: url,
		headers: {
			'User-Agent': self.userAgent,
			'Host': req_host // Host header; It must be indicated with camelize case.
		},
		timeout: self.timeout,
		proxy: null,
		strictSSL: false,
		followRedirect: false,
		followAllRedirects: false,
		rejectUnauthorized: false
	}, function (err, res, body) {

		if (res) {
			if (res.statusCode == 200) { // Success
				self.logger.debug('mc2wifi/_execTestWANNoProxy', 'Successful');
				callback(true, true); // Online
				return;
			} else if ((res.statusCode == 301 || res.statusCode == 302)
				&& self._getAuthSubmitBaseUrlByRedirectedUrl(res.headers.location)) { // Redirect
				self.logger.debug('mc2wifi/_execTestWANNoProxy', 'Redirected to auth page');
				callback(true, false); // Not logged-in
				return;
			}
		}

		if (err) {
			self.logger.error('mc2wifi/_execTestWANNoProxy', 'Failed - ' + err.toString());
		} else {
			self.logger.error('mc2wifi/_execTestWANNoProxy', 'Failed');
		}
		if (res) {
			self.logger.error('mc2wifi/_execTestWANNoProxy', 'Failed - Response: ' + res.statusCode);
		}
		callback(false, false);

	})
	.on('error', function(err) {

		if (err) {
			self.logger.error('mc2wifi/_execTestWANNoProxy', 'Failed with internal error - ' + err.toString());
		} else {
			self.logger.error('mc2wifi/_execTestWANNoProxy', 'Failed with internal error');
		}

	});

};


/**
	Connect to WAN with proxy
	@param callback	Callback function: function(is_successful)
**/
Client.prototype._execTestWANWithProxy = function(callback) {

	var self = this;

	var request = self._getRequestModule();
	var now = new Date().getTime();

	// Connect to WAN page with proxy
	self.logger.debug('mc2wifi/_execTestWANWithProxy', 'Connect to WAN with proxy... ' + self.httpProxy);
	request({
		url: self.wanOnlineCheckUrl + '?action=check-wan-connection&t=' + now,
		headers: {
			'User-Agent': self.userAgent
		},
		timeout: self.timeout,
		proxy: self.httpProxy
	}, function (err, res, body) {

		if (!err && res && res.statusCode == 200) {
			self.logger.debug('mc2wifi/_execTestWANWithProxy', 'Successful');
			callback(true);
			return;
		}

		if (err) {
			self.logger.error('mc2wifi/_execTestWANWithProxy', 'Failed - ' + err.toString());
		} else {
			self.logger.error('mc2wifi/_execTestWANWithProxy', 'Failed');
		}
		callback(false);

	})
	.on('error', function(err) {

		if (err) {
			self.logger.error('mc2wifi/_execTestWANWithProxy', 'Failed with internal error - ' + err.toString());
		} else {
			self.logger.error('mc2wifi/_execTestWANWithProxy', 'Failed with internal error');
		}

	});

};


/**
	Connect to authentication page of intranet in university
	@param callback	Callback function: function(is_successful)
**/
Client.prototype._execTestIntra = function(callback) {

	var self = this;

	var request = self._getRequestModule();

	// Connect to authentication page of intranet
	self.logger.debug('mc2wifi/_execTestIntra', 'Connect to intranet...');
	request({
		url: 'http://wlanlogin.mc2ed.sjn.osakac.ac.jp/',
		timeout: self.timeout,
		proxy: null
	}, function (err, res, body) {

		if (!err && res && res.statusCode == 200) {
			self.logger.debug('mc2wifi/_execTestIntra', 'Successful');
			callback(true);
			return;
		}

		if (err) {
			self.logger.error('mc2wifi/_execTestIntra', 'Failed - ' + err.toString());
		} else {
			self.logger.error('mc2wifi/_execTestIntra', 'Failed');
		}
		callback(false);

	})
	.on('error', function(err) {

		if (err) {
			self.logger.error('mc2wifi/_execTestIntra', 'Failed with internal error - ' + err.toString());
		} else {
			self.logger.error('mc2wifi/_execTestIntra', 'Failed with internal error');
		}

	});

};


/**
	Get a base url for submission of authentication informations from redirected url
	@param url An url which redirected from general page on WAN by transparent proxy
	@return Return a url
 */
Client.prototype._getAuthSubmitBaseUrlByRedirectedUrl = function(url) {

	var self = this;

	if (url.match(/mcwlct(\d+)s\.mc2ed\.sjn\.osakac\.ac\.jp/)) {
		return 'https://mcwlct' + RegExp.$1 + 's.mc2ed.sjn.osakac.ac.jp:9998';
	}

	return null;

};


/**
	Get a new instance of the get module
**/
Client.prototype._getHttpModule = function() {

	// Clear a cache of the http module
	delete require.cache[require.resolve('http')];
	// Return a new instance
	return require('http');

};


/**
	Get a new instance of the request module
**/
Client.prototype._getRequestModule = function() {

	var self = this;

	// Clear a cache of the request module
	delete require.cache[require.resolve('request')];

	// Return a new instance
	var req = require('request');
	if (self.isDebug) req.debug = false; // Logging of Request module
	return req;

};


/* ---- */

module.exports = Client;
