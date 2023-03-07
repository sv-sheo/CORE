
let rr = require.resolve;

exports.get_first = function(object = {}) {
    
    let ret = false;
    
    for(_id in object) { ret = object[_id]; break; }
    
    return ret;
    
}

exports.data_by_key = function(data = {}, key, pluck) {
    
    let ret = {};
    
    if(data && key) {
        
        M._.forIn(data, (value) => {
            
           if(value[key]) {
               
               ret[value[key]] = pluck ? value[pluck] : value;
               
           }
            
        });
        
    }
    
    return ret;
    
}