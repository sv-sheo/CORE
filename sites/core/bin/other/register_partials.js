
exports.main = function(partials = []) {
    
    var partials_to_load = ['section_sub_server_row'];

    partials_to_load.forEach(function(partial) {
        
        if(partials[partial]) M.handlebars.registerPartial(partial, partials[partial]);
        
    });
    
}


exports.admin = function(partials = []) {
    
    var partials_to_load = ['menu', 'file_upload', 'alert'];
    
    partials_to_load.forEach(function(partial) {
        
        if(partials[partial]) M.handlebars.registerPartial(partial, partials[partial]);
        
    });
    
}