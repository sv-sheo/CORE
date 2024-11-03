
// bootup (start) RethinkDB // MUST BE A PROMISE RETURNING FUNCTION
exports.bootup  = async function(previous_step={}) {

    if(previous_step.ok) {

        let result = {ok: 0, data: {previous_step}, id: '', text: '', error: null};

        try {

            let spawn       = M.child_process.spawn;
            let DB_bootup   = new Promise(function(resolve, reject) {

                // create child DB process
                PROCESSES.RETHINKDB = spawn(CONFIG.core.db.script, ['--config-file', CONFIG.core.db.config]);

                C.process.bind_child_process_event_listeners(PROCESSES.RETHINKDB, 'RETHINKDB');

                // settle promise via events
                PROCESSES.RETHINKDB.stdout.once('data', started.args(resolve));
                PROCESSES.RETHINKDB.stderr.once('data', failed.args(resolve)); // in case of any error, kill process and reject promise
                PROCESSES.RETHINKDB.once('error', failed.args(resolve));

            });

            result = await DB_bootup;

            function started(resolve, data_buffer) {
                
                try {

                    var data_text = data_buffer.toString(); // argument supplied to stdout.once(data)

                    // remove DB error promise listeners (in future in case of error, DB could be terminated by this instead of intended termination)
                    PROCESSES.RETHINKDB.stderr.removeAllListeners('data');
                    PROCESSES.RETHINKDB.removeAllListeners('error');

                    PROCESSES.RETHINKDB.on('error', function(error) { C.process.admin.log_event({event_: 'error', type: 'CHILD_PROCESS', process_name: 'RETHINKDB', arguments: {error}}); } );
                    PROCESSES.RETHINKDB.stderr.on('data', function(data) {let text = data.toString('utf8'); C.process.admin.log_event({event_: 'STDERR.DATA', type: 'CHILD_PROCESS', process_name: 'RETHINKDB', arguments: {text}}); } );

                    result = {...result, ok: 1, id: '[i4]', text: data_text};

                    // after booting up, DB needs some time before first connection can be made, delay the bootup resolve for this pusrpose (to enable MASTER to connect in next step)
                    setTimeout(function() { C.logger.bootup_step(result); resolve(result); }, 60000);

                } catch(error) { resolve({ok: 0, id: '[e6.2]', error, data: {}, text: 'Failed to bootup RethinkDB - unknown [started] error: '+error.message}); }

            }
            
            function failed(resolve, error_buffer) {

                try {

                    var error_text  = error_buffer.toString('utf8');
                    var error       = new Error(error_text);

                    PROCESSES.RETHINKDB.kill(); // kill the process now, so that it doesnt linger around till the error shutdown

                    result = {...result, id: '[e6.1]', text: 'Failed to bootup RethinkDB - unknown STDERR error: '+error.message, error};

                    resolve(result);

                } catch(error_) { resolve({ok: 0, id: '[e6.3]', error: error_, data: {}, text: 'Failed to bootup RethinkDB - unknown [failed] error: '+error_.message}); }
            
            }

        } catch(error) {

            if(PROCESSES.RETHINKDB) PROCESSES.RETHINKDB.kill(); // kill the process now, so that it doesnt linger around till the error shutdown
            result = {...result, id: '[e6]', text: 'Failed to bootup RethinkDB - unknown error: '+error.message, error};

        }

        return result;

    } else { return previous_step; } // propagate the error to the end of bootup chain

};

exports.connect = async function(config={}) {

    var result  = {ok: 0, data: {}, error: null, id: '', text: ''};
    var site    = config.name; 
    var data    = config.db || {};

    try {

        var pass_       = C.ciphers.decrypt_sync(data.pass, config.code_geass);
        var CONNECTION  = await DB.connect({ host: data.host, port: data.port, db: data.db, user: data.user, password: pass_ });

        result.data     = {CONNECTION, SHADOW: {}}; // create empty shadow DB - extend DB by shadow methods | TO DO: documentation 

        result.ok       = 1;
        result.id       = '[i7]';
        result.text     = 'Site ' + site + ' connected to DB '+data.db+'.'

    } catch(error) {

        result.id       = '[e9]';
        result.text     = 'Failed to connect site ' + site + ' to DB - unknown error: '+error.message;
        result.error    = error;

        result.data.CONNECTED   = 0; // if ok, these things are filled after calling this method
        result.data.READY       = 0;
        result.data.TABLES      = 0;
        result.data.NAME        = config?.db?.db;

    }

    return result;

}

// after rethinkDB has been booted up, it takes a while before all tables are ready, there is a possibility bootup will finish before that, so we need to wait till DB is ready
exports.wait_for_DB_ready = async function({config={}, CONN}={}) {

    var result  = {ok: 0, data: {}, error: null, id: '', text: ''};
    var site    = config.name; 
    var data    = config.db || {};

    try {

        var ready_result    = await DB.db(data.db).wait({waitFor: 'all_replicas_ready', timeout: 60}).run(CONN) // wait for max. 30 seconds for DBs to load their replicas; 0 = no timeout

        result.ok       = 1;
        result.id       = '[i15]';
        result.text     = 'DB ' + data.db + ' is ready (number of ready tables: '+ready_result.ready+').';
        result.data     = ready_result; // { ready: <number_of_tables> }

    } catch(error) {

        result.id        = '[e13]';
        result.text      = 'DB ' + data.db + ' failed to become ready: '+error.message;
        result.error    = error;

    }

    return result;

}

// after DB is ready, load shadow DB (small DB collections/tables saved into memory for quick access without queries)
exports.load_shadow_DB = async function({config={}, db_data={}}={}) {

    var result  = {ok: 0, data: {SHADOW: {}}, id: '', text: '', error: null, errors: {}};
    var site    = config.name; 
    var data    = config.db || {};

    try {

        var shadow_tables_to_load   = data.shadow_db || [];
        var shadow_tables_loaders   = shadow_tables_to_load.map(table_name => C.DB.GET_SHADOW_TABLE.args({db_data, table_name}) ); // array of promise returning functions for promise chain

        var compiled_errors         = '\r\n---- ERRORS:';
        var has_errors              = 0;

        var parallel_result         = await C.promise.parallel(shadow_tables_loaders);

        // format results from all calls
        M._.forEach(parallel_result, function(res) {

            if(res.resolved !== 'ROOT') {

                if(res.ok && res.resolved && res.resolved.ok) { result.data.SHADOW[res.resolved.table] = res.resolved.data; }
                else { 

                    var table               = M._.get(res, 'resolved.table', 'unknown-table-'+C.helper.random_alpha_numeric(6)); 
                    result.errors[table]    = res.resolved ? res.resolved.error : res.error;
                    compiled_errors        += '\r\n-------- '+table+': '+result.errors[table].message;
                    has_errors              = 1;
                
                }

            }

        });

        result.ok       = 1;
        result.id       = '[i16]';
        result.data     = {...result.data, loaded: M._.size(result.data.SHADOW), to_load: shadow_tables_to_load.length};
        result.text     = 'Site ' + site + ' has loaded its shadow DB tables ('+result.data.loaded+'/'+result.data.to_load+'): '+Object.keys(result.data.SHADOW).join(', ') + (has_errors ? compiled_errors : '');

    } catch(error) {

        result.id       = '[e43]';
        result.text     = 'Site ' + site + ' failed to load its shadow DB: '+error.message;
        result.error    = error;

        result.data.CONNECTED   = 0; // connection is closed after calling this method in case of load_shadow_db() error
        result.data.READY       = 0;
        result.data.TABLES      = 0;
        result.data.NAME        = config?.db?.db;

    }

    return result;

}

exports.bind_custom_handles = function(DB) {
    
    DB.GET      = SHADOW_GET;    // add shadow methods
    DB.SET      = SHADOW_SET;   
    DB.CHANGE   = SHADOW_CHANGE; 
    DB.REMOVE   = SHADOW_REMOVE;

    return DB;
    
}; 

exports.logical_operators_to_filter_methods = { '==': 'eq', '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge', '&&': 'and', '||': 'or'};

exports.PROCESS_RESULT_ARRAY = function(results, result_format_ = 'by_id') {

    var ret             = null;
    var result_formats  = {raw: 'raw', single: 'single', by_id: 'by_id'};
        result_format   = result_formats[result_format_] || 'by_id';

    if(result_format === 'raw')         ret = results;
    if(result_format === 'single')      ret = results[0] || null;
    if(result_format === 'by_id')       ret = C.helper.data_by_key(results, 'id');

    return ret;

}

// every place where this methos is used needs to be refactored
exports.GET_SHADOW_TABLE = async function({db_data={}, table_name}={}) {
    
    var result = {ok: 0, data: {}, error: null};

    try {

        var CURSOR  = await DB.db(db_data.NAME).table(table_name).run(db_data.CONNECTION);
        var content = await CURSOR.toArray();

        result.ok   = 1;
        result.data = C.helper.data_by_key(content, 'id');
        result.table= table_name;

        // recursive asynchronous get of all rows can be done via next - https://rethinkdb.com/api/javascript/next

    } catch(error) { result.ok = 0; result.error = error; }

    return result;
    
};

// must be a promise-returning functions
var SHADOW_GET, SHADOW_GET_BY_INDEX, SHADOW_GET_BY_FILTER, SHADOW_PROCESS_FILTER_PAIR, SHADOW_GET_ORDER_BY, 
SHADOW_SET, SHADOW_CHANGE, SHADOW_REMOVE;

// REFACTOR HERE DBS['shadow'] --> SITE.DB.SHADOW
SHADOW_GET = async function(db_data={}, table_name, {shadow, get, filter, limit, order_by, query, format} = {}) {

    var result = null; // return either DB result or error

    try {

        var DBQ         = null;                   // this DB QUERY
        var CONN        = db_data?.CONNECTION;  // connection to this DB, db_data ... should be result.data of connect_site_to_DB() ... {CONNECTED, CONNECTION, READY, NAME, TABLES, SHADOW}
        var db_name     = db_data?.NAME;
        var db_shadow   = db_data?.SHADOW;

        if(db_name && table_name && CONN) {

            // check if table is in shadow, if yes, dont bother DB; shadow =  ID ... to select 1 item || 'all' ... to select all
            if(shadow) {

                var shadow_table = db_shadow?.[table_name];

                if(shadow_table) result = shadow === 'all' ? structuredClone(db_shadow[table_name]) : structuredClone(db_shadow[table_name][shadow]);
                
            // table is not in shadow, query RethinkDB
            } else {

                DBQ         = DB.db(db_name).table(table_name);

                var bin_id  = 'shadow_get_'+C.helper.random_alpha_numeric(4)+'_'+M.moment().format('x'); // for storing this call's specific data in B
                B[bin_id]   = {};
            
                // either run a custom query (query must be a function accepting DB (QUERY) as a parameter)
                if(query) {

                    DBQ = query(DBQ);  // do you even query?

                // get a single item by ID or, if get is an array, all items with specified IDs by specified index (r.get OR r.getAll)
                // get is way faster (than filter) since it uses indexes
                } else if(get) {

                    DBQ = SHADOW_GET_BY_INDEX(DBQ, get); 

                    if( M._.isArray(get) || M._.isPlainObject(get) ) {} else { format = 'single' }; // to not have to specify format: single for every get by ID

                // or use simplified filter, limit and order_by
                // filter is slower, coz it doesnt use indexes
                } else {

                    DBQ = order_by  ? DBQ.orderBy(SHADOW_GET_ORDER_BY(order_by)) : DBQ; // orderBy MUST be BEFORE filter // orderBy can order all columns, if table has less than 100 000 rows !!! if it has more than that, it can be ordered only by INDEXED columns!!! 
                    DBQ = filter    ? DBQ.filter(SHADOW_GET_BY_FILTER(DBQ, filter, bin_id)) : DBQ;
                    DBQ = limit     ? DBQ.limit(limit) : DBQ;

                }

                delete B[bin_id];

                var CURSOR      = await DBQ.run(CONN);
                var raw_result  = (CURSOR && CURSOR.toArray && M._.isFunction(CURSOR.toArray)) ? await CURSOR.toArray() : [CURSOR];
                    result      = C.DB.PROCESS_RESULT_ARRAY(raw_result, format);
                
            }

        } else { result = new Error('[e40] Error during DB.GET - invalid DB or table.'); }

    } catch(error) { 
        
        error.message   = '[e41] Error during DB.GET - run error: '+error.message;  
        result          = error;
    
    }

    return result;
    
}

                // GET helper of SHADOW_GET
                SHADOW_GET_BY_INDEX = function(DBQ, get) {

                    /* get should look like this:        (get can only be run on indexes)
                        
                        get = ID                    or  ... selects 1 item by ID
                        get = [ID1, ID2, ID3, ...]  or  ... selects all specified items by ID
                        get =   {
                                    search: ID || [ID1, ID2, ID3, ...],
                                    index: 'last_name'                  ... index is optional and defaults to 'id'
                        }

                    */
                    if(M._.isArray(get)) {
          
                        DBQ = DBQ.getAll(...get); 
                    
                    } else if (M._.isPlainObject(get)) {
                        
                        var get_search  = get.search || 'non-existent-item';
                            get_search  = M._.isArray(get_search) ? get_search : [get_search]; 
                        var get_index   = get.index  || 'id';

                        DBQ = DBQ.getAll(...get_search, {index: get_index});
                    
                    // get 1 item by ID (primary key)
                    } else {

                        DBQ = DBQ.get(get);

                    }

                    return DBQ;

                }

                // FILTER helper of SHADOW_GET, ... recusrive function
                SHADOW_GET_BY_FILTER = function(DBQ, filter = {}, bin_id, fid = 1) {

                    /* filter should look like this

                        filter = {name: 'john'}             ... to get all Johns OR
                        filter = {age:  ['==', 18]}         ... to get all aged 18
                        filter = {age:  ['<', 18]}          ... to get all below the age 18
                        filter = {age:  ['>=', 18]}         ... to get all 18+ y/o
                        filter = {name: 'john', age:  20}   ... to get all 20 y/o Johns
                        filter = {name: 'john', $or: {name: 'peter'}}   ... to get all johns and peters
                        filter = {name: 'john', $and: {age: 20, $or: {age: 30} } } ... to get all johns who are 20 or 30 y/o
                        filter = {name: 'john', $or: {age: 20, $or: {age: 30} } } ... to get all johns or all people who are 20 or 30 y/o

                    */

                    B[bin_id].filters                   = B[bin_id].filters || {};
                    B[bin_id].filters[fid]              = {}; // filter_id
                    B[bin_id].filters[fid].first_pair   = 1;
                    B[bin_id].filters[fid].filter_QUERY = null;

                    M._.forEach(filter, function(value, key) { B[bin_id].filters[fid].filter_QUERY = SHADOW_PROCESS_FILTER_PAIR(DBQ, value, key, bin_id, fid)});

                    return B[bin_id].filters[fid].filter_QUERY;

                }

                    SHADOW_PROCESS_FILTER_PAIR = function(DBQ, value, key, bin_id, fid) {

                        var bin             = B[bin_id].filters[fid];

                        if(key && key !== '$or' && key !== '$and') {
                            
                            // first handle value
                            var value_              = M._.isArray(value) ? value[1] : value;
                            var filtering_operator  = M._.isArray(value) ? value[0] : '==';
                            var filtering_method    = C.DB.logical_operators_to_filter_methods[filtering_operator] || 'eq'; // returns eq || gt || gte || lt || lte;
                            var FILTER              = filtering_method;

                            if(bin.first_pair) {

                                bin.filter_QUERY  = DB.row(key)[FILTER](value_); // translates to something like DB.row('age').gte(18);
                                bin.first_pair    = 0;

                            } else { bin.filter_QUERY = bin.filter_QUERY.and( DB.row(key)[FILTER](value_) ); }

                        } else if(key === '$and'){ bin.filter_QUERY = bin.filter_QUERY.and(SHADOW_GET_BY_FILTER(DBQ, value, bin_id, (fid+1))); /*console.log('['+key+':'+value+'] '+'query.and(...)');*/
                        } else if(key === '$or') { bin.filter_QUERY = bin.filter_QUERY.or(SHADOW_GET_BY_FILTER(DBQ, value, bin_id, (fid+1))); /*console.log('['+key+':'+value+'] '+'query.or(...)');*/ }

                        return bin.filter_QUERY;

                    }

                SHADOW_GET_ORDER_BY = function(order_by = ['id', 'asc', true]) { 

                    /* order_by should be an ARRAY like this:
                    
                        order_by =  [
                                        'age',  // first argument = column to order; if more than 100 000 rows, IT MUST BE an INDEXed column, and third argument must be true
                                        'desc', // asc || desc      ... asc is default
                                        false   // true || false    ... if ordering by INDEX, it must be true, by default can remain false/undefined
                                    ]

                        order_by = ['age', 'desc', false]   OR
                        order_by = ['id', 'asc', true]      ... id is an INDEX

                    */ 
                   var ASC_OR_DESC_OPTIONS = {asc: 'asc', desc: 'desc'};

                    var column      = order_by[0] || 'id';
                    var ASC_OR_DESC = ASC_OR_DESC_OPTIONS[order_by[1]] || 'asc';
                    var is_index    = order_by[2] ? true : false;

                    var order_by_QUERY  = is_index ? {index: DB[ASC_OR_DESC](column)} : DB[ASC_OR_DESC](column);

                    return order_by_QUERY;

                }


SHADOW_SET = async function(db_data={}, table_name='', data = {}, shadow=false) { // if shadow is truthy, update shadow tables, if any

    var result = null;

    try {

        var CONN        = db_data?.CONNECTION;  // connection to this DB, db_data ... should be result.data of connect_site_to_DB() ... {CONNECTED, CONNECTION, READY, NAME, TABLES, SHADOW}
        var db_name     = db_data?.NAME;

        if(db_name && table_name && CONN) {

            // first add to RethinkDB, after succesfull insert, add to shadow
            result = await DB.db(db_name).table(table_name).insert(data).run(CONN);

                    // result:  { deleted: 0, errors: 0, inserted: 1, replaced: 0, skipped: 0, unchanged: 0, generated_keys: [ "dd782b64-70a7-43e4-b65e-dd14ae61d947" ] } ... generated keys are present only if 1 or more documents were inserted without ID and rethinkDB generated it for them
                    // result.first_error = '' ... only if errors > 0
                    // error: { ReqlOpFailedError = string }

            // extend data of result
            result.db       = db_name;
            result.table    = table_name;

            var to_be_inserted = M.util.is_array(data) ? data.length : 1;

            if(result && result.inserted === to_be_inserted && result.errors === 0) {
                
                // check if affected table is in shadow, if yes, trigger actualization among workers
                if(shadow) result.shadow = await C.DB.update_shadow_across_workers({db_data, table_name});
            }
            // let sites handle errors
            //} else { result = new Error('[e27] Shadow SET error after inserting into '+db_name+'.'+table_name+'. (result: '+M.util.inspect(result)+').'); }

        } else { result = new Error('[e26] Error during DB.SET - invalid DB or table.'); }

    } catch(error) { 
        
        error.message   = '[e26] Shadow SET error during inserting into '+db_name+'.'+table_name+': '+error.message;
        result          = error;
    
    }

    return result;

}

SHADOW_CHANGE = async function(db_data = {}, table_name='', {get, filter, limit, order_by, query, shadow}={}, update, mode) {
        
    var result = null; // return either DB result or error

    try {

        var DBQ         = null;                   // this DB QUERY
        var CONN        = db_data?.CONNECTION;  // connection to this DB, db_data ... should be result.data of connect_site_to_DB() ... {CONNECTED, CONNECTION, READY, NAME, TABLES, SHADOW}
        var db_name     = db_data?.NAME;

        if(db_name && table_name && CONN && update) {

            DBQ         = DB.db(db_name).table(table_name);

            var bin_id  = 'shadow_change_'+C.helper.random_alpha_numeric(4)+'_'+M.moment().format('x'); // for storing this call's specific data in B
            B[bin_id]   = {};

            // either run a custom query (query must be a function accepting DB (QUERY) as a parameter)
            if(query) {

                DBQ = query(DBQ);  // do you even query?

            // or run a simple search & update
            } else {
                                
                // get a single item by ID or, if get is an array, all items with specified IDs by specified index (r.get OR r.getAll)
                // get is way faster (than filter) since it uses indexes
                if(get) {

                    DBQ = SHADOW_GET_BY_INDEX(DBQ, get); 

                // or use simplified filter, limit and order_by
                // filter is slower, coz it doesnt use indexes
                } else {

                    DBQ = order_by  ? DBQ.orderBy(SHADOW_GET_ORDER_BY(order_by)) : DBQ; // orderBy MUST be BEFORE filter // orderBy can order all columns, if table has less than 100 000 rows !!! if it has more than that, it can be ordered only by INDEXED columns!!! 
                    DBQ = filter    ? DBQ.filter(SHADOW_GET_BY_FILTER(DBQ, filter, bin_id)) : DBQ;
                    DBQ = limit     ? DBQ.limit(limit) : DBQ;

                }

                //now the UPDATE - docs here https://rethinkdb.com/api/javascript/update
                //DBQ = DBQ.update(update); // update does not remove fields in objects - only extends them, with replace you can make {a: 1, b: 2} -> {a: 1}

                var modes   = {update: 'update', replace: 'replace'};
                    mode    = modes[mode] || 'update';

                DBQ = DBQ[mode](update);

                /* update examples 
                    DBQ.get(...).update({status: "published"}).run(conn)                        ... updates status of selected rows
                    DBQ.get(...).update({address: {city: 'BRNO'}}).run(conn)                    ... updates of nested values inside a document
                    DBQ.get(...).update({views: DB.row("views").add(1).default(0)}).run(conn)   ... increments views by 1, if views is not set in document, set it to 0
                    DBQ.get(...).update({num_comments: DB.db('db').table("comments").filter({idPost: 1}).count()  }).run(conn)   ... update count of comments
                */

            }

            delete B[bin_id];

            // RUN THE QUERY
            var result = await DBQ.run(CONN);

                        // result = { deleted: 0, errors: 0, inserted: 0, replaced: 5, skipped: 0, unchanged: 2, changes: [ {new_val: {}, old_val: {}}, {...}, ...] } ........changes = not set OR object (if returnChanges = true)
                        // result.first_error = ''  ... only if errors > 0
                        // error = { ReqlOpFailedError = string }

            // extend data of result
            result.db       = db_name;
            result.table    = table_name;

            if(result && result.errors === 0 && result.skipped === 0) {

                result.updated  = result.replaced + result.unchanged;

                // check if affected table is in shadow, if yes, trigger actualization among workers
                if(shadow) result.shadow = await C.DB.update_shadow_across_workers({db_data, table_name});
            }
            // let sites handle errors
            /*} else if(result && result.skipped && result.replaced === 0 && result.unchanged === 0) {

                     result = new Error('[e44] Shadow CHANGE - documents to update not found ('+result.skipped+').');

            } else { result = new Error('[e44] Shadow CHANGE error while updating '+db_name+'.'+table_name+'. (result: '+M.util.inspect(result)+').')}
            */

        } else { result = new Error('[e44] Error during DB.CHANGE - invalid DB or table or update data.'); }

    } catch(error) { 
        
        error.message   = '[e44] Error during DB.CHANGE - run error: '+error.message;  
        result          = error;

    }

    return result;
    
}

SHADOW_REMOVE = async function(db_data, table_name, {get, filter, limit, order_by, shadow}={}) {

    var result = null; // return either DB result or error

    try {

        var DBQ         = null;                   // this DB QUERY
        var CONN        = db_data?.CONNECTION;  // connection to this DB, db_data ... should be result.data of connect_site_to_DB() ... {CONNECTED, CONNECTION, READY, NAME, TABLES, SHADOW}
        var db_name     = db_data?.NAME;

        if(db_name && table_name && CONN) {

            DBQ         = DB.db(db_name).table(table_name);
            var bin_id  = 'shadow_remove_'+C.helper.random_alpha_numeric(4)+'_'+M.moment().format('x'); // for storing this call's specific data in B
            B[bin_id]   = {};

            // get is way faster (than filter) since it uses indexes
            if(get) {

                DBQ = SHADOW_GET_BY_INDEX(DBQ, get); 

            // use simplified filter, limit and order_by
            } else {

                DBQ = order_by  ? DBQ.orderBy(SHADOW_GET_ORDER_BY(order_by)) : DBQ; // orderBy MUST be BEFORE filter // orderBy can order all columns, if table has less than 100 000 rows !!! if it has more than that, it can be ordered only by INDEXED columns!!! 
                DBQ = filter    ? DBQ.filter(SHADOW_GET_BY_FILTER(DBQ, filter, bin_id)) : DBQ;
                DBQ = limit     ? DBQ.limit(limit) : DBQ;

            }

            delete B[bin_id];

            var result = await DBQ.delete().run(CONN);
                        
                        // result = { deleted: 5, errors: 0, inserted: 0, replaced: 0, skipped: 2, unchanged: 0, changes: [], (first_error: '' ... only if errors > 0) }
                        // error = { ReqlOpFailedError = string }

            // extend data of result
            result.db       = db_name;
            result.table    = table_name;

            if(result && result.errors === 0 && result.skipped === 0) {

                // check if affected table is in shadow, if yes, trigger actualization among workers
                if(shadow) result.shadow = await C.DB.update_shadow_across_workers({db_data, table_name});
            }
            // let sites handle errors
            /*} else if(result && result.skipped && result.deleted === 0) {

                result = new Error('[e44] Shadow REMOVE - documents to delete not found ('+result.skipped+').');

            } else { result = new Error('[e45] Shadow REMOVE error after updating '+db_name+'.'+table_name+'. (result: '+M.util.inspect(result)+').'); }
            */

        } else { result = new Error('[e45] Error during DB.REMOVE - invalid DB or table.'); }

    } catch(error) { 
        
        error.message   = '[e45] Error during DB.REMOVE - run error: '+error.message;  
        result          = error;

    }

    return result;
    
}

exports.update_shadow_across_workers = async function({db_data={}, table_name=''}={}) {

    var result = {ok: 1, id: '[i40]', text: 'Shadow not to be updated', data: {}, error: null};

    try {

        var db_name = db_data?.NAME;

        var update_shadow_on_this_worker = await C.DB.update_shadow_on_worker({db_name, table_name});

        // try to update on other workers only if there were some shadows to update on this worker and if getting the new shadow went smoothly
        if(update_shadow_on_this_worker.ok) {

            if(update_shadow_on_this_worker.data?.affected_db_connection_names?.length) {

                var update_shadow_on_other_workers  = await C.process.EXECUTE_ON_MASTER({action: 'process.handlers.master.relay_to_the_rest_of_the_workers', 
                                                                                            data:   {     message_for_workers: { 
                                                                                                            action: 'process.handlers.worker.update_shadow_table', 
                                                                                                            data: {db_name, table_name}
                                                                                                        }
                                                                                                    }
                                                                                        });

                var deep_text = C.process.get_final_text_of_worker_to_master_to_workers_action(update_shadow_on_other_workers);

                result.text = 'Successfully updated shadow table ['+table_name+'] on all workers: '+update_shadow_on_this_worker.text+ ' - | -'+deep_text.text;
                result.data = {update_shadow_on_this_worker, update_shadow_on_other_workers};

            } else { /* no shadow to be updated */ }

        } else { result = update_shadow_on_this_worker; }

    } catch(error) { result = {...result, ok: 0, id: '[e73]', error, text: 'Unknown update shadow error: '+error.message }; }

    return result;

}

exports.update_shadow_on_worker = async function({db_name='', table_name=''}={}) {

    var result = {ok: 0, id: '[e85]', text: '', data: {}, error: null};

    try {

        // first find all connections with given DB name, and then update DB shadows of these connections
        let affected_db_connections = {};
        let process_name            = M.cluster.isPrimary ? 'MASTER_process_0' : 'WORKER_process_'+(M.cluster?.worker?.id || '');

        // first look in sites
        M._.forOwn(S, function(SITE, site_name) {

            if(SITE && SITE?.STATE && SITE?.STATE?.loaded && SITE?.STATE?.connected && SITE?.DB?.CONNECTED && SITE?.DB?.READY) {

                if(SITE?.DB?.NAME === db_name && SITE?.DB?.SHADOW?.[table_name]) affected_db_connections[SITE.name] = SITE.DB;

            }

        });

        // then check process DB connection
        if(DBP && DBP?.CONNECTED && DBP?.READY && DBP?.NAME === db_name && DBP?.SHADOW?.[table_name]) affected_db_connections[process_name] = DBP;

        result.data.affected_db_connection_names = Object.keys(affected_db_connections);

        // if there are any connections that have table name in shadow, get the fresh data from the table
        if(M._.size(affected_db_connections)) {

            var affected_db_names   = result.data.affected_db_connection_names;
            var first_db_data       = affected_db_connections[affected_db_names[0]];
            var new_shadow_table    = await C.DB.GET_SHADOW_TABLE({db_data: first_db_data, table_name});

            // successfully got new shadow table data, now just put it into shadow of each DB connection and we are done
            if(new_shadow_table.ok) {

                M._.forOwn(affected_db_connections, function(DB_DATA) { DB_DATA.SHADOW[table_name] = new_shadow_table.data; });

                result.ok   = 1;
                result.id   = '[i57]';
                result.text = 'Successfully updated shadow table ['+table_name+'] of DB connections: ['+affected_db_names.join(',')+'] on worker ['+C.server.worker_id+']';

            } else { result = {...result, error: new_shadow_table?.error, text: 'update_shadow_on_worker ['+C.server.worker_id+'] error: '+new_shadow_table?.error?.message} }

        } else { result = {...result, ok: 1, id: '[i57]', text: 'update_shadow_on_worker - no affected DB connections to update on worker ['+C.server.worker_id+']'}; }

    } catch(error) { result = {...result, error, text: 'Unknown update_shadow_on_worker ['+C.server.worker_id+'] error: '+error.message, }; }

    return result;

}