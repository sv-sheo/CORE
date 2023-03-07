// needs to be fully synchronous, to prevent other asynchronous methods to execute while waiting for logging
module.exports = function(err) {
    
    var util    = require('util');
    var fs      = require('fs');
    
    var time    = new Date();
    var TIME    = '[' + time.getDate() + '. ' + (time.getMonth() + 1) + '. ' + time.getFullYear() + ' ' + time.getHours() + ':' + time.getMinutes() + ':' +time.getSeconds() + '.' + time.getMilliseconds() + ']';
    var file    = time.getFullYear() + '_' + (time.getMonth() + 1) + '_' + time.getDate()+'.log';
    var error   = '\r\n' + TIME + '\r\nERROR:\r\n' + util.inspect(err) + '\r\n';
        error  += '_________________________________________________________________________\r\n';
    
    fs.appendFileSync('./logs/error/' + file, error);
    
    console.log('__________________________________________\r\n\r\n CAUGHT AND LOGGED UNCAUGHT ERROR \r\n__________________________________________\r\n' + util.inspect(err));
    
    // if core has already been loaded, use SHUTDOWN
    /*if(C.server && C.server.shutdown && M.cluster) {
        
        var process_name    = M.cluster.isMaster ? '[MASTER] ' : '[WORKER '+M.cluster.worker.id+']';
        var trigger         = err.message || '';
            trigger         = process_name+' UNCAUGHT ERROR: ' + trigger;
        
        //if(M.cluster.isMaster) C.server.shutdown(trigger);
        //if(M.cluster.isWorker) process.send({wid: M.cluster.worker.id, action: 'shutdown', trigger: trigger});
       
    // error occured before or during loading of core, exit process ungracefully
    } else {
        
        fs.appendFileSync('./logs/error/' + file, 'UNGRACEFULL SHUTDOWN (core wasnt loaded)\r\n_________________________________________________________________________\r\n');
        process.exit(1); // 1 = exitCode for fatal error
    
    }*/

} 