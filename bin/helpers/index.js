
exports.prove   = require('./prove'); // VALIDATION
exports.socket  = require('./socket'); 
exports.request = require('./request'); 
exports.config  = require('./config'); 

exports.new_result = ({ ok=0, text='', errors=[], data={} } = {}) => {
    
    return {ok, text, errors, data};
    
}

exports.random_alpha_numeric = function(length = 10, type = 'all') {
        
    length      = parseInt(length) || 10;

    var sets        = {};
        sets.all    = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
        sets.alpha  = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
        sets.numeric= ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

    var set         = sets[type] || false;
    var ret         = '';
    var i           = 0;

    if(set && length) {

        while(i < length) {

            ret         += M._.sample(set); // get random character from array
            i++;

        }

    }

    return ret;

}

exports.data_by_key = function(data = {}, key, pluck) {
    
    let ret = {};
    
    if(data && key) {
        
        M._.forEach(data, (value) => { 
            
            if(value[key]) ret[value[key]] = pluck ? value[pluck] : value; 
        
        });
        
    }
    
    return ret;
    
}

exports.get_first = function(object = {}) {
    
    let ret = false;
    
    for(_id in object) { ret = object[_id]; break; }
    
    return ret;
    
}

// get results from C.promise.parallel result
exports.get_resolved = function(data = {}) {
    
    let ret = {};
    
    M._.forEach(data, (value, key) => { 
            
        if(key !== 'ROOT') {

            if(value.ok && value.status === 'resolved') ret[key] = value.resolved || null;

        }
    
    });
    
    return ret;
    
}

exports.remove_by_keys = function(object_, keys, clone = false) {

    var object = object_;

    if(object && keys) {

        object = clone ? M._.cloneDeep(object_) : object_;

        if(Array.isArray(keys)) {

            M._.forEach(keys, (key) => {

                delete object[key];
                return true;

            })

        } else {

            delete object[keys];

        }


    }

    return object;

}


//  {a: {id: 1, val: 'a'}, b: {id: 2, val: 'b'}, {...}, ...} ---> pluck(obj, 'val') --> {a: 'a', b: 'b'}
exports.pluck = function(object = {}, key_to_pluck) {

    var plucked = {};

    M._.forEach(object, function(val, key) {

        plucked[key] = val[key_to_pluck];

    });

    return plucked;

}

// use for modules that need to be hot-reloaded (loaded again while the server is running to incorporate new changes ... used especially for SITE's BIN)
exports.force_require = function(path) {

    if(path) {

        delete require.cache[path]; // !! path needs to be resolved ... C.helper.force_require(require.resolve(path)) 
        return require(path);

    }

}

exports.now = function() {

    return new Date().getTime();

}

exports.deep_iterate = function(obj={}, fn=()=>{}, path='') {

    if(typeof obj === 'object' && obj !== null && M._.isFunction(fn)) {

        Object.keys(obj).forEach(function(key) { 

            let deeper_path = path + '['+key+']';

            if(typeof obj[key] === 'object') {

                C.helper.deep_iterate(obj[key], fn, deeper_path);

            } else { fn(obj[key], key, deeper_path); }

        });

    }

}

exports.get_server_IP = async function() {

    var ip_timeout = new Promise(function(resolve, reject) {

        setTimeout(function() {

            resolve({ipv4: '0.0.0.0', port: '0', error: new Error('get_server_IP timeout')});

        }, 10000);

        const client = M.net.connect({port: 443, host:"live.com"}, (a, b, c) => {

            try {

                resolve({ipv4: client.localAddress, port: client.localPort, error: null});

            } catch(error) { resolve({ipv4: '0.0.0.0', port: '0', error}); }

        });
        

    }).catch(function(error) { return {ipv4: '0.0.0.0', port: '0', error}});

    var result = await ip_timeout;

    return result;

}

exports.strip_html_tags = function(string) {

    return string.replace(/(<([^>]+)>)/gi, "");

}

exports.prepend_zero_if_smaller_than_10 = function(number=0) {

    number = parseInt(number) || 0;

    return (number < 10 && number >= 0) ? '0'+number : ''+number;

}

// returns true if its anything but error; false if its error
// usage: not_error(var1, var2, ...) OR not_error([var1, var2, ...])
exports.not_error = function() { 
	
	let all_arguments 	= [...arguments];
	let total_ok 		= 1;
	let i 				= 0;

	for(i; i<all_arguments.length; i++) {

		if(all_arguments[i] instanceof Error) {

			total_ok = 0;
			break;

		}

	}

	return total_ok; 

}