
// bootup (start) mongoDB
exports.bootup  = C.promise.pn(function(resolve, reject) {
    
    var mongod      = M.path.normalize(CONFIG.core.db.mongod);
    var config      = M.path.normalize(CONFIG.core.db.config);
    var spawn       = M.child_process.spawn;

    // create child DB process
    PROCESSES.MONGO = spawn(mongod, ['--config', config, '--rest']);

    // settle promise via events
    PROCESSES.MONGO.stdout.once('data', mongo_started.args(resolve));
    PROCESSES.MONGO.stderr.once('data', mongo_failed.args(reject)); // in case of any error, kill process and reject promise
    PROCESSES.MONGO.once('error', mongo_failed.args(reject));
    
    function mongo_started(resolve) {
    
        // remove DB error promise listeners (in future in case of error, DB could be terminated by this instead of intented termination)
        PROCESSES.MONGO.stderr.removeAllListeners('data');
        PROCESSES.MONGO.removeAllListeners('error');

        // log success and resolve DB bootup promise
        C.logger.bootup_step({ id: '[i4]', text: 'MongoDB is running'}).then(resolve.args('db.bootup()'));

    }
    
    function mongo_failed(reject, err) {
            
        console.log('[MONGO ERROR]', err.toString()); 
        PROCESSES.MONGO.kill(); // kill the process now, so that it doesnt linger around till the error shutdown
        reject({ id: '[e6]', err_text: B.wid + 'Failed to bootup MongoDB.', err: err.toString()});
    
    }

});

exports.connect = function(data) {
        
    B.pass              = C.ciphers.decrypt_sync(data.pass, CONFIG[data.site].code_geass);
    
    //console.log(data.site+'] '+B.pass);
    
    B.connect_string    = 'mongodb://' + data.user + ':' + B.pass + '@' + data.host + ':' + data.port + '/' + data.authdb; // "mongodb://user:password@localhost:27017/admin"
    
    return M.mongo.client.connect_async(B.connect_string)
    // CONNECTED
    .then((DB) => {
        
        DB = DB.db(data.db);                    // connected to auth DB, now select wanted DB
        DB = C.DB.create_shadow(DB, data.site); // create shadow DB - extend DB by shadow methods | TO DO: documentation 
        DBS[data.site] = DB;                    // add site connection to global connections
        
        // mark site as "connected" in config
        CONFIG.core.sites.connected.push(data.site);
        
        // site has been connected to DB, log step and proceed to fill load shadow data (async)
        return Promise.resolve({id: '[i7]', text: B.wid + 'Site ' + data.site + ' connected to DB.'});
        
    // LOG succesfull connection
    }).then(C.logger.bootup_step)
    
    // LOAD SHADOW COLLECTIONS (fills DBS.site.shadow with collections that are to be in shadow (given in config))
    .then(() => {
        
        var shadow_collections          = OBJ.GET(CONFIG, data.site + '.db.shadow_db', []);
        var shadow_collection_loaders   = []; // array of promise returning functions for promise chain
        
        for(var i = 0, l = shadow_collections.length; i < l; i++) {
            
            shadow_collection_loaders.push(load_shadow_collection.args(DBS[data.site], data.site, shadow_collections[i]));
            
        }
        
        return Promise.chain(shadow_collection_loaders);
        
    // LOG succesfull shadow collections load
    }).then(C.logger.bootup_step.args({id: '[i14]', text: 'Site ' + data.site + ' has loaded its shadow DB.'}))
    
    // ERROR
    .catch((err) => {
        
        console.log('Err: ' + M.util.inspect(err));
        
        return C.logger.bootup_step({id: '[e9]', err_text: 'Site ' + data.site + ' failed to connect to database.', err: err});
        
    });

    
};

// append shadow DB methods to mongo DB site connection - preserves all mongoDB functionality, but provides simplified interface integrated with shadow
exports.create_shadow = function(DB, site_name) {
    
    DB.shadow   = {};                       // to be filled at the end of connecting to DB
    DB.GET      = shadow_get(site_name);    // add shadow methods
    DB.SET      = shadow_set(site_name);    
    DB.CHANGE   = shadow_change(site_name); 
    DB.REMOVE   = shadow_remove(site_name);
    
    return DB;
    
};

// must be a promise-returning functions
var load_shadow_collection, shadow_create, shadow_get, shadow_one, shadow_set, shadow_change, shadow_remove, mongo_find, mongo_sort, mongo_sort_function, mongo_limit, 
    mongo_find_filter, mff_default, mongo_update, mu_inc, mu_mul, mu_rename, mu_set, mu_unset, mu_min_max, mu_current_date, mu_pop, mu_pull_all, mu_push, mu_add_to_set, worker_share_shadow_db, shadow_collection;

// get the whole collection and put into DBS.site.shadow.collection_name
load_shadow_collection = C.promise.new(function(resolve, reject, DB, site_name, collection_name) {
    
    DBS[site_name]['shadow'][collection_name] = {};     // init empty object of collection items to load in global DBS connections list 
    
    var collection  = DB.collection(collection_name);
    var stream      = collection.find().stream();  
    var size        = 0; // = length, but conflicts with array - count of items
    
        stream.on('data', (item) => { 
            
            DBS[site_name]['shadow'][collection_name][item['_id']] = item; // DBS.sheo.shadow.users[123] = {user id 123};
            size++;
        
        });
    
        stream.on('end', () => {
            
            DBS[site_name]['shadow'][collection_name].size = size;
            resolve();
            
        });
    
        stream.on('error', (err) => {
            
            reject({id: '[e25]', err_text: B.wid + 'Error loading shadow collection '+collection_name+'.', err:err});
        
        });
    
});

shadow_get = function(site_name) {
    
    return C.promise.new(function(resolve, reject, collection_name, filter = false, sort = false, limit = false, offset = false) {
            
        var DB = DBS[site_name];
        
        // check if collection is in shadow, if yes, dont bother MongoDB
        if(DB['shadow'][collection_name]) {
            
            try {
                
                var         items = DB['shadow'][collection_name];
                if(filter)  items = mongo_find(items, filter); // selects wanted items from shadow collection
                if(sort)    items = mongo_sort(items, sort, limit);
                if(limit)   items = mongo_limit(items, limit);
                resolve(    items);
                
                
            } catch(err) {
                
                reject({id: '[e24]', err_text: B.wid + 'Error during shadow get - in shadow query.', err:err});
                
            }
            
        // collection is not in shadow, query MongoDB
        } else {
        
                filter      = filter || {};
            var coll        = DB.collection(collection_name);
            var cursor      = coll.find(filter);
                cursor      = sort ? cursor.sort(sort) : cursor;
                cursor      = offset ? cursor.skip(offset) : cursor;
                cursor      = limit ? cursor.limit(limit) : cursor;
            var stream      = cursor.stream();
            var size        = 0; // = length
            var items       = {};

                stream.on('data',   (item)  => { items[item['_id']] = item; size++;});
                stream.on('end',    ()      => { items.size = size; resolve(items);});
                stream.on('error',  (err)   => { reject({id: '[e24]', err_text: B.wid + 'Error during shadow get - in MongoDB query.', err:err});});
            
        }

    });
    
}

    // mimic MongoDB sort
    mongo_sort = function(items = {}, sort = {}, limit = false) {
        
        var result      = {}; 
        var keys        = Object.keys(items);               // items are 'assoc arrays' - with _id as the key, for fast loop use for, for ... in is too slow
        var l           = keys.length;
        var items_array = keys.map(key => items[key]);      // transform to array from object (fucks up order of keys (sorts them too))
        var sort_array  = [];    
        
        // transform sort object to array: {id: -1, ...} -> [{key: 'id', val: -1}, ...]
        for(key in sort) {
            
            sort_array.push({key: key, val: sort[key]});
            
        }
        
        if(limit && limit < l) l = limit; // if limit is given and smaller than items, use limit
        
        // sort
        items_array.sort(function(a, b) {
            
            var i   = 0; // index of sort: [ {key: 'id', val: -1}, {key: 'name', val: 1}, ....]
            
            return mongo_sort_function(a, b, i, sort_array); // returns position for array.sort() - either 1, 0 or -1
            
        });
        
        // loop through items
        for(var i = 0; i < l; i++) {
            
            var item = items_array[i];
            result[item['_id']] = item; 

        }

        return result;
        
    }
                   
        // helper function for Array.sort() method, recursive
        mongo_sort_function = function(a, b, i, sort) {
            
            // 1 = ascending, -1 = descending
            // if ret == 0 - positions are equivalent, try next sort (if exists)
            var ret = 0;
            
            var greater     = sort[i]['val'];
            var lesser      = (-1 * greater);
            
            var a_val       = OBJ.GET(a, sort[i]['key'], 0);
            var b_val       = OBJ.GET(b, sort[i]['key'], 0);
            
            var a_as_number = parseFloat(a_val);
            var b_as_number = parseFloat(b_val);
            
            var a_is_number = !isNaN(a_as_number);
            var b_is_number = !isNaN(b_as_number);
            
            // comparing 2 numbers ? fuck natural order ('10' < '2')
            if(a_is_number && b_is_number) {
                
                if(a_as_number > b_as_number) ret = greater;
                if(a_as_number < b_as_number) ret = lesser;
                if(a_as_number == b_as_number) ret = 0;
                
            } else {
                
                if(a_val > b_val) ret = greater;
                if(a_val < b_val) ret = lesser;
                if(a_val == b_val) ret = 0;
                
            }
            
            i++;
            
            // a and b got same position on this sort, check if there is next sort, that could change it
            if(ret === 0 && sort[i]) {
                
                ret = mongo_sort_function(a, b, i, sort);
                
            }
            
            return ret;
            
        };

    // limit
    mongo_limit = function(items = {}, limit = false) {
        
        var result              = {};
            limit_not_a_number  = isNaN(parseInt(limit));
            limit               = limit_not_a_number ? 0 : limit;
            limit               = limit < 0 ? 0 : limit;
        
        // if limit === 0, return all items
        if(limit === 0) {
            
            result = items;
            
        } else {
            
            var i = 0;
            // loop through items
            for(id in items) {
                
                if(i >= limit) break;
                
                result[id] = items[id]; 
                i++;
                

            }   
            
        }

        return result;
        
    }

    // filters items in collection just like MongoDb would in a query, synchronous loop
    mongo_find = function(items = {}, filter = {}) {

        var result  = {};                   // items are 'assoc arrays' - with _id as the key
        var size    = 0;                    // = length
        
        // loop through items
        for(id in items) {
            
            // for each item, loop through filter, and add item to result set, if filter returns true
            if(mongo_find_filter(items[id], filter)) {
                
                result[id] = items[id];   
                size++;
                
            }

        }
        
        result.size = size;

        return result;

    }

        // recursive check of filter argument against item
        mongo_find_filter = function(item, filter, upper_key = false) {

            var passes = true; // by default, item passes through filter (if filter is empty)

            for(key in filter) {

                switch(key) {

                    // logical
                    case '$and':    passes = mff_and(item, filter[key], upper_key); break;      // can contain any other filter
                    case '$or':     passes = mff_or(item, filter[key], upper_key); break;       // can contain any other filter
                    case '$not':    passes = mff_not(item, filter[key], upper_key); break;      // negates result of given filter, can contain any other filter
                    case '$exists': passes = mff_exists(item, filter[key], upper_key); break;   // filter[key] SHOULD be bool (my_key: {$exists: true|false} ) 
                        
                    // equality
                    case '$eq':     passes = mff_comparison(item, key, filter[key], upper_key); break; // does not manipulate with types // key == operation (i.e. '$eq': ===) // upper_key - field key in item (i.e. 'price')
                    case '$ne':     passes = mff_comparison(item, key, filter[key], upper_key); break; // does not manipulate with types // key == operation (i.e. '$eq': ===) // upper_key - field key in item (i.e. 'price')

                    // array - filter
                    case '$in':     passes = mff_array_comparison(item, key, filter[key], upper_key); break; // key == operation (i.e. '$lt': >=) // upper_key - field key in item (i.e. 'price')
                    case '$nin':    passes = mff_array_comparison(item, key, filter[key], upper_key); break; // key == operation (i.e. '$lt': >=) // upper_key - field key in item (i.e. 'price')

                    // array - item value
                    case '$all':    passes = mff_all(item, filter[key], upper_key); break; // filter[key] MUST be an array, item[upper_key] MUST be array
                    case '$size':   passes = mff_size(item, filter[key], upper_key); break; // filter[key] MUST be number, item[upper_key] MUST be array
                        
                    // comparison - strict, match only against mnumbers"
                    case '$lt':     passes = mff_number_comparison(item, key, filter[key], upper_key); break; // key == operation (i.e. '$lt': >=) // upper_key - field key in item (i.e. 'price')
                    case '$lte':    passes = mff_number_comparison(item, key, filter[key], upper_key); break; // key == operation (i.e. '$lte': >=) // upper_key - field key in item (i.e. 'price')
                    case '$gt':     passes = mff_number_comparison(item, key, filter[key], upper_key); break; // key == operation (i.e. '$gt': >=) // upper_key - field key in item (i.e. 'price')
                    case '$gte':    passes = mff_number_comparison(item, key, filter[key], upper_key); break; // key == operation (i.e. '$gte': >=) // upper_key - field key in item (i.e. 'price')

                    default:        passes = mff_default(item, key, filter[key], upper_key); break; //mff = mongo_find_filter

                }
                
                if(!passes) break;

            }

            return passes;

}

            // filter for <field> or unmapped Mongo operators - can be a value, regexp, array, or object
            mff_default = function(item, field_key, filter, upper_key) {

                var passes      = false;
                var field_value = OBJ.GET(item, field_key, false);

                // RegExp filter
                if(M.util.is_regexp(filter)) {

                    var is_str  = M.util.is_string(field_value);
                    passes      = is_str ? filter.test(field_value) : false;

                // if filter is object, run another mongo_find_flter
                } else if(M.util.is_object(filter)) {

                    passes = mongo_find_filter(item, filter, field_key); // this field key will serve as upper key for $gte etc.

                // filter is some value, match it against field value
                } else {

                    // if field_value is an array, pass filter, if the array contains the filter (at least once)
                    if(M.util.is_array(field_value)) {
                        
                        passes = field_value.indexOf(filter) > -1;
                        
                    // filter is some value, match it against field value
                    } else {
                    
                        passes = field_value === filter;
                        
                    }

                }

                return passes;

}

            // logical operator AND - refer to MongoDB
            mff_and = function(item, filter, upper_key) {
                
                var passed = false;
                
                // filter MUST be an array of objects (another filters)
                if(M.util.is_array(filter)) {
                    
                    for(var i = 0, l = filter.length; i < l; i++) {
                        
                        // items in $and array must be filter objects
                        if(M.util.is_object(filter[i])) {
                            
                            passed = mongo_find_filter(item, filter[i], upper_key);
                            
                        } else {
                            
                            throw new Error('Shadow GET: item in $and array is not a filter object.');
                            
                        }
                        
                        // in AND clause, in the single moment passed is not true, whole filter cannot pass
                        if(!passed) break;
                        
                    }
                    
                } else {
                    
                    throw new Error('Shadow GET: filter not an array in mff_and');
                    
                }
                
                return passed;
                
            }
            
            // logical operator OR - refer to MongoDB
            mff_or = function(item, filter, upper_key) {
                
                var passed = false;
                
                // filter MUST be an array of objects (another filters)
                if(M.util.is_array(filter)) {
                    
                    for(var i = 0, l = filter.length; i < l; i++) {
                        
                        // items in $and array must be filter objects
                        if(M.util.is_object(filter[i])) {
                            
                            passed = mongo_find_filter(item, filter[i], upper_key);
                            
                        } else {
                            
                            throw new Error('Shadow GET: item in $or array is not a filter object.');
                            
                        }
                        
                        // in OR clause, in the single moment passed is true, whole filter passes
                        if(passed) break;
                        
                    }
                    
                } else {
                    
                    throw new Error('Shadow GET: filter not an array in mff_or');
                    
                }
                
                return passed;
                
            }
            
            // logical operator NOT - refer to MongoDB - passes even non-existing fields (should, but does not)
            mff_not = function(item, filter, upper_key) {
                
                var passed = true;
                        
                if(M.util.is_object(filter)) {

                    passed = mongo_find_filter(item, filter, upper_key);

                } else {

                    throw new Error('Shadow GET: item in $not is not a filter object.');

                }
                
                return !passed;
                
            }
            
            // element operator EXISTS - refer to MongoDB - reserved string '[UNDEFINED]' for shadow non-existing fields!
            mff_exists = function(item, filter, upper_key) {
                
                var passed      = false;
                var field_value = OBJ.GET(item, upper_key, '[UNDEFINED]');
                
                if(filter) {
                    
                    passed = field_value !== '[UNDEFINED]';
                    
                } else {
                    
                    passed = field_value === '[UNDEFINED]';
                    
                }
                
                return passed;
                
            }
            
            // given filter MUST be an array, item[upper_key] MUST be an array, return only items that contain ALL elements of filter, (but item[upper_key] can have more other values, but not less)
            mff_all = function(item, filter, upper_key) {
                
                var passed      = false;
                var field_value = OBJ.GET(item, upper_key, '[UNDEFINED]');
                        
                // empty values do not pass
                if(field_value !== '[UNDEFINED]') {
                    
                    if(M.util.is_array(filter) && M.util.is_array(field_value)) {

                        passed = true; // suppose everything goes well
                        
                        for(var m = 0, n = filter.length; m < n; m++ ) {
                            
                            // if element in filter does not exist in field_value, pass false and break
                            if(field_value.indexOf(filter[m]) === -1) {
                                
                                passed = false;
                                break;
                                
                            }
                            
                        }

                    } else {

                        throw new Error('Shadow GET: both filter and field_value MUST be an array in mff_and.');

                    }
                
                }
                
                return passed;
                
            }
            
            // given filter MUST be number, item[upper_key] MUST be an array, pass item only if item[upper_key].length === filter
            mff_size = function(item, filter, upper_key) {
                
                var passed      = false;
                var field_value = OBJ.GET(item, upper_key, '[UNDEFINED]');
                    filter      = M.util.prove_number(filter);              // returns either Int, Float, OR false (in case of given value couldnt be parsed)
                        
                // empty values do not pass
                if(field_value !== '[UNDEFINED]') {
                    
                    if(filter !== false && M.util.is_array(field_value)) {

                        passed = field_value.length === filter;
                        

                    } else {

                        throw new Error('Shadow GET: $size: filter must be a number and field_value must be an array in mff_size.');

                    }
                
                }
                
                return passed;
                
            }
            
            // compare of filter and item[upper_key], operators: $eq ===, $ne !==, does not manipulate types
            mff_comparison = function(item, operator, filter, upper_key) {

                var passed      = false;
                var field_value = OBJ.GET(item, upper_key, '[UNDEFINED]');

                // if field does not exist, filter cannot pass, return false (except $exists and $not)
                if(field_value !== '[UNDEFINED]') {

                    switch(operator) {

                        case '$eq':     passed = field_value === filter; break;
                        case '$ne':     passed = field_value !== filter; break;

                    }
                    
                }

                return passed;

}

            // compare item[upper_key], to filter array and see if it matches any of the element | operators: $in, $nin
            mff_array_comparison = function(item, operator, filter, upper_key) {

                var passed      = false;
                var field_value = OBJ.GET(item, upper_key, '[UNDEFINED]');

                // if field does not exist, filter cannot pass, return false (except $exists and $not)
                if(field_value !== '[UNDEFINED]') {
                
                    if(M.util.is_array(filter)) {

                        var value_index = filter.indexOf(field_value);  // -1 if it is NOT in array, otherwise 0-n (index of the item)
                                                                        // performs === strict comparison                

                        switch(operator) {

                            case '$in':     passed = value_index !== -1; break;
                            case '$nin':    passed = value_index === -1; break;

                        }

                    } else {

                        throw new Error('Shadow GET: filter not an array in mff_array_comparison');

                    }
                    
                }

                return passed;

}

            // number compare of filter and item[upper_key], operators: '$lt', $lte, $gt, $gte
            mff_number_comparison = function(item, operator, filter, upper_key) {

                // opertor === '$gte', operator to apply gte to  - upper_key is key for value in item to be compared (i.e. price) (upper_key exists in item)

                var passed      = false;
                var field_value = OBJ.GET(item, upper_key, '[UNDEFINED]');
                
                // if field does not exist, filter cannot pass, return false (except $exists and $not)
                if( field_value !== '[UNDEFINED]') {
                    
                    field_value = M.util.prove_number(field_value); // returns either Int, Float, OR false (in case of given value couldnt be parsed)
                    filter      = M.util.prove_number(filter); // returns either Int, Float, OR false (in case of given value couldnt be parsed)

                    // compare only if both values are legit numbers
                    if(field_value !== false && filter !== false) {

                        switch(operator) {

                            case '$lt':     passed = field_value < filter; break;
                            case '$lte':    passed = field_value <= filter; break;
                            case '$gt':     passed = field_value > filter; break;
                            case '$gte':    passed = field_value >= filter; break;

                        }

                    } else {

                        throw new Error('Shadow GET: invalid number in mff_number_comparison. {field_value: '+field_value+', upper_key: '+upper_key+', filter: '+M.util.inspect(filter)+'}');

                    }
                    
                }

                return passed;

            }
            
shadow_set = function(site_name) {
    
    return C.promise.new(function(resolve, reject, collection_name, data = {}) {
            
        var DB  = DBS[site_name];
        var col = DB.collection(collection_name);

        // first add to MongoDB, after succesfull insert, add to shadow
        
        col.insert(data, {w:1}, (err, result) => {
            
            if(err) reject({id: '[e26]', err_text: B.wid + 'Shadow SET error during inserting into '+collection_name+'.', err:err});
            
            if(result && result.result.ok && result.ops) { // result.ops contain arra of inserted documents
                
                result.result.collection    = collection_name;
                result.result.nInserted     = result.result.n;
                
                // added to MongoDB, now add to shadow, if collection is shadow
                if(DB['shadow'][collection_name]) {
                    
                    var item_ids = [];
                    
                    result.ops.forEach((item) => {
                        
                        DB['shadow'][collection_name][item['_id']]  = item;
                        DB['shadow'][collection_name].size         += result.insertedCount;
                        
                        item_ids.push(item['_id']);
                        
                    });
                    
                    var worker_update = {wid: C.server.worker_id, action: 'update_shadow_DB', db_action: 'SET', site_name: site_name, collection_name: collection_name, item_ids: item_ids}; 
                    
                    // send to master to update shadow DBS of other workers
                    process.send(worker_update);
                    
                }
                 
                // send result
                resolve(result);
                
            } else {
                
                reject({id: '[e27]', err_text: B.wid + 'Shadow SET error after inserting into '+collection_name+'.', err:new Error('Unknown error')});
                
            }
            
        });
        

    });
    
}

shadow_change = function(site_name) {
    
    return C.promise.new(function(resolve, reject, collection_name, filter = {}, data = {}) {
        
        var DB  = DBS[site_name];
        var col = DB.collection(collection_name);
        
        // first get id's of documents to update
        col.find(filter).toArray().then((items) => {
            
            var item_ids        = [];
            
            if(items) {
                
                // transform array to object with ID as keys + create an array of IDs for $in
                items.forEach((item) => {
                    
                    item_ids.push(item['_id']);
                    
                }) 
                
                // update items in Mongo via item_ids $in
                col.update({_id: {$in: item_ids}}, data, {w: 1, multi: true}, function(err, result) {
                    
                    if(err) {
                        
                        reject({id: '[e29]', err_text: B.wid + 'DB.UPDATE from ' + collection_name + ' falied. Error in MongoDB. filter: ' + M.util.inspect(filter) + ' || data: ' + M.util.inspect(data), err: err});
                        
                    } else {
                        
                        result.result.item_ids  = item_ids;
                        result.result.collection= collection_name;
                        shadow_collection       = DB['shadow'][collection_name];
                        
                        // update items on this worker's shadow, if collection is in shadow and send the change to other workers
                        if(shadow_collection) {
                            
                            // DO NOT update items on each workers, update it here, and send updated documents to other workers
                            var items_object = mongo_update(shadow_collection, item_ids, data);
                            
                            //console.log('['+B.wid+'] UPDATED: ' + M.util.inspect(items_object));
                            
                            // send to master to update shadow DBS of other workers
                            var worker_update = {wid: C.server.worker_id, action: 'update_shadow_DB', db_action: 'CHANGE', site_name: site_name, collection_name: collection_name, item_ids: item_ids}; 
                            process.send(worker_update);
                            
                        }
                        
                        // resolve with result
                        resolve(result);
                        
                    }
                    
                });
                
            // no items found resolve with result n = 0
            } else {
                
                result = {result: {ok: 1, n: 0, item_ids: item_ids}};
                resolve(result);
                
            }
            
        });
        
    });
    
}

    // mimic Mongo update on this workers shadow DB, however, to the rest of the workers, send already updated documents
    mongo_update = function(coll, item_ids, data) {
        
        // return updated items in object <id>: <item>
        var items_object = {};
        
        // loop through item_ids and update given items in coll (shadow collection)
        for(var i = 0, l = item_ids.length; i < l; i++) {
            
            var id      = item_ids[i];
            var item    = coll[id];
            
            // items that do not exist ignore
            if(item) {
                
                // loop through data (stuff to update) and do it
                for(action in data) {
                    
                    // field update operators
                    if(action === '$inc')           item = mu_inc(item, data[action]);
                    if(action === '$mul')           item = mu_mul(item, data[action]);
                    if(action === '$rename')        item = mu_rename(item, data[action]);
                    if(action === '$set')           item = mu_set(item, data[action]);
                    if(action === '$unset')         item = mu_unset(item, data[action]);
                    if(action === '$min')           item = mu_min_max(item, data[action], 'min');
                    if(action === '$max')           item = mu_min_max(item, data[action], 'max');
                    if(action === '$currentDate')   item = mu_current_date(item, data[action]);
                    
                    // array update operators
                    if(action === '$pop')           item = mu_pop(item, data[action]);
                    if(action === '$pullAll')       item = mu_pull_all(item, data[action]); // for MongoDB only array! {$pullAll: {test: [1, 2]}}
                    if(action === '$push')          item = mu_pop(item, data[action]);  // add
                    if(action === '$addToSet')      item = mu_add_to_set(item, data[action]);  // add only if doesnt exist
                    
                }
             
                // item was probably changed, save it to shadow collection
                coll[id] = item;

                // and for other workers
                items_object[id] = item;
                
            }
            
        }
        
        return items_object;
        
    }
    
        // mimic mongo update operators

        mu_inc = function(item, data) {
            
            var inc, field_value, new_value; // field path for dot notation
            
            for(field_path in data) {
                
                if(field_path)
                {
                    
                    inc         = data[field_path];
                    inc         = parseFloat(inc);
                    inc         = isNaN(inc) ? 0 : inc;
                    field_value = OBJ.GET(item, field_path, 0); // if field doesnt exist, create the field with $inc value
                    new_value   = field_value + inc;
                    
                    item        = OBJ.SET(item, field_path, new_value);
                
                }
                    
            }
            
            return item;
            
        }
        
        mu_mul = function(item, data) {
            
            var mul, field_value, new_value; // field path for dot notation
            
            for(field_path in data) {
                
                if(field_path)
                {
                    
                    mul         = data[field_path];
                    mul         = parseFloat(mul);
                    mul         = isNaN(mul) ? 1 : mul;
                    field_value = OBJ.GET(item, field_path, 0); // if field doesnt exist, create the field with $inc value
                    new_value   = field_value * mul;
                    
                    item        = OBJ.SET(item, field_path, new_value);
                
                }
                    
            }
            
            return item;
            
        }
        
        mu_rename = function(item, data) {
            
            var new_field_name, field_value, new_value, path_split, path_to_remove, path_joined, obj_path; // field path for dot notation
            
            for(field_path in data) {
                
                if(field_path)
                {
                    
                    // check new field name
                    new_field_name  = data[field_path];
                    new_field_name  = M.util.is_string(new_field_name) ? new_field_name : false;
                    new_field_name  = new_field_name ? new_field_name : 'new_field_name';
                    field_value     = OBJ.GET(item, field_path, '[UNDEFINED]'); // if field doesnt exist, create the field with $inc value
                    
                    // if field doesnt exist, do nothing
                    if(field_value !== '[UNDEFINED]') {
                    
                        path_split      = field_path.split('.');
                        path_to_remove  = path_split.pop();
                        path_joined     = path_split.join('.');
                        obj_path        = OBJ.GET(item, path_joined, {});
                        
                        // remove old path
                        delete obj_path[path_to_remove];
                    
                        // set the new one
                        item = OBJ.SET(item, new_field_name, field_value);
                    
                    }
                
                }
                    
            }
            
            return item;
            
        }
        
        mu_set = function(item, data) {
            
            for(field_path in data) {
                
                if(field_path)
                {
                    
                    var new_value   = data[field_path];
                    item            = OBJ.SET(item, field_path, new_value);

                
                }
                    
            }
            
            return item;
            
        }
        
        mu_unset = function(item, data) {
            
            for(field_path in data) {
                
                item = OBJ.REMOVE(item, field_path);
                    
            }
            
            return item;
            
        }
        
        // $min and $max operator together
        mu_min_max = function(item, data, type) {
            
            for(field_path in data) {
                
                if(field_path)
                {
                    
                    var field_value = OBJ.GET(item, field_path, '[UNDEFINED]');
                    var new_value   = data[field_path];
                    
                    // if field doesnt exist, create it with the new value
                    if(field_value === '[UNDEFINED]') {
                        
                        item = OBJ.SET(item, field_path, new_value);
                        
                    } else {
                        
                        if(type === 'min')  item = new_value < field_value ? OBJ.SET(item, field_path, new_value) : item;
                        if(type === 'max')  item = new_value > field_value ? OBJ.SET(item, field_path, new_value) : item;   
                        
                    }
                
                }
                    
            }
            
            return item;
            
        }
        
        mu_current_date = function(item, data) {
            
            for(field_path in data) {
                
                if(field_path)
                {
                    
                    var date_type_to_insert = data[field_path];
                    var date_to_insert      = new Date();       // by ddefault create new date, instead of timestamp
                    
                    if(date_type_to_insert['$type'] && date_type_to_insert['$type'] === 'timestamp') {
                        
                        date_to_insert      = new M.mongo.timestamp();
                        
                    }
                    
                    item = OBJ.SET(item, field_path, date_to_insert)
                
                }
                    
            }
            
            return item;
            
        }
        
        // removes item from the start (-1) or end (1) of an array
        mu_pop = function(item, data) {
            
            for(field_path in data) {
                
                if(field_path)
                {
                    
                    var first_or_last   = data[field_path];
                    var field_value     = OBJ.GET(item, field_path, []);    // MUST be an ARRRAY
                    
                    if(M.util.is_array(field_value)) {
                        
                        // remove first
                        if(first_or_last === -1)    B.B = field_value.shift();
                        if(first_or_last === 1)     B.B = field_value.pop();
                        
                        item = OBJ.SET(item, field_path, field_value);
                        
                        
                    } else {
                        
                        throw new Error('[CHANGE] shadow update: mu_pop - field value is not an array. [' + field_path + ', ' + M.util.inspect(field_value) + ']');
                        
                    }
                
                }
                    
            }
            
            return item;
            
        }
        
        // pull does filter query, pullAll only matches values OR array of values
        mu_pull_all = function(item, data) {
            
            for(field_path in data) {
                
                if(field_path)
                {
                    
                    var things_to_remove    = data[field_path]; // can be either value or array
                    var field_value         = OBJ.GET(item, field_path, []);    // MUST be an ARRRAY
                    var index_to_remove;
                    
                    
                    
                    if(M.util.is_array(field_value)) {
                        
                        // remove an array of values from an array
                        if(M.util.is_array(things_to_remove)) {
                            
                            things_to_remove.forEach((thing) => {
                                
                                index_to_remove = field_value.indexOf(thing);
                                
                                if(index_to_remove >= 0) field_value.splice(index_to_remove, 1);
                                
                            });
                          
                        // remove a value from array
                        } else {
                            
                            index_to_remove = field_value.indexOf(things_to_remove); 
                            
                            if(index_to_remove >= 0) field_value.splice(index_to_remove, 1);
                            
                        }
                        
                        item = OBJ.SET(item, field_path, field_value);
                        
                        
                    } else {
                        
                        throw new Error('[CHANGE] shadow update: mu_pull_all - field value is not an array. [' + field_path + ', ' + M.util.inspect(field_value) + ']');
                        
                    }
                
                }
                    
            }
            
            return item;
            
        }
        
        //  add 
        mu_push = function(item, data) {
            
            for(field_path in data) {
                
                if(field_path)
                {
                    
                    var things_to_add       = data[field_path]; // can be either value or array
                    var field_value         = OBJ.GET(item, field_path, []);    // MUST be an ARRRAY
                    var has_each            = things_to_add['$each'] ? true : false; // contains $each operator (add values of an array, instead of the array)
                    
                    if(M.util.is_array(field_value)) {
                        
                        // $each operator - insert all values of an array to array
                        if(has_each && M.util.is_array(things_to_add['$each'])) { // $each must contain an array
                            
                            things_to_add['$each'].forEach((thing) => {
                                
                               field_value.push(thing); 
                                
                            });
                            
                        // normal push - add value to array
                        } else {
                            
                            field_value.push(things_to_add); 
                            
                        }
                        
                        item = OBJ.SET(item, field_path, field_value);
                        
                        
                    } else {
                        
                        throw new Error('[CHANGE] shadow update: mu_push - field value is not an array. [' + field_path + ', ' + M.util.inspect(field_value) + ']');
                        
                    }
                
                }
                    
            }
            
            return item;
            
        }
        
        // add only if it doesnt exist
        mu_add_to_set = function(item, data) {
            
            for(field_path in data) {
                
                if(field_path)
                {
                    
                    var things_to_add       = data[field_path]; // can be either value or array
                    var field_value         = OBJ.GET(item, field_path, []);    // MUST be an ARRRAY
                    var has_each            = things_to_add['$each'] ? true : false; // contains $each operator (add values of an array, instead of the array)
                    
                    if(M.util.is_array(field_value)) {
                        
                        // $each operator - insert all values of an array to array
                        if(has_each && M.util.is_array(things_to_add['$each'])) { // $each must contain an array
                            
                            things_to_add['$each'].forEach((thing) => {
                                
                                // add only if doesnt exist
                                if(field_value.indexOf(thing) === -1) {
                                
                                    field_value.push(thing); 
                                    
                                }
                                
                            });
                            
                        // normal push - add value to array
                        } else {
                            
                            // add only if doesnt exist
                            if(field_value.indexOf(things_to_add) === -1) {
                                
                                field_value.push(things_to_add); 

                            }
                            
                        }
                        
                        item = OBJ.SET(item, field_path, field_value);
                        
                        
                    } else {
                        
                        throw new Error('[CHANGE] shadow update: mu_add_to_set - field value is not an array. [' + field_path + ', ' + M.util.inspect(field_value) + ']');
                        
                    }
                
                }
                    
            }
            
            return item;
            
        }
        



shadow_remove = function(site_name) {
    
    return C.promise.new(function(resolve, reject, collection_name, filter = {}) {
        
        var DB  = DBS[site_name];
        var col = DB.collection(collection_name);
        
        // first get id's of documents to remove
        col.find(filter).toArray().then((items) => {
            
            var items_object    = {};
            var item_ids        = [];
            
            if(items) {
                
                // transform array to object with ID as keys + create an array of IDs for $in
                items.forEach((item) => {
                    
                    item_ids.push(item['_id']);
                    items_object[item['_id']] = item;
                    
                });
                
                // remove items from Mongo via item_ids $in
                col.remove({'_id': {$in: item_ids}}, {w: 1}, function(err, result) {
                    
                    if(err) {
                        
                        reject({id: '[e28]', err_text: B.wid + 'DB.REMOVE from ' + collection_name + ' falied. Error in MongoDB.  filter: ' + M.util.inspect(filter), err: err});
                        
                    } else {
                        
                        result.result.item_ids  = item_ids;
                        result.result.items     = items_object;
                        result.result.collection= collection_name;
                        result.result.nRemoved  = result.result.n;
                        
                        // remove items from this worker's shadow, if collection is in shadow and send the change to other workers
                        if(DB['shadow'][collection_name]) {
                            
                            item_ids.forEach((id) => {
                                
                                delete DB['shadow'][collection_name][id]; // delete document from shadow by its id (key of item in items object)
                                
                            });
                            
                            DB['shadow'][collection_name].size -= item_ids.length;
                            
                            // send to master to update shadow DBS of other workers
                            var worker_update = {wid: C.server.worker_id, action: 'update_shadow_DB', db_action: 'REMOVE', site_name: site_name, collection_name: collection_name, item_ids: result.result.item_ids}; 
                            process.send(worker_update);
                            
                        }
                        
                        // resolve with result
                        resolve(result);
                        
                    }
                    
                });
                
            // no items found resolve with result n = 0
            } else {
                
                result = {result: {ok: 1, n: 0, item_ids: item_ids, items: items_object}};
                resolve(result);
                
            }
            
        });
        
    });
    
}

exports.worker_share_shadow_db = function(message) {
    
    // ACTION SET
    if(message.db_action === 'SET') {
        
        var db          = DBS[message.site_name];
        var shadow_col  = db.shadow[message.collection_name];
        var item_ids    = [];
        
        // check if collection is in shadow
        if(shadow_col) {
            
            var db_col      = db.collection(message.collection_name)
            
            // convert id string to mongo ObjectID
            message.item_ids.forEach((id) => {
                
                item_ids.push(new M.mongo.id(id));
                
            });
            
            // get newly inserted docs from db
            db_col.find({'_id': {$in: item_ids}}).toArray().then((items) => {
                
                // insert into this wroker shadow db
                items.forEach((item) => {
                    
                    shadow_col[item['_id']] = item;
                    
                });
                
                // increase size (length)
                shadow_col.size += items.length;
                
                console.log('[SET] finished updating shadow DB on worker ' + B.wid);
                
            }).catch((err) => {
                  
                throw new Error('['+B.wid+'][SET ERR] Failed to get inserted items from DB. ERROR: ' + M.util.inspect(err));
                     
            });
            
        } else {
            
            throw new Error('[SET] Shadow DB ERROR: shadow collection doesnt exist on worker ' + B.wid);
            
        }
        
    // ACTION REMOVE
    } else if(message.db_action === 'REMOVE') {
     
                
        var db_path     = message.site_name + '.shadow.' + message.collection_name;  // sheo.shadow.test_collection
        var col         = OBJ.GET(DBS, db_path, false);
        var item_ids    = [];
        
        if(col) {
            
            // convert id string to mongo ObjectID, and delete it from shadow collection
            message.item_ids.forEach((id) => {
                
                id = new M.mongo.id(id);
                //console.log('[REMOVE ITEM]', M.util.inspect(col[id]));
                delete col[id];
                
            });
            
            // decrease size (length)
            col.size -= message.item_ids.length;
            
            console.log('[REMOVE] finished updating shadow DB on worker ' + B.wid);
            
        } else {
            
            throw new Error('[REMOVE] Shadow DB ERROR: shadow collection doesnt exist on worker ' + B.wid);
            
        }
        
    // ACTION CHANGE
    } else if(message.db_action === 'CHANGE') {
        
        var db          = DBS[message.site_name];
        var shadow_col  = db.shadow[message.collection_name];
        var item_ids    = [];
        
        // check if collection is in shadow
        if(shadow_col) {
            
            var db_col      = db.collection(message.collection_name)
            
            // convert id string to mongo ObjectID
            message.item_ids.forEach((id) => {
                
                item_ids.push(new M.mongo.id(id));
                
            });
            
            // get newly inserted docs from db
            db_col.find({'_id': {$in: item_ids}}).toArray().then((items) => {
                
                // update item in this wrokers shadow db
                items.forEach((item) => {
                    
                    //console.log('[UPDATED ITEM] ', M.util.inspect(item));
                    shadow_col[item['_id']] = item;
                    
                });
                
                console.log('[CHANGE] finished updating shadow DB on worker ' + B.wid);
                
            }).catch((err) => {
                  
                throw new Error('['+B.wid+'][CHANGE ERR] Failed to get updated items from DB. ERROR: ' + M.util.inspect(err));
                     
            });
            
        } else {
            
            throw new Error('[CHANGE] Shadow DB ERROR: shadow collection doesnt exist on worker ' + B.wid);
            
        }
        
    }
    
}