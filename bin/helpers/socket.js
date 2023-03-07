
exports.new_error = function(data = {}) {
    
    var id      = data.id || '[seX]';
    var text    = data.text || 'Unknown socket error.';
    var error   = data.error || {};
    
    return {id, text, error};
    
}