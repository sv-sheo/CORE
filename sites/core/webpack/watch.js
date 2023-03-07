const util = require('util');

// exports a function to be used in .run handler
module.exports = (err, stats) => {

    if(err) console.log('WEBPACK ERROR: ', util.inspect(err));

    const info = stats.toJson();
    
    if(stats.hasErrors())   {
        
        console.log('__________________________________________________________________________');
        console.log('ERRORS during compilation.');
        console.log(util.inspect(info.errors));
        console.log('__________________________________________________________________________');
        
    }
    
    if(stats.hasWarnings())   {
        
        console.log('__________________________________________________________________________');
        console.log('WARNINGS during compilation.');
        console.log(util.inspect(info.errors));
        console.log('__________________________________________________________________________');
        
    }
    
        console.log('__________________________________________________________________________');
        console.log('COMPILATION RESULT');
        console.log(stats.toString({colors: true, chunks: false}));
        console.log('__________________________________________________________________________');
    
}