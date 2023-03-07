
exports.increment = C.promise.new(function(resolve, reject, Q, socket, SITE, DB, data, result) {
    
    // check if admin is logged in (if client has rights)
    
    DBS['sheo'].GET('requests', {id: data.request_id}).then((requests) => {
        
        let request = M._.find(requests, (r) => {return r.id === data.request_id});
        
        // got request. now check if the request has been logged in
        if(request) {

            let admin = M._.get(request, 'safe.admin', false);
            
            // admin is logged in -> proceed with increment
            if(admin) {
                
                return DB.CHANGE('counter', {my_id: 1}, {$inc: {value: 1}});
                
            // admin not logged in -> block
            } else {
                
                console.log('NOT AUTHORIZED');
                result.error = C.helper.socket.new_error({id: '[se2]', text: 'Not authorized.'});
                socket.emit('counter_increment', result);
                return new Promise.reject(result.error);
                
            }
            
        // request doesnt exist -> block
        } else {
            
            console.log('INVALID REQUEST');
            result.error = C.helper.socket.new_error({id: '[se1]', text: 'Invalid request.'});
            socket.emit('counter_increment', result);
            return new Promise.reject(result.error);
            
        }
        
    }).then((result) => {
            
            console.log('SUCCESS CHANGE');

            socket.emit('counter_increment', result);
            resolve(result);
        
    }).catch(reject);
    
});
