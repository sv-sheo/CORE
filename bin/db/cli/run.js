
let path            = require('path');
let child_process   = require('child_process');

let config  = {

    pc:     {
                host:   'localhost',
                mongod: 'C:/FRP/RethinkDB/rethinkdb.exe',
                config: 'C:/FRP/RethinkDB/rethinkdb.conf'
            },
    
    laptop: {
                host:   'localhost',
                mongod: 'C:/Program Files/MongoDB/Server/3.4/bin/mongod',
                config: 'C:/Program Files/MongoDB/Server/3.4/bin/mongod.conf'
            },
    
    rpi:    {
                host:   'localhost',
                mongod: '/usr/bin/mongod',
                config: '/etc/mongodb.conf'
            }
    
}

let env = process.argv[2];
    env = ['pc', 'laptop', 'rpi'].indexOf(env) >= 0 ? env : false;
let B   = {};

if(env) {

    var mongod      = path.normalize(config[env].mongod);
    var cfg_file    = path.normalize(config[env].config);
    var spawn       = child_process.spawn;
    
    // create child DB process
    B.MONGO = spawn(mongod, ['--config', cfg_file, '--rest']);
    B.MONGO.stdout.once('data', mongo_started);
    B.MONGO.stderr.once('data', mongo_failed);
    B.MONGO.once('error', mongo_failed);
    
    
} else {
    
    console.log('INVALID ENVIRONMENT: node run <env>');
    console.log('only possible values: pc laptop rpi');
    
}


    
    function mongo_started() {
    
        B.MONGO.stderr.removeAllListeners('data');
        B.MONGO.removeAllListeners('error');

        console.log('MongoDB is up and running.');
        console.log('You can now log in to RoboMongo or use mongo.');

    }
    
    function mongo_failed(reject, err) {
            
        console.log('[MONGO ERROR]', err.toString()); 
        B.MONGO.kill(); 
        console.log('MongoDB failed.')
    
    }
