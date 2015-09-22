var instance;

/**
 * On-memory logger module for debugging
 * @param  {Object} options Options for module
 * @return {Object}         Instance
 */
var Logger = function(options) {

	this.logs = [];

	this.isOutput = options.isOutput || false;
	this.maxNumOfRows = options.maxNumOfRows || 1000;

};


/**
	Get an logger instance
	@return  {Object} An instance of Logger
**/
Logger.getInstance = function() {

	if (instance) return instance;

	instance = new Logger({
		isOutput: true,		// For now, it is fixed value
		maxNumOfRows: 1000	// ditto
	});
	return instance;

};


/**
 * Get a logs
 * @return {Array} Log items
 */
Logger.prototype.getLogs = function() {

	var self = this;

	return self.logs;

};


/**
 * Insert a debug log into the logger
 * @param  {String} tag Tag text
 * @param  {String} str Log text
 */
Logger.prototype.dlog = function(tag, str) {

	var self = this;

	var now = new Date();
	self.logs.push({
		createdAt: now.getTime(),
		tag: tag,
		text: str,
		type: 'debug'
	});

	if (!self.isOutput) return;
	console.log('[D ' + (now.getHours() + 1) + ':' + (now.getMinutes()) + ':' + (now.getSeconds()) + '] ' + tag + ' / ' + str);

	self._cleanup();

};


/**
 * Insert a information log into the logger
 * @param  {String} tag Tag text
 * @param  {String} str Log text
 */
Logger.prototype.ilog = function(tag, str) {

	var self = this;

	var now = new Date();
	self.logs.push({
		createdAt: now.getTime(),
		tag: tag,
		text: str,
		type: 'info'
	});

	if (!self.isOutput) return;
	console.log('[I ' + (now.getHours() + 1) + ':' + (now.getMinutes()) + ':' + (now.getSeconds()) + '] ' + tag + ' / ' + str);

	self._cleanup();

};


/**
 * Insert a warning log into the logger
 * @param  {String} tag Tag text
 * @param  {String} str Log text
 */
Logger.prototype.wlog = function(tag, str) {

	var self = this;

	var now = new Date();
	self.logs.push({
		createdAt: now.getTime(),
		tag: tag,
		text: str,
		type: 'warn'
	});

	if (!self.isOutput) return;
	console.log('[W ' + (now.getHours() + 1) + ':' + (now.getMinutes()) + ':' + (now.getSeconds()) + '] ' + tag + ' / ' + str);

	self._cleanup();

};


/**
 * Insert a error log into the logger
 * @param  {String} tag Tag text
 * @param  {String} str Log text
 */
Logger.prototype.elog = function(tag, str) {

	var self = this;

	var now = new Date();
	self.logs.push({
		createdAt: now.getTime(),
		tag: tag,
		text: str,
		type: 'error'
	});

	if (!self.isOutput) return;
	console.log('[E ' + (now.getHours() + 1) + ':' + (now.getMinutes()) + ':' + (now.getSeconds()) + '] ' + tag + ' / ' + str);

	self._cleanup();

};


/**
 * Cleanup old rows
 */
Logger.prototype._cleanup = function() {

	var self = this;

	while (self.maxNumOfRows < self.logs.length) {
		self.logs.shift();
	}

};


/* ---- */

module.exports = Logger;
