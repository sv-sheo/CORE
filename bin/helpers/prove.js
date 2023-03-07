/*
exports.default_errors  = default_errors;
exports.get_error       = get_error;
exports.values          = values_fn;
exports.value           = value_fn;



    EXAMPLES AT THE BOTTOM OF THE FILE
    
    OPTIONS
                required        1|0
                type            "string", "int", ...
                max_length      xy                  only for strings
                min_length      xy                  only for strings
                range_length    {min: xy, max: xy}  only for strings
                max             xy                  only for numbers
                min             xy                  only for numbers
                range           {min: xy, max: xy}  only for numbers
                custom          {test: fn, error: {cz: {}, en: {}, ...}}
                
*/

// validate a single value, return = {ok: <bool>, value: <value>, error: <string error>}
let value_fn = function({value, name = 'Hodnota', lang = 'cz', options = {}, errors = {}}={}, data={}) {  

    let result  = {ok: 0, value: value, error: false};
    let errors_ = M._.merge({}, C.helper.prove.default_errors, errors);
        errors  = errors_;
    
    // REQUIRED
    if(options.required && !value) {
            
            result.error = C.helper.prove.get_error({name, lang, error: 'required', errors});
            return result;
        
    }
    
    if( !M._.isUndefined(value) ) {
    
        // TYPE
        if(options.type && typeof value !== options.type) {

            result.error = C.helper.prove.get_error({name, lang, error: 'type', errors});
            return result;

        }

        // MAX LENGTH - only for string
        if(options.max_length && M._.isString(value) && value.length > options.max_length) {

            result.error = C.helper.prove.get_error({name, lang, error: 'max_length', errors, values: [options.max_length]});
            return result;

        }

        // MIN LENGTH - only for string
        if(options.min_length && M._.isString(value) && options.min_length > value.length) {

            result.error = C.helper.prove.get_error({name, lang, error: 'min_length', errors, values: [options.min_length]});
            return result;

        }

        // RANGE LENGTH - only for string
        if(options.range_length && M._.isString(value) && (options.range_length.min > value.length || options.range_length.max < value.length)) {

            result.error = C.helper.prove.get_error({name, lang, error: 'range_length', errors, values: [options.range_length.min, options.range_length.max]});
            return result;

        }

        // MAX - only for numbers
        if(options.max || options.max === 0) {

            let value_ = parseFloat(value);

            if(M._.isFinite(value_) && value_ > options.max) {

                result.error = C.helper.prove.get_error({name, lang, error: 'max', errors, values: [options.max]});
                return result;   

            }

        }

        // MIN - only for numbers
        if(options.min || options.min === 0) {

            let value_ = parseFloat(value);

            if(M._.isFinite(value_) && options.min > value_) {

                result.error = C.helper.prove.get_error({name, lang, error: 'min', errors, values: [options.min]});
                return result;   

            }

        }

        // RANGE - only for numbers
        if(options.range) {

            let value_ = parseFloat(value);

            if(M._.isFinite(value_) && (options.range.min > value_ || value_ > options.range.max)) {

                result.error = C.helper.prove.get_error({name, lang, error: 'range', errors, values: [options.range.min, options.range.max]});
                return result;   

            }

        }

        // EMAIL
        if(options.email && value) {

            let email_regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

            if( !email_regex.test(value) ) {

                result.error = C.helper.prove.get_error({name, lang, error: 'email', errors});
                return result;   

            }

        }

        // CUSTOM - must be a function
        if(options.custom && M._.isFunction(options.custom.test)) {

            if(!options.custom.test(value, data)) {

                result.error = M._.get(options, ['custom', 'error', lang]) || 'UNDEFINED CUSTOM PROVE ERROR';
                return result;   

            }

        }
        
    }
    
    // SUCCESS
    result.ok = 1;
    return result;
    
}

// validate an object of values return = {ok: <bool>, data: <data>, errors: [<string error>, ...]}
// if strict, removes value from data, that are not in proofs
let values_fn = function({data={}, proofs={}, lang="cz", strict=false}={}) {
    
    let result = {ok: 1, data: data, errors: []}; // by default no errors
    
    // loop data // return false to break
    M._.forIn(data, (value, key, object) => {
        
        // check if it s to be validated
        let proof = proofs[key];
        
        if(proof) {
            
            proof.value = value;
            proof.lang = lang;
            
            let proved = C.helper.prove.value(proof, data);
            
            // error
            if(!proved.ok) {
                
                result.ok = 0;
                result.errors.push(proved.error);
                
            }
            
        } else {
            
            if(strict) delete data[key];
            
        }
        
    });
    
    result.data = data;
    
    return result;
    
} 

let default_errors = {
    
    cz: {
        
        required:   '<name>: povinná hodnota.',
        type:       '<name> je špatného typu.',
        max_length: '<name>: přiliš dlouhá hodnota. Povoleno nejvýše <value1> znaků.',
        min_length: '<name>: přiliš krátká hodnota. Povoleno nejméně <value1> znaků.',
        range_length:'<name>: Hodnota musí mít délku mezi <value1> a <value2> znaky.',
        max:        '<name>: přiliš velká hodnota. Největší povolená hodnota je <value1>.',
        min:        '<name>: přiliš malá hodnota. Nejmenší povolená hodnota je <value1>.',
        range:      '<name>: Hodnota musí být v rozmezí <value1> až <value2>.',
        email:      '<name>: neplatný e-mail.',
        
    },
    
    en: {
        
        required:   '<name> is required.',
        type:       'Wrong type of <name>.',
        max_length: '<name> is too long. Maximum of <value1> characters allowed.',
        min_length: '<name> is too short. Minimum of <value1> characters allowed.',
        range_length: '<name> must be from <value1> to <value2> characters long.',
        max:        '<name> is too big. Allowed maximum is <value1>.',
        min:        '<name> is too small. Allowed minimum is <value1>.',
        range:      '<name> must be between <value1> and <value2>.',
        email:      '<name> is not valid e-mail.',
        
    },
    
    de: {
        
        required:   '<name> wird benötigt.',
        type:       '<name> hat einen falschen Typ.',
        max_length: '<name>: zu lang, maximal <value1> Zeichen erlaubt.',
        min_length: '<name>: zu kurz, mindestens <value1> Zeichen erlaubt.',
        range_length:'<name>: muss von <value1> bis <value2> Zeichen lang sein.',
        max:        '<name>: ist zu groß. Erlaubtes Maximum ist <value1>.',
        min:        '<name>: es ist zu klein. Erlaubtes Minimum ist <value1>.',
        range:      '<name>: es muss zwischen <value1> und <value2> liegen.',
        email:      '<name> ist keine gültige E-Mail.',
        
    }
    
}

function get_error({name = 'Hodnota', lang = 'cz', error = '', errors = {}, values=[]}={}) {
    
    let result = 'UNDEFINED PROVE ERROR';
    
    if(result = M._.get(errors, [lang, error])) {
        
        name    = name[lang] ? name[lang] : name;
        result  = M._.replace(result, '<name>', name);
       
        values.forEach((value, index) => {
            
            result = M._.replace(result, '<value'+(index+1)+'>', value);
            
        });
        
    }
    
    return result;
    
}

exports.default_errors  = default_errors;
exports.get_error       = get_error;
exports.values          = values_fn;
exports.value           = value_fn;


/*

        OPTIONS
                required        1|0
                type            "string", "int", ...
                max_length      xy                  only for strings
                min_length      xy                  only for strings
                range_length    {min: xy, max: xy}  only for strings
                max             xy                  only for numbers
                min             xy                  only for numbers
                range           {min: xy, max: xy}  only for numbers
                custom          {test: fn, error: {cz: {}, en: {}, ...}}



        EXAMPLES
        
        function value({value, name = 'Hodnota', lang = 'cz', options = {}, errors = {}}={})
        function values({data={}, proofs={}, strict=false}={})

USE OF .value()

        EXAMPLES
        
        value({value:x, name: 'ahoj', lang: 'jp', options: {required: 1}, errors: {jp: {required: '...', ...}}})        -> extends errors by japanese languge
        
        value({value:x, name: 'ahoj', lang: 'cz', options: {required: 1, type: 'string', max_length: 8}})         
        
        EXAMPLES OF options
        
        {type: 'number', max: 5}
        {type: 'number', min: 5, max: 10}
        {type: 'number', range: {min: 5, max: 10}}
        
        {required: 1, type: 'string', max_length: 5}
        {type: 'string', min_length: 1}
        {type: 'string', range_length: {min: 5, max: 10}}

        {custom: {test: function(x) { return x%2; }, error: {cz: 'Musi byt lichy.'}  }}



        value_fn({value:  2, name:'cislo', options: {custom: {test: function(x) {return x%2;}, error: {cz: 'musi to byt lichy'}}}});


USE OF .values()

        values({data: data, proofs: {key_of_something_in_data: {<arguments for .value()>}, something_else_in_data: {<arguments for .value()>}}})

        values_fn({data: {name:'Anna', age: 14, lang: 'cz'}, proofs: {name: {options: {required: 1}}, age: {name: 'vek', options: {min: 15}}}, strict: true});









































































*/




