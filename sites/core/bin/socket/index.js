
let rr = require.resolve;

exports.handlers    = C.helper.force_require(rr('./handlers')); // methods for handling socket actions
exports.router      = C.helper.force_require(rr('./router'));

