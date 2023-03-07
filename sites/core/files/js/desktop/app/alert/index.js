const { cloneDeep } = require("lodash");

//exports.create = function({alert, set_alert, alerts_queue, set_alerts_queue, set_active_alert}) {
exports.create = function({new_alert, alert, set_alert}) {

	var alert_to_add 	= new_alert;

	if(alert_to_add && alert_to_add.id) {

		if(alert_to_add.action === 'queue') set_alert({type: 'add_to_queue', alert: alert_to_add});
		if(alert_to_add.action === 'open') set_alert({type: 'open', alert: alert_to_add});

	}

	/*var alert_to_add 	= new_alert;
	var old_alert_state	= alert;
	var new_alert_state = _.cloneDeep(alert);

//console.log('creating new alert: '+new_alert.id+' ('+new_alert.action+')');

	if(alert_to_add && alert_to_add.id) {

		// add to queue, if there is no active alert, open first alert in queue
		if(alert_to_add.action === 'queue') {

			// make sure new alert has unique id
			if(new_alert_state.alerts[alert_to_add.id]) alert_to_add.id = alert_to_add.id + M.helpers.random_alpha_numeric(3, 'alpha');

			new_alert_state.queue.push(alert_to_add.id);
			new_alert_state.alerts[alert_to_add.id] = alert_to_add;

			if( !old_alert_state.active ) {
			
				new_alert_state = S.alert.open_next_in_query({alert: new_alert_state, set_alert});

				console.log('No alert active, opening alert '+new_alert_state.active.id);

			} else {

				var in_q = '';
				new_alert_state.queue.forEach(function(id) {in_q=in_q+', '+new_alert_state.alerts[id].id; })

				console.log('there already is an active alert ('+new_alert_state.active.id+'), alert '+alert_to_add.id+' added to queue ['+in_q+']');

			}

			set_alert(new_alert_state);

		} else if(alert_to_add.action === 'open') {

			
			var in_q = '';
			new_alert_state.queue.forEach(function(id) {in_q=in_q+', '+new_alert_state.alerts[id].id; })
			console.log('Opening alert ('+alert_to_add.header+') without adding it to queue. (QUEUE: '+in_q+')')

			// add new alert to alerts, and add its ID to the beggining of the queue, then close current alert (which will trigger displaying this alert (next in queue))
			new_alert_state.alerts[alert_to_add.id] = alert_to_add;
			new_alert_state.queue.unshift(alert_to_add.id);

			set_alert(new_alert_state);

			// set auto close
			if(alert_to_add.auto_close) WH.alert_timeout = setTimeout(function() { S.alert.close({alert: new_alert_state, set_alert}); }, alert_to_add.auto_close);

			S.alert.close({alert: new_alert_state, set_alert});
			//set_alert(new_alert_state);

		}

	}*/

}

exports.close = function({set_alert}) {

	set_alert({type: 'close'});

/*		console.log('closing alert:'+alert.active.id);

		if(WH.alert_timeout) clearTimeout(WH.alert_timeout);

		var new_alert 			= _.cloneDeep(alert);
			new_alert.active	= null;
			new_alert 			=  S.alert.open_next_in_query({alert: new_alert, set_alert});
*/
	/*	if(WH.alert_timeout) clearTimeout(WH.alert_timeout);

		var new_alert 			= _.cloneDeep(alert);
			new_alert.close 	= 1;
			new_alert.active 	= null;

		set_alert(new_alert);*/


}

exports.new = function({id, type, theme, header, text, action, auto_close} = {}) {

	id 		= id || M.helpers.random_alpha_numeric(4, 'alpha');
	type	= 'basic'; // for now, its the only option
	theme 	= theme || '__INVALID';
	theme	= S.alert.themes[theme] || S.alert.themes.default;
	header 	= header || '';
	text 	= text || '';
	action 	= action || '__INVALID';
	action 	= S.alert.actions[action] || S.alert.actions.default;

	auto_close = parseInt(auto_close);
	auto_close = ( auto_close || auto_close == 0 ) ? auto_close : 10000; // ms ... automatic close of alert, if 0 do not automatically close

	if(!header && !text) header = 'Unknown header';

	return {id, type, theme, header, text, action, auto_close};

}

exports.themes 	= {info: 'info', success: 'success', warning: 'warning', error: 'error', default: 'info'};
exports.actions = {open: 'open', queue: 'queue', default: 'queue'};

exports.open_next_in_query = function({alert, set_alert}) {

	var new_alert = _.cloneDeep(alert);

	if(new_alert.queue && new_alert.queue.length) {
	
		var alert_id 	= new_alert.queue[0]; // show first in queue

		// make the alert active
		new_alert.active = _.cloneDeep(new_alert.alerts[alert_id]) || null;

		// remove the alert from queue and alerts
		new_alert.queue.shift();
		delete new_alert.alerts[alert_id];

		var in_q = '';
		new_alert.queue.forEach(function(id) {in_q=in_q+', '+new_alert.alerts[id]; })

console.log('opening next alert in queue: '+new_alert.active.id+' (old alert: '+(alert?alert.id:'')+'); ALERTS IN QUEUE: '+in_q);

		// set auto close
		if(new_alert.active.auto_close) WH.alert_timeout = setTimeout(function() { S.alert.close({alert: new_alert, set_alert}); }, new_alert.active.auto_close);

		//console.log('Opening next alert ('+new_alert.active.header+').')

	}

	return new_alert;

}