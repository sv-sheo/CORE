
module.exports = async function(SITE) {

    console.log('COOOOOOORE MIDDLEWAAAAAAAAAAAAAAAAAARE');

    SITE.other.register_partials.main(SITE.views.partials);

    return {ok: 1, text: 'Middleware of site '+SITE.name+' loaded.', data: {}, error: null};

}