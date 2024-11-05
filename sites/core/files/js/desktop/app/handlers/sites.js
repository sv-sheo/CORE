

exports.toggle_enabled_state_of_site = async function (e) {

    try {

        let t = e.currentTarget;

        let res = await M.socket.execute('MAIN', 'toggle_enabled_state_of_site', {site: t.dataset.site}, {return: true, timeout: 30});

        if(res.ok) {

            if(res.data.WORKERS) {

                if(res.data.WORKERS.ok) {

                    let total_ok        = 1;
                    let new_state       = 0;

                    _.forEach(res.data.WORKERS.results, function(wres) {

                        A.alert.create({type: (wres.ok?'success':'error'), text: wres.text});

                        new_state = wres.data.new_state;

                        if(!wres.ok) total_ok = 0;

                    });

                    if(total_ok) {

                        let td_doms = document.getElementsByClassName('site_'+t.dataset.site+'_enabled_state');
                        _.forEach(td_doms, function(td_dom) { td_dom.innerHTML = (new_state?'YES':'NO'); })

                    }
                
                } else { A.alert.create({type: 'error', text: res.data.WORKERS.text}); }

            } else { A.alert.create({type: 'error', text: 'toggle_enabled_state_of_site ERROR: WORKERS NOT DEFINED.'}); }

        } else { A.alert.create({type: 'error', text: res.text}); }

    } catch(e) { A.alert.create({type: 'error', text: 'toggle_enabled_state_of_site ERROR: '+e.message}); console.log('toggle_enabled_state_of_site ERROR', e); }

}