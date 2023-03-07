// Check if browser is compatible
// this script might not get executed because of uncatchable syntax error

// compatibility check - redirect to stupid site (s.opajda.cz)
var co                  = {}; // compatibility object
var array               = [0, 1]; // array for testing
var object              = {a: 'a', b: 'b'}; // object for testing

var COMPATIBLE          = true; // in case of syntax error this variable wont be declared
var COMPATIBLE_ERROR    = '';

// some expressions may throw error
try {
    
    //var werwerw=werwer*werrwe;

    co.IndexedDB            = (window.indexedDB||window.mozIndexedDB||window.webkitIndexedDB||window.msIndexedDB) ? 1 : NO_INDEXED_DB;
    co.Promises             = window.Promise ? 1 : NO_PROMISE;
    co.CustomEvent          = window.CustomEvent ? 1 : NO_CUSTOM_EVENT;
    co.ES6_arrays           = array.forEach ? 1 : NO_ES6_ARRAY;
    co.object_assign        = Object.assign ? 1 : NO_OBJECT_ASSIGN;
    co.localStorage         = (window.localStorage && window.localStorage.setItem) ? 1 : NO_LOCAL_STORAGE;
    co.arrow_functions      = array.map((value)=>value*2); // [0, 2]
    co.object_assign_2      = Object.assign({}, {a: 'b'});
    co.object_keys          = Object.keys({a: 'b'});
    co.promise_2            = new Promise(function(resolve, reject) { resolve(); });
    co.async                = async function() { var t = await co.promise_2; };

} catch(e) {
    
    COMPATIBLE          = false;
    COMPATIBLE_ERROR    = e; // BROWSER NOT COMPATIBLE
    console.log('COMPATIBILITY ERROR', e);
    
}