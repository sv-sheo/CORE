
exports.init = function() {

	let fd = {}; // formatted data

	let now 				= V.moment().locale(WH.locale);
    let sites               = WH.SD.MASTER.SITES.to_load;
    let site_block_HTML    	= '';
	let worker_count 		= Object.keys(WH.SD.WORKERS).length;

    sites.forEach(function(site_name) {

		site_block_HTML = ' <div class="section_block nm_platform_flat nm_platform_concave">';

		site_block_HTML+= '     <div class="sb_header">SITE '+site_name+'</div>';
		site_block_HTML+= '     <div class="sb_content">';
		site_block_HTML+= '         <table>';
		site_block_HTML+= '             <thead>';
		site_block_HTML+= '                 <tr>';
		site_block_HTML+= '                     <th></th>';
    
   _.forEach( WH.SD.WORKERS, function(worker, wid) { 
            site_block_HTML+= '                     <th>WORKER '+wid+'</th>';
    });

		site_block_HTML+= '                 </tr';
		site_block_HTML+= '             </thead>';
		site_block_HTML+= '             <tbody>';
		site_block_HTML+= '                 <tr>';
		site_block_HTML+= '                     <td>LOADED</td>';

   _.forEach( WH.SD.WORKERS, function(worker, wid) { 

		let loaded 			= worker.SITES[site_name].STATE.loaded;
		let loaded_time		= loaded ? V.moment(loaded).locale(WH.locale).format('L LTS') : 'NO';

        site_block_HTML+= ' 					<td>'+loaded_time+'</td>';
    })

		site_block_HTML+= '                 </tr>';
		site_block_HTML+= '                 <tr>';
		site_block_HTML+= '                     <td>CONNECTED</td>';

   _.forEach( WH.SD.WORKERS, function(worker, wid) {
        site_block_HTML+= ' 					<td>'+(worker.SITES[site_name].STATE.connected?'YES':'NO')+'</td>';
    })

		site_block_HTML+= '                 </tr>';
		site_block_HTML+= '                 <tr>';
		site_block_HTML+= '                     <td>ENABLED</td>';

   _.forEach( WH.SD.WORKERS, function(worker, wid) {
        site_block_HTML+= ' 					<td class="site_'+site_name+'_enabled_state">'+(worker.SITES[site_name].STATE.enabled?'YES':'NO')+'</td>';
    })

		site_block_HTML+= '                 </tr>';
		site_block_HTML+= '                 <tr>';
		site_block_HTML+= '                     <td>REQUESTS in 24 hours</td>';
		site_block_HTML+= '                     <td colspan="'+worker_count+'">0</td>';
		site_block_HTML+= '                 </tr>';
		site_block_HTML+= '                 <tr>';
		site_block_HTML+= '                     <td>REQUESTS in 7 days</td>';
		site_block_HTML+= '                     <td colspan="'+worker_count+'">0</td>';
		site_block_HTML+= '                 </tr>';
		site_block_HTML+= '                 <tr>';
		site_block_HTML+= '                     <td>REQUESTS in 1 month</td>';
		site_block_HTML+= '                     <td colspan="'+worker_count+'">0</td>';
		site_block_HTML+= '                 </tr>';
		site_block_HTML+= '                 <tr>';
		site_block_HTML+= '                     <td>REQUESTS in 1 year</td>';
		site_block_HTML+= '                     <td colspan="'+worker_count+'">0</td>';
		site_block_HTML+= '                 </tr>';
		site_block_HTML+= '                 <tr>';
		site_block_HTML+= '                     <td>REQUESTS ALL-TIME</td>';
		site_block_HTML+= '                     <td colspan="'+worker_count+'">0</td>';
		site_block_HTML+= '                 </tr>';
		site_block_HTML+= '                 <tr>';
		site_block_HTML+= '                     <td></td>';
		site_block_HTML+= '                     <td colspan="'+worker_count+'">';
		site_block_HTML+= '                     	<button class="button_enabled_toggle_button" data-site="'+site_name+'">ENABLE/DISABLE</button>';
		site_block_HTML+= '                     </td>';
		site_block_HTML+= '                 </tr>';
		site_block_HTML+= '             </tbody>';
		site_block_HTML+= '         </table>';
		site_block_HTML+= '     </div>';

		site_block_HTML+= ' </div>';


		DOM.sections.sites.querySelector('.section_flex_container').appendChild(A.DOM.create_element_from_string(site_block_HTML));

    });


	let DOM_enable_buttons = document.getElementsByClassName('button_enabled_toggle_button');

	_.forEach(DOM_enable_buttons, function(DOM_btn) { DOM_btn.addEventListener('click', A.handlers.sites.toggle_enabled_state_of_site)})






}