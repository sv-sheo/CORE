
module.exports = function(handlers) {
    
    // ACTION === EVENT - action name must be the same as event name !!!
    
    return  {
                // action: handler function
                /*'add_doc': M._.get(handlers, 'users.add_doc', false),
                //'get_docs': OBJ.GET(handlers, 'users.get_docs', false),
                'remove_docs': M._.get(handlers, 'users.remove_docs', false),
                'shutdown':         M._.get(handlers, 'users.shutdown', false),
                'refresh_uptime':   M._.get(handlers, 'soul.refresh_uptime', false),
                'refresh_ram_usage':M._.get(handlers, 'soul.refresh_ram_usage', false),*/
        
                'ticker': M._.get(handlers, 'ticker', false),

                'get_server_data': M._.get(handlers, 'get_server_data', false),
        
            };
    
}