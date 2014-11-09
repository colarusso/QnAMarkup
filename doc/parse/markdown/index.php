<?php 
	include( dirname(__FILE__) . '../../../../lib/functions.php');
	if ($_POST['t']) {
		$t = $_POST['t']; 
		$i = $_POST['i']; 
	} else if ($_GET['t']) {
		$t = $_GET['t'];	
		$i = $_GET['i'];	
	} else {
		header("Location: $home"."doc/");
	}
	include( dirname(__FILE__) . '/Parsedown.php');
	$Parsedown = new Parsedown();
	$t = $Parsedown->text($t);
	include( dirname(__FILE__) . '../../../../lib/ckeditor.php');
?>