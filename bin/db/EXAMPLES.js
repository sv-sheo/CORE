
     // RethinkDB
     /*

        ... first argument is DATA_DB = result.data of connect_site_to_DB() method {CONNECTED, READY, CONNECTION, NAME, TABLES}
        ... ... its stored in SITE.DB of each Site, also, each process (master, workers) is connected - this connection is saved in DBP global variable
            
        DB.REMOVE(SITE.DB, 'other', {get: 'test2'}).then(function(ress) {console.log('DDDDDDD', ress)}).catch(function(err) {console.log('', err)});

        // EXAMPLE OF CUSTOM RETHINKDB QUERY
        DB.CHANGE(DBP, 'other', {query: function(DBX) { DBX = DBX.get('test').update({array: DB.row('array').append('c')}); return DBX;}}, {}).then(function(ress) {console.log(ress)}).catch(function(err) {console.log(err)});


     */

     
    // LEGACY - mongoDB
        //DB.GET({db_name: 'sheo', table_name: 'souls', query: function(DBQ) {return DBQ.filter(DB.row('nick').eq('bob'))} })
        /*DB.GET(Q.DB, 'souls', {filter: { id: ['>=', 1]}, order_by: ['nick', 'desc'], limit: 3 })
        .then(function(results) {console.log('DB GET RESULT', results)})
        .catch(function(err) {console.log('DB GET ERROR', err)});*/

        /*DB.SET(Q.DB, 'other', {id: 5, name: 'test4', value: 'popo'})
        .then(function(results) {console.log('DB SET RESULT', results)})
        .catch(function(err) {console.log('DB SET ERROR', err)});*/

        /*DB.REMOVE(Q.DB, 'other', {filter: {name: 'test4'}})
        .then(function(results) {console.log('DB REMOVE RESULT', results)})
        .catch(function(err) {console.log('DB REMOVE ERROR', err)});*/

        /*DB.CHANGE(Q.DB, 'other', {get: 4}, {value: 'ara ara', points: DB.row('points').add(1).default(0)})
        .then(function(results) {console.log('DB CHANGE RESULT OK')})
        .catch(function(err) {console.log('DB CHANGE ERROR', err)});*/

        /*var rawdata = M.fs.readFileSync('content_cms.json');
        var rows = JSON.parse(rawdata);
    M._.forEach(rows, function(doc, key) {

        delete doc['_id'];

        DB.SET('opajda', 'content_cms', doc).catch(function(err) {console.log(err)})

    });*/