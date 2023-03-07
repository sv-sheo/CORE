
let rr = require.resolve;

// put together bin scripts
// core
exports.router              = C.helper.force_require(rr('./router'));
exports.socket     			= C.helper.force_require(rr('./socket'));
exports.middleware 			= C.helper.force_require(rr('./middleware'));

// application
exports.auth                = C.helper.force_require(rr('./auth'));    // admin authentication
exports.process             = C.helper.force_require(rr('./process'));
exports.other             	= C.helper.force_require(rr('./other'));
