exports.action = function (data, callback, config, SARAH) {
	// configuration & variables
	if (typeof(config.modules.askme)=="undefined") {callback({'tts':'Erreur. Le pluguine "Téléphonie O.V.H." nécessite l\'installation du pluguine askmi! Merci de regarder la documentation.'});return;}
	var url_askme='http://'+config.http.ip+':'+config.http.port.toString()+'/sarah/askme';
	var url_telovh='http://'+config.http.ip+':'+config.http.port.toString()+'/sarah/telovh';

	config = config.modules.telovh;
	var moment = require('moment');
	console.log('plugin telovh - demande: '+data.action);

	// ****************************************
	// ********** READ MESSAGE        *********
	// ****************************************
	if (data.action=='ecouter_message') {
		if (typeof(SARAH.context.telovh.messagesvocaux)!="undefined") { 																												// Check if context exist
			if (typeof(data.action_message)!="undefined") 
				{message_to_listen=SARAH.context.telovh.message_to_listen+1;delete SARAH.context.telovh.message_to_listen; SARAH.context.telovh.message_to_listen=message_to_listen;}	// Next message (+1)
			else 
				{message_to_listen=SARAH.context.telovh.message_to_listen;}																												// Read message again
			if (typeof(SARAH.context.telovh.messagesvocaux[message_to_listen])=="undefined")  {callback({'tts':'tous les messages ont été écoutés'}); return;}							// Check message_to_listen
			if (message_to_listen==0) {SARAH.speak('Un instant...');} else {SARAH.speak('message suivant');}
			// Request to telovh.php
			var url=config.url_php+'telovh.php?message_download='+SARAH.context.telovh.messagesvocaux[message_to_listen].message;
			request_telovh_php(url, callback, function (json) {
				if (json==false) {return;}
				if (json.url){
					// Tel Number format-> 00 00 00 00 00
					phonenumber=SARAH.context.telovh.messagesvocaux[message_to_listen].du.substr(0,2) + ' ' + SARAH.context.telovh.messagesvocaux[message_to_listen].du.substr(2,2) + ' ' + SARAH.context.telovh.messagesvocaux[message_to_listen].du.substr(4,2) + ' ' + SARAH.context.telovh.messagesvocaux[message_to_listen].du.substr(6,2) + ' ' + SARAH.context.telovh.messagesvocaux[message_to_listen].du.substr(8,2);
					// Date Format
					moment.lang('fr');
					var datemessage = moment.unix(parseInt(SARAH.context.telovh.messagesvocaux[message_to_listen].le)).local();
					var datejour=moment();
					if (datemessage.format("dddd D MMMM")==datejour.format("dddd D MMMM"))																	//TODAY
						{textedatemessage=' aujourd\'hui à '+datemessage.format("HH")+'H'+datemessage.format("mm")+' ';}
					else if (datemessage.format("MMMM")==datejour.format("MMMM")) 																			// THIS MONTH
						{textedatemessage=' ' + datemessage.format("dddd D")+' à '+datemessage.format("HH")+'H'+datemessage.format("mm")+' ';}
					else 
						{textedatemessage=' '+datemessage.format("dddd D MMMM")+' à '+datemessage.format("HH")+'H'+datemessage.format("mm")+' ';}			// OTHER MONTH
					// Introduce message
					if (message_to_listen==0) 
						{SARAH.speak("message du "+phonenumber+", reçu "+textedatemessage);}
					else
						{SARAH.speak(" du "+phonenumber+", reçu "+textedatemessage);}
					// Timeout -> Play message
					setTimeout(function(){SARAH.play(config.url_php+json.url);}, 10000);	
					// Timeout -> Ask question
					setTimeout(function(){
						sendaskme_findumessage(callback, SARAH.context.telovh.messagesvocaux[message_to_listen].id,message_to_listen,SARAH.context.telovh.messagesvocaux[message_to_listen].du);
						
					}, (11000+(SARAH.context.telovh.messagesvocaux[message_to_listen].duree*1000)));	
				}
			});	
		}
		callback();
	}

	// **************************************************
	// **********        SEARCH MESSAGES         ********
	// **************************************************
	else if ((data.action=='message') || (data.action=='message_from_plugin')) { 
		if (data.action!='message_from_plugin') {SARAH.speak('Je regarde...');}
		if (typeof(SARAH.context.telovh)=="undefined") {SARAH.context.telovh={};}
		SARAH.context.telovh.messagesvocaux={};
		var url=config.url_php+'telovh.php?message';
		request_telovh_php(url, callback, function (json) {
			if (json==false) {return;}
			if (json.message){
				var nb_INBOX=0;
				var listemessage=[];
				for (var i = 0; i < json.message.length; i++) {
					if ((json.message[i].folder)=='INBOX') {	//Search Message only in INBOX 
						nb_INBOX++;
						// Json 
						listemessage.push({"id":parseInt(json.message[i].id),"du":json.message[i].callerid,"le":parseInt(json.message[i].origtime),"de":json.message[i].duration,"message":json.message[i].callerid+'_'+json.message[i].origtime,"duree":json.message[i].duration}); 			
						SARAH.context.telovh.messagesvocaux=listemessage;
					}
				}
				//Reset message_to_listen 
				SARAH.context.telovh.message_to_listen=0;	
				if (nb_INBOX==0) {
					if (data.action!='message_from_plugin') {callback({'tts':'Il n\'y a aucun message'});} else {callback();}
					}
				else {
					SARAH.context.telovh.message_nb=nb_INBOX;
					sendaskme_ecoutermessage(callback, nb_INBOX, function (rep) {
						if (rep==true) {callback();};
					});
				}
			}
		});
	}

	// **************************************************
	// **********      DELETE A MESSAGE          ********
	// **************************************************
	else if (data.action=='effacer_message') {
		if (typeof(data.id_message)=="undefined") {callback({'tts':'Numdéro de message inexistant. Suppression impossible'}); return;}
		var url=config.url_php+'telovh.php?delete_message='+data.id_message+'&filemessage='+SARAH.context.telovh.messagesvocaux[data.message_to_listen].message;
//		console.log('URL effacement :  '+url);
		request_telovh_php(url, callback, function (json) {
			if (json==false) {return;}
			var request = require('request');
				request({ 'uri' : url_telovh+'?action=ecouter_message&action_message=suivant' }, function (err, response, body){
					if (err || response.statusCode != 200) {
						console.log("L'action a échouée:"+err+" - "+response.statusCode);
						callback({'tts': "L'action a échoué"});
						return;
					}
				});
			callback({'tts':'Message supprimé!'});
		});
	}
	
	// **************************************************
	// **********        CALL A NUMBER           ********
	// **************************************************
	else if ((data.action=='callnumber') && (typeof(data.numbertocall)!="undefined")) { 
		var url=config.url_php+'telovh.php?callnumber='+data.numbertocall;
		SARAH.speak('Je compose le numéro!');
		request_telovh_php(url, callback, function (json) {
			if (json==false) {return;}
			if (json.callnumber=='OK'){callback();}
		});
	}
	
	else {callback();}


	function request_telovh_php(url, callback, rep_json){
		var request = require('request');
		request({
				'uri' : url,
				'method': 'POST',
				'form': { identifiant : config.OVH_identifiant,	password : config.OVH_password, pays : config.OVH_pays,pays_code : config.OVH_pays_code, monnumerodeligne : config.OVH_monnumerodeligne}
				}, function (err,response, json){
				if (err || response.statusCode != 200) {
					console.log("L'action a échouée:"+err+" - "+response.statusCode);
					callback({'tts': "L'action a échouée"});
					return false;
					}

				try {json=JSON.parse(json)}
				catch (e) {
					callback({'tts': "L'action a échouée"});
					console.log('plugin telovh - ERREUR - telovh.php ne semble pas avoir répondu un JSON');
					console.dir(json);
					return false;
				}	
				if (typeof(json.erreur)!='undefined') {
					console.log("L'action a échouée, telovh.php à répondu:"+json.erreur);
					console.dir(json);
					callback({'tts': "L'action a échouée"});
					return false;
					}
				return rep_json(json);
		});
		
	}

	function send_request_askme(callback,json,rep) {
		var request = require('request');
		console.log('url_askme:'+url_askme);
		request({ 
				'uri': url_askme,
				'method': 'POST',
				'json': json
				}, function (err, response, body){
					if (err || response.statusCode != 200) {
						callback({'tts':'error'});
						return rep(false);
						}
				return rep(true);
				});
	}

	function sendaskme_ecoutermessage(callback, nb_messsages, rep) {
		var json={"request":{"question":"","answer":[],"answervalue":[],"recall":false}};
		if (nb_messsages==1) 
			{json.request.question="Tu as un seul message, veux tu l\'écouter?";}
		else
			{json.request.question="Tu as "+nb_messsages+" messages, veux tu les écouter?";}
		json.request.answer=["oui s\'il te plait","non merci"];
		json.request.answervalue=[url_telovh+"?action=ecouter_message",url_askme+"?test=Lecture des messages annulée"];
		send_request_askme(callback,json,function (reponse) {return rep(reponse);});
	}

	function sendaskme_findumessage(callback, id_messsage,message_to_listen,numbertocall, rep) {
		var json={"request":{"question":"","answer":[],"answervalue":[],"no_answervalue":"","timeout":15,"recall":false}};
		if (typeof(SARAH.context.telovh.messagesvocaux[message_to_listen+1])=="undefined") {
			json.request.question="Fin du dernier message. Effacer, Répéter, Terminer?";
			json.request.answer=["Effacer","Répéter","Terminer"];
			json.request.answervalue=[url_telovh+"?action=effacer_message&id_message="+id_messsage+'&message_to_listen='+message_to_listen,url_telovh+"?action=ecouter_message",url_askme+"?test=tous les messages ont été consultés."];
			json.request.no_answervalue=url_askme+"?test=tous les messages ont été consultés.";
		}
		else {
			json.request.question="Fin du message. Effacer, Répéter, Rappeler ce numéro, suivant, terminé?";
			json.request.answer=["Effacer","Répéter","Rappeler ce numéro","Suivant","Terminer"];
			json.request.answervalue=[url_telovh+"?action=effacer_message&id_message="+id_messsage+'&message_to_listen='+message_to_listen,url_telovh+"?action=ecouter_message",url_telovh+"?action=callnumber&numbertocall="+numbertocall,url_telovh+"?action=ecouter_message&action_message=suivant",url_askme+"?test=Lecture des messages annulée"];
			json.request.no_answervalue=url_telovh+"?action=ecouter_message&action_message=suivant";
		}
		send_request_askme(callback,json,function (reponse) {return rep(reponse);});
	}
}