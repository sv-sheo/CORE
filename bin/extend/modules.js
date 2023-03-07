
//extend util
M.util.is_function = function (x) {
    return Object.prototype.toString.call(x) == '[object Function]';
}

M.util.is_promise = function (x) {

    return x instanceof Promise;

}

M.util.is_regexp = function (x) {

    return x instanceof RegExp;

}

M.util.is_object = function (x) {

    return (x !== null && (typeof x === 'object') && (Object.keys(x).length));

}

M.util.is_array = function (x) {

    return Array.isArray(x);

}

M.util.is_string = function (x) {

    return (typeof x === 'string' || x instanceof String)

}

// returns either Int, Float, OR false (in case of given value couldnt be parsed)
M.util.prove_number = function(x) {
    
    if(typeof x === 'number') return x;
    
    var parsed = parseFloat(x);
    
    return isNaN(parsed) ? false : parsed;
    
}

M.util.clone_object =  function(add) {
    // Don't do anything if add isn't an object
    var origin = {};

    if (!add || typeof add !== 'object') return origin;

    var keys = Object.keys(add);
    var i = keys.length;
    while (i--) {
        origin[keys[i]] = add[keys[i]];
    }
    return origin;

    //EXAMPLE: M.util.clone(object to clone)

};

M.handlebars.registerHelper('if_cond', function (v1, operator, v2, options) {

    switch (operator) {
        case '==':
            return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
            return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
            return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
            return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
            return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
            return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
            return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
            return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
            return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
            return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
            return options.inverse(this);
    }
});