//https://code.tutsplus.com/tutorials/working-with-indexeddb--net-34673

var log = require('../helpers/log');

exports.connect = function() {
    
    return new Promise(function(resolve, reject) {

        var t		=window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        var n,
            o		= {k:"",v:""},
            r		= t.open('sheo', 1);

        r.onerror           = function(e) { console.log("%c indexedDB CONNECTION ERROR", 'color:red;font-size:2em;font-weight:bold;'); console.log(e); reject(e);}
        r.onsuccess         = function(e) { resolve(this.result); } // resolves with DB
        r.onupgradeneeded   = function(e) { // for first init

            var t = e.target.result.createObjectStore("s",{keyPath:"k"});
            
            t.transaction.oncomplete = function(e) {

                log.time('Created IndexedDB');
                resolve(e.target.db); // resolves with DB

            }
            
            t.transaction.onerror = function(e) {console.log("%c indexedDB UPGRADE ERROR", 'color:red;font-size:2em;font-weight:bold;'); console.log(e); reject(e);}
            
        };
        
    }).then(function(IDB) {

        return new Promise(function(resolve, reject) {
            
            var GET = function(name) {

                return new Promise(function(resolve, reject) {

                    var action = IDB.transaction("s").objectStore("s").get(name)

                    action.onsuccess = function(e) {

                        var result = (e.target.result && e.target.result.v) ? e.target.result.v : null;
                        resolve(result);

                    }

                    action.onerror = function(e) { reject(e); }

                });

            }

            var SET = function(name, value) {

                return new Promise(function(resolve, reject) {

                    var action = IDB.transaction("s","readwrite").objectStore("s").put({k: name, v: value});

                        action.onsuccess = function() { resolve(true); }
                        action.onerror = function(e) { reject(e); }

                });

            }
            
            resolve({SET, GET});
            
        });
    
    });

}

// 2. Setting values
//ldb.set('nameGoesHere', 'value goes here');

// 3. Getting values - callback is required because the data is being retrieved asynchronously:
//ldb.get('nameGoesHere', function (value) {
//  console.log('And the value is', value);
//});