


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

            ret         += _.sample(set); // get random character from array
            i++;

        }

    }

    return ret;

}

exports.format_currency = function(number, locale, ticker, decimals) {

    return new Intl.NumberFormat(locale,  { 
        
        style: 'currency', 
        currency: ticker, 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals,
    
    }).format(number);

}

// from string like "3,5,8-11,15" returns array [3,5,8,9,10,11,15]; from string like "melons, cit-rons" returns ['melons', 'cit-rons']
exports.get_items_from_ranges = function(ranges = '', limit = 1000) {

    var items = [];
    var items_by_comma = [];
    var i = 0;

    if(items) {

        items_by_comma = ranges.split(',');

        for(i; i < items_by_comma.length; i++) {

            var items_by_dash = items_by_comma[i].split('-');

            if(items_by_dash.length === 1) {

                items.push(items_by_dash[0]);

            } else if(items_by_dash.length === 2) {

                var range_a = parseInt(items_by_dash[0]);
                var range_b = parseInt(items_by_dash[1]);

                if( !Number.isNaN(range_a) && !Number.isNaN(range_b)) {

                    var start   = range_a < range_b ? range_a : range_b;
                    var end     = range_a >= range_b ? range_a : range_b;

                    if((end - start) <= limit) {

                        for(start; start <= end; start++) { items.push(start); }

                    } else {M.log.error('[.get_items_from_ranges] The range is over the limit!'); }


                } else {

                    items.push(items_by_comma[i]);

                }

            }

        }

    }

    return items;

}

// way better performance than _.sortBy
exports.sort_arr_of_objects_by_key = function(arr, order_by) { // order_by = {column: what, direction: "asc" | "desc"}

    var key     = order_by.column;
    
    var sorted  = arr.sort((a,b) => (a[key] > b[key]) ? 1 : (a[key] < b[key]) ? -1 : 0); // by default sorts ascending

        sorted  = order_by.direction === 'desc' ? arr.reverse() : arr;

    return sorted;


}

exports.is_in_array = function(what, array) {

    what  = what || '';
    array = (array && Array.isArray(array)) ? array : [];

    var is_in_array = (array.indexOf(what) > -1) ? true : false;

    return is_in_array;

}

exports.count_decimals_of_float = function(float) {

    var decimals = 0;

    if(float) {

        var integer_part    = Math.trunc(float); // 13.35 -> 13
        var float_part      = float - integer_part;

        var str             = float.toString();
        var split           = str.split('.');

        decimals            = split[1] ? split[1].length : 0;

    }

    return decimals;

}

exports.ms_to_HTML_datetime_input = function(ms) {

    var datetime= ''; //2018-06-07T00:00
        ms      = parseInt(ms) || 0;
    var d       = new Date(ms);
    var mm      = d.getMonth() + 1;
        mm      = mm < 10 ? '0'+mm : ''+mm;
    var dd      = d.getDate();
        dd      = dd < 10 ? '0'+dd : ''+dd;
    var hh      = d.getHours()
        hh      = hh < 10 ? '0'+hh : ''+hh;
    var mn      = d.getMinutes()
        mn      = mn < 10 ? '0'+mn : ''+mn;
 
        datetime= d.getFullYear()+'-'+mm+'-'+dd+'T'+hh+':'+mn;

    return datetime;

}

exports.HTML_datetime_input_to_ms = function(date) {

    var ms = 0;

    if(date) ms = new Date(date).getTime();

    return ms;

}

//  {a: {id: 1, val: 'a'}, b: {id: 2, val: 'b'}, {...}, ...} ---> pluck(obj, 'val') --> {a: 'a', b: 'b'}
exports.pluck = function(object = {}, key_to_pluck) {

    var plucked = {};

    _.forEach(object, function(val, key) {

        plucked[key] = val[key_to_pluck];

    });

    return plucked;

}

exports.date_to_locale_string = function(ms, lang) {

    return (new Date(ms).toLocaleDateString(WH.locales_list[lang]));

}

exports.get_first = function(obj = {}) {
    
    return obj[Object.keys(obj)[0]];

}

exports.to_range = function({number, min, max, decimals}) {
    
    decimals = parseInt(decimals) || 0;
    decimals = decimals < 0 ? 0 : decimals;

    // if decimals is set and is bigger than 0, use floatval
    var parse_ = decimals ? parseFloat : parseInt;
    
    number = parse_(number) || 0;

    // round
    if(decimals) number = parseFloat(number.toFixed(decimals))
    
    if(typeof min === 'number') {
        
        min     = decimals ? parseFloat(min.toFixed(decimals)) : parseInt(min);
        number  = number < min ? min : number;
        
    }
    
    if(typeof max === 'number') {
        
        max     = decimals ? parseFloat(max.toFixed(decimals)) : parseInt(max);
        number  = number > max ? max : number;
        
    }
    
    return number;
    
}