<?php 
	header("Content-type:text/html");
	include( dirname(__FILE__) . '/../lib/functions.php');
	enumerate_tree('0'); 
?>
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/HTML4/loose.dtd">
<HTML xmlns="http://www.w3.org/1999/xhtml"
      xmlns:og="http://ogp.me/ns#"
      xmlns:fb="http://www.facebook.com/2008/fbml"> 
<HEAD>
	<title><?php if ($title_cl) { echo $title_cl; } else { echo "Untitled QnA"; } ?></title>
	<meta http-equiv="Content-type" content="text/html;charset=UTF-8"/> 
	<meta name="viewport" content="width=device-width; initial-scale=1.0; maximum-scale=1.0; user-scalable=0;" />
	<meta name="apple-mobile-web-app-capable" content="no" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black" /> 
	<meta property="og:type" content="website"/>
	<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<?php

	if ($title_cl) {
		echo "\t<meta property=\"og:title\" content=\"$title_cl\"/>\n";
	}
	if ($description_cl) {
		echo "\t<meta property=\"og:description\" content=\"$description_cl\"/>\n";
	}
	echo "\t<meta property=\"og:image\" content=\"$og_img\"/>\n";
	if (strlen($query_string) < 4000) {
		echo "\t<meta property=\"og:url\" content=\"".$home.$query_string."\"/>\n";
	}

?>
	<link rel="apple-touch-icon" href="<?php echo $home."images/QnA_300.png" ?>"/> 
	<link rel="stylesheet" href="//code.jquery.com/ui/1.11.1/themes/smoothness/jquery-ui.css">
  	<script src="//code.jquery.com/jquery-1.10.2.js"></script>
  	<script src="//code.jquery.com/ui/1.11.1/jquery-ui.js"></script>
</HEAD>
<BODY BGCOLOR="#ffffff" BACKGROUND="" MARGINWIDTH="0" MARGINHEIGHT="0px" onLoad="startAT('<?php echo $Qpos ?>');">
<?php echo $snippet_output ?>

<?php echo $analytics_code ?>
</BODY>
</HTML>