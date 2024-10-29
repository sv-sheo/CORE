
// args setters
// use: in callbacks, promises - promise.then(some_function.args(1, 2, 3))

Function.prototype.args = function(...args) {

    //if
    
    // add null - for .bind() -> .bind(null, arg1, arg2 ....)
    args.unshift(null);
    
    return this.bind(...args);



};

// set args from array (  some_function(some_callback.args_array(['my', 'args']))  )
Function.prototype.args_array = function(args_array) {

    return this.bind(null, ...args_array);

};

// PROMISE.allSettled POLYFILL (its available in node.js 12.9.0 and higher)
if (!Promise.prototype.allSettled) {

    Promise.prototype.allSettled = function(promises) {

        return this.then(function(resolved_data_from_root_promise) {

            promises.unshift(Promise.resolve(resolved_data_from_root_promise));

            promises = promises.map((promise, index) => { 

                if(M.util.is_promise(promise)) {

                    return promise  .then(value => ({ ok: 1, status: "resolved", resolved: value, error: null}))
                                    .catch(error => ({ ok: 0, status: "rejected", resolved: null, error}))

                } else { return Promise.resolve(promise); }

            });

            return Promise.all(promises); // resolves with an array of objects like this: [ {status: , resolved: {}, error: {}}, {...} ]

        });

    };

 }


// callback - optional - executes code before calling Promise.all - doesnt have to return promise
// promises = (array|object) of promises OR promise-returning functions
Promise.prototype.parallel = function(callback, promises) {

    return this.then(function(result) {

        if(promises) {  callback(result); }
        else {          promises = callback; }

        var is_array = M._.isArray(promises);
        var is_object = M._.isPlainObject(promises);

        if(is_array || is_object) {

            var promises_checked = [];
            var index = 0;
            var reindexed = {0: (is_array ? 0 : 'ROOT')}; // object for saving original keys and pairing them to indexes of the array inputted to Promise.allSettled

            // validate promises, or functions (function is executed, if it returns promise, the promise is adder to Promise.all)
            // must return an array so that it can be inputted into Promise.allSettled (hopefully the object properties will be in order)
            M._.forEach(promises, function(promise, key) {

                if      (M._.isFunction(promise))   { promises_checked[index] = promise(); } 
                else if (M.util.is_promise(promise)){ promises_checked[index] = promise; } 
                else if (M._.isArray(promise))      { promises_checked[index] = Promise.chain(promise); }
                else {                                promises_checked[index] = Promise.resolve(promise); }

                // DO NOT CHANGE ORDER OF THESE 2 LINES !!
                index               = index + 1;
                reindexed[index]    = is_array ? key + 1 : key;

            });

            return Promise  .resolve(result)
                            .allSettled(promises_checked)
                            .then((parallel_resolved) => {

                                var to_resolve = is_array ? [] : {};

                                M._.forEach(parallel_resolved, function(resolved, index) { to_resolve[reindexed[index]] = resolved; });

                                return to_resolve; // resolves with to_resolve

                            }).catch((err) => { return Promise.reject({ id: '[e1_1]', err: err});});

        } else { throw new Error('Promises are not iterable.'); }

    //}).catch((error) => { return Promise.reject({ id: '[e1]', error }); });
    }).catch((error) => { error.message = '[e1] Promise.parallel error: '+error.message; return Promise.reject(error); });

};
        // EXAMPLE OF USAGE (working)
        /*function npromise(value) {

            return new Promise(function(resolve, reject) { setTimeout(function() {console.log(value); resolve(value)}, 2000);  });

        }

        setTimeout(function() {
           Promise.resolve('ROOOOTI PROMISE').parallel( function(result) { console.log('CALLBACK: ', result)},
                        [
                            npromise.args('first parallel'),
                            npromise.args('second parallel'),
                            'blergh',
                            {eqwqe: 'dwqeweq'},
                            new Promise(function(s, j) {setTimeout(function() {s('the last promise')}, 2000); }),
                            Promise.resolve('ROOT CHAIN').chain([

                                function(back_res) {return new Promise((res, rej) => {setTimeout(() => {res('1 LALA | ' + back_res)}, 2000);})},
                                function(back_res) {return new Promise((res, rej) => {setTimeout(() => {res('2 HEHE | ' + back_res)}, 2000);})},

                            ]),

                        ]
                        /*{
                            a: npromise.args('first parallel'),
                            b: npromise.args('second parallel'),
                            c:  Promise.reject('3 paral'),
                            d: Promise.resolve('4 paral'),
                            e: 'lala',
                            f: Promise.resolve('ROOT CHAIN').chain([

                                function(back_res) {return new Promise((res, rej) => {setTimeout(() => {res('1 LALA | ' + back_res)}, 2000);})},
                                function(back_res) {return new Promise((res, rej) => {setTimeout(() => {res('2 HEHE | ' + back_res)}, 2000);})},

                            ]),
                        }*
            ).then(function(results) {console.log(results)})
            .catch(function(err) {console.log(err)});

        }, 100);*/

var next_in_chain;

// !!! argument MUST BE AN ARRAY CONTAINING Promise-returnurning functions !!!!
Promise.prototype.chain = function(array_of_promise_returning_functions = []) {

    return this.then((root_promise_resolved_data) => {

        if(M._.isArray(array_of_promise_returning_functions)) {

            return next_in_chain(array_of_promise_returning_functions, 0, root_promise_resolved_data); // recursive

        } else { throw new Error('Promise.parallel: promises not given in an array.'); }

    }).catch((error) => { return Promise.reject({ id: '[e12]', error }); });
    
};

    /* EXAMPLE
    Promise.resolve('FIRST IN CHAIN').chain(
        [
            function(resolved_from_prev) { return new Promise((res, rej) => {setTimeout(() => {console.log('0 GAGO | ('+resolved_from_prev+')'); res('0 GAGO | ('+resolved_from_prev+')')}, 2000)} ); },
            function(resolved_from_prev) { return new Promise((res, rej) => {let fdf = dsf + fsdf ; setTimeout(() => {console.log('2 LALA | ('+resolved_from_prev+')'); res('2 LALA | ('+resolved_from_prev+')')}, 2000)} ); },
            function(resolved_from_prev) { return new Promise((res, rej) => {setTimeout(() => {console.log('3 FEFE | ('+resolved_from_prev+')'); res('3 FEFE | ('+resolved_from_prev+')')}, 2000)} ); },
        ])
    .then((res) => {console.log('RES', res)})
    .catch((err) => {console.log('ERR', err)})
    */

function next_in_chain(aoprf, i, value) { // aoprf = array of promise returning functions
 
    let promise     = aoprf[i]; // promises
    let is_function = M._.isFunction(promise);
    
    if( promise === undefined)  return Promise.resolve(value);  // the previous promise was last, resolve chain

    if( is_function ) { 
        
        promise     = promise(value);
        is_promise  = M.util.is_promise(promise);

        if(is_promise) {
        
            return promise.then(next_in_chain.args( aoprf, (i+1) )); // will be caught at the end of .chain
    
        } else { return Promise.reject({id: '[e10]', err: new Error('Promise.chain: ['+i+'] did not return a promise.')}); }

    } else { return Promise.reject({id: '[e11]', err: new Error('Promise.chain: ['+i+'] is not a promise-returning function')}); }
    
}

// ARRAY
Array.prototype.remove_by_value = function(value) {

    var index = index = this.indexOf(value);

    while(index > -1 ) {

        var b = this.splice(index, 1);
        index = this.indexOf(value);

    }

};

// OBJECT - create own global
global.OBJ = {
    
        // methode GET - deep
        // path - string in format 'some.path.in.object'
        // returns value of path in object or DEFAULT
        GET: function(obj, path, DEFAULT = false) {

            var ret         = obj;

            if(obj && path) {

                path    = path.split('.');

                for(var i = 0, l = path.length; i < l; i++) {

                    var path_part = path[i];
                    
                    if(path_part && (typeof obj[path_part] !== 'undefined')) {

                        obj = obj[path_part];
                        ret = obj;

                    } else {

                        ret = DEFAULT;
                        break;

                    }

                }

            }

            return ret;

        },
    
        // method SET - deep - into OBJ insert in path.path... given value, create path if doesnt exist, update if exists
        // path - string in format 'some.path.in.object'
        // returns updated object
        SET: function(obj, path, new_value = 0) {

            var ref_obj         = obj;
            var path_split      = path.split(".");
            var last            = path_split.length - 1;
            var key             ;

            for(var i = 0, l = path_split.length; i < l; i++) {

                key = path_split[i];

                if ( !(key in ref_obj) )    ref_obj[key] = {};
                
                if ( i !== last )       ref_obj = ref_obj[key];

                if ( i === last )       ref_obj[key] = new_value;
                
            }

            return obj;

        },
    
        REMOVE: function (obj, path) {
    
            if(path) {

                var path_split  = path.split('.');
                var last        = path_split.length - 1;
                var found       = false;

                var ref_obj     = obj;

                path_split.forEach((p, i) => {

                    if(ref_obj) {

                        if(i === last) {

                            delete ref_obj[p];

                        } else {

                            ref_obj = ref_obj[p];

                        }

                    }

                });


            }

            return obj;

        }
    
}

// defineGetter is deprecated
// arr.sum => 10
Array.prototype.__defineGetter__("sum", function sum(){
    
    var r = 0, a = this, i = a.length - 1;
    do {
        r += a[i];
        i -= 1;
    } while (i >= 0);
    
    return r;
    
});

Array.prototype.__defineGetter__("last", function sum(){
    
    return this[this.length - 1];
    
});