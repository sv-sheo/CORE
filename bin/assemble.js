
// load config - fill global.CONFIG
CONFIG.core = require('../config');

// fill global.M
M = require('./other/modules');

// extend modules in global.M
require('./extend/modules');

// extend native JS functions (fn.args() ...)
require('./extend/native');

// set up my local modules
C.promise   = require('./other/promisifier'); // make promise-returning functions out of functions taking callback as their last argument
C.ciphers   = require('./other/ciphers');
C.sites     = require('./other/sites');
C.router    = require('./other/router');
C.request   = require('./other/request');
C.response  = require('./other/response');
C.mail      = require('./other/mail');
C.proof     = require('./other/proof');
C.socket    = require('./other/socket');
C.process   = require('./process');
C.server    = require('./server');
C.logger    = require('./logger'); // after this, everthing is to be logged (the rest of bootup too)
C.helper    = require('./helpers');
C.DB        = require('./db');

DB         	= C.DB.bind_custom_handles(M.rethinkdb);
STATE 		= require('./other/default_state.js');

R 			= {current: { /* ... only requests processed by sites, indexed by ID, requests are deletd upon completion */}, by_server: { /* in each server, ALL requests, but with only basic data, keep the latest 100 requests for each server, the rest is deleted */}};

// FILL B - global bin constant
B.KB        = 1024;
B.MB        = 1024*1024;    // 1MB

B.HOUR      = 3600000       // hour in ms
B.DAY       = 86400000;     // day in ms
B.WEEK      = 7*B.DAY;
B.YEAR      = 31556926000   // year in ms
