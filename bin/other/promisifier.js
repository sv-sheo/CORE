// turn nodeback into promise
// returns a function that returns a promise, created from async nodeback
var promisify = function (fn /* args for function */) {

    var promisified =  function() {

        var args = arguments;

        if( !Array.isArray(args)) args = args ? Array.from(args) : [];

        return new Promise(function(resolve, reject) {

            // add callback to arguments array
            args.push(function(err, data) {

                if(err) { reject(err); } 
                else {
                    
                    data = data || {};
                    resolve(data);
                    
                }

            });

            var execute = fn.args_array(args);
            execute();

        });

    };

    return promisified;

};

exports.promisify = promisify;

// promisify some nodebacks
M.fs.read_file_async    = promisify(M.fs.readFile);
M.fs.stat_async         = promisify(M.fs.stat);
M.fs.read_dir_async     = promisify(M.fs.readdir);
M.fs.mkdir_async        = promisify(M.fs.mkdir);
M.fs.append_file_async  = promisify(M.fs.appendFile);
M.fs.rename_async       = promisify(M.fs.rename);
M.fs.unlink_async       = promisify(M.fs.unlink);

M.node_dir.paths_async  = promisify(M.node_dir.paths);

//M.mongo.client.connect_async          = promisify(M.mongo.client.connect);
//M.rethinkdb.connect_async               = promisify(M.rethinkdb.connect);
//M.rethinkdb.run_async                   = promisify(M.rethinkdb.run);
M.cloudinary.v2.uploader.upload_async   = promisify(M.cloudinary.v2.uploader.upload);
M.cloudinary.v2.uploader.destroy_async  = promisify(M.cloudinary.v2.uploader.destroy);

// return a function that returns a promise upon invoking
exports.new = function(fn) {
    
    return function(...args) { // possible arguments

        return new Promise(function(resolve, reject) {

            // first 2 args of the returned function will be resolve and reject!!
            args = [resolve, reject, ...args]
            
            fn(...args);

        })

    }
    
}

// return a function, that upon calling triggers process.nextTick and return promise, used for first piece of promise chain
exports.pn = function(fn) {

    return function(...args) { // possible arguments

        return new Promise(function(resolve, reject) {

            args = [resolve, reject, ...args]
            
            // invoke function on next Tick
            process.nextTick(fn.args(...args));

        })

    }

};

// access via C.promise.parallel when invoking, will be added to prototype you can also use some_promise.parallel.then.catch ....
exports.parallel  = function(callback, promises) {

    return Promise.resolve('ROOT').parallel(callback, promises);

};

// access via C.promise.chain when invoking, will be added to prototype you can also use some_promise.chain.then.catch ....
exports.chain  = function(promises) {

    return Promise.resolve('ROOT').chain(promises); // search for ROOT PROMISE and update it to ROOT

}