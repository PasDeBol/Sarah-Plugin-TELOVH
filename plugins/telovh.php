<?php

	// Controle les données d'identifications et paramètres
	if (!isset($_POST["password"]) ||  !isset($_POST["identifiant"]) || !isset($_POST["pays"]) || !isset($_POST["pays_code"]) || !isset($_POST["monnumerodeligne"])) {
		$json["erreur"]="--il manque des donnees d'indentification--Plugin mal configure--";
		header("Content-type: application/json");  
		print(json_encode($json));
		return;
		}
		
	// Affecte les paramètres
	$password=$_POST["password"];
	$identifiant=$_POST["identifiant"];
	$pays=$_POST["pays"];
	$pays_code=$_POST["pays_code"]; 
	$monnumerodeligne=$_POST["monnumerodeligne"]; 

	// Déclaration OVH
	$soap = new SoapClient("https://www.ovh.com/soapi/soapi-re-1.61.wsdl");
	$session = $soap->login($identifiant, $password, $pays_code, false);

	if (isset($_GET["call_in"])) {		//telephonyCallList IN 
 		try {
			$result = $soap->telephonyCallList($session, $monnumerodeligne, $pays, "", "", "", "", true, "", "", "");
			$json["call_in"]=$result->list;
		} 
		catch(SoapFault $fault) {$json["erreur"]=$fault;}
	}
	
	if (isset($_GET["call_out"])) {		//telephonyCallList IN
 		try {
			$result = $soap->telephonyCallList($session, $monnumerodeligne, $pays, "", "", "", "", false, "", "", "");
			$json["call_out"]=$result->list;
			//echo json_encode($json);
		} 
		catch(SoapFault $fault) {$json["erreur"]=$fault;}
	}

	if (isset($_GET["delete_message"]) && isset($_GET["filemessage"])) {	//Efface le message
 		try {
			$result = $soap->telephonyVoicemailMailboxDelete ( $session, $monnumerodeligne, $pays, $_GET["delete_message"], "INBOX" );
			$json["delete_message"]=$result->list;
			if ( file_exists ( $_GET["filemessage"].".mp3")) {unlink( $_GET["filemessage"].".mp3" ) ;}	// Efface le fichier
		} 
		catch(SoapFault $fault) {$json["erreur"]=$fault;}
	}
	
	
	if (isset($_GET["message"])) {		//Génère la liste des messages
 		try {
			$result = $soap->telephonyVoicemailMailboxList($session, $monnumerodeligne, $pays, "", "", "", "");
			$json["message"]=$result;
		} 
		catch(SoapFault $fault) {$json["erreur"]=$fault;}
	}

	if (isset($_GET["message_download"])) {		//Génère le fichier MP3 et donne le lien pour Download.
 		try {
			$result = $soap->telephonyVoicemailMailboxList($session, $monnumerodeligne, $pays, "", "", "", "");
			$id=-1;
			foreach ($result as &$message) {
				if ($message->callerid."_".$message->origtime==$_GET["message_download"]) {
					$fileName=$message->callerid."_".$message->origtime.".mp3";
					$id=$message->id; 
					break;
				}
			}
			if ($id>=0) {
				if (!file_exists($fileName)) {	// Créer le fichier si il n'existe pas déjà
					$result_message = $soap->telephonyVoicemailMailboxDownload($session, $monnumerodeligne, $pays, $id, "mp3", "INBOX");
					$datadoc=base64_decode($result_message->fileData);
					$fp = fopen($fileName, 'wb'); // ecrase le fichier existant ou le cree
					fwrite($fp, $datadoc);// ecrit dedans
					fclose($fp);
				}
				$json["url"]= $fileName;
			}
			else {$json["erreur"]="wrong message";}
		} 
		catch(SoapFault $fault) {$json["erreur"]=$fault;}
	}
	
	if (isset($_GET["callnumber"])) {		//APPELLER UN NUMERO;
		try {
			$soap->telephonyClick2CallDoBySession($session, $monnumerodeligne, $_GET["callnumber"], "");
			$json["callnumber"]= "OK";
		} 
		catch(SoapFault $fault) {$json["erreur"]=$fault;}
	
	}
	
// Transmet le JSON de réponse
$soap->logout($session);
header("Content-type: application/json");  
print(json_encode($json));
?>