<?php 
	header("Content-type:text/html");
	include( dirname(__FILE__) . '/lib/functions.php');
	enumerate_tree('1'); 
?>
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/HTML4/loose.dtd">
<HTML xmlns="http://www.w3.org/1999/xhtml"
      xmlns:og="http://ogp.me/ns#"
      xmlns:fb="http://www.facebook.com/2008/fbml"> 
<HEAD>
	<meta http-equiv="Content-type" content="text/html;charset=UTF-8"/> 
	<TITLE>QnA Markup</TITLE>
	<meta http-equiv="X-UA-Compatible" content="IE=edge" />
	<meta property="og:title" content="QnA Markup Editor"/>
	<meta property="og:type" content="website"/>
	<meta property="og:url" content="<?php echo $home ?>"/>
	<meta property="og:image" content="<?php echo $home."images/QnA_300.png" ?>"/>
	<meta property="og:site_name" content="QnA Markup"/>
    <?php if ($fb_admin) { echo "\t<meta property=\"fb:admins\" content=\"$fb_admin\"/>\n"; } ?>
	<meta property="og:description" content="An open source tool for turning structured text into an interactive set of questions and answers. Designed for people with no programing experience, it can be used to build expert systems and perform rules-based document construction."/>

	<link rel="stylesheet" type="text/css" href="css/generic.css">
	<link rel="stylesheet" type="text/css" href="css/main.css">
	<link rel="stylesheet" href="css/colpick.css" type="text/css"/>
	
	<script src="http://code.jquery.com/jquery-1.11.1.min.js"></script>	
	<script src="js/colpick.js" type="text/javascript"></script>
	<script src="js/main.js"></script>
</HEAD>

<BODY BGCOLOR="#ffffff" BACKGROUND="" MARGINWIDTH="0" MARGINHEIGHT="0" onLoad="startAT('<?php echo $Qpos ?>');">
<FORM NAME="QNAFORM" ACTION="<?php echo $home ?>" METHOD="POST">
<div id="loading" style="display:none;position:absolute;z-index:100;width:100%;">
<div style="background:yellow;padding:8px 10px;margin:5 auto;width:100px;text-align:center;">
loading...
</div></div>

<div style="position:absolute;top:15px;left:25px;right:25px;overflow:hidden;">
	<? nav_bar($home); ?>
	<font class="header">QnA Markup Editor</font> <sup><font color="gray" size=-2>BETA</font></sup>
</div>
<div class="titleNtabs" style="position:absolute;top:50px;left:25px;right:25px;overflow:hidden;">
	<div class="tab_line"><font class="tabtext">&nbsp;</font></div>
</div>

<input id="tabselect" name="tabselect" type="hidden" value="<?php echo $tabselect ?>"/>
<input id="new" name="new" type="hidden" value="0"/>
<div class="titleNtabs" style="position:absolute;top:50px;left:25px;right:460px;min-width:300px;overflow:hidden;">
	<div id="tab01" class="<?php if ($tabselect == 1 OR $tabselect == "") { echo "tab_top"; } else { echo "tab"; } ?>"><a href="javascript:void('');" onClick="tabtoggle('tab01');" class="tabtext">Markup</a></div>
	<div id="tab02" class="<?php if ($tabselect == 2) { echo "tab_top"; } else { echo "tab"; } ?>"><a href="javascript:void('');" onClick="tabtoggle('tab02');" class="tabtext">Style</a></div>
	<div style="float:left;margin: 0 0 0 15px;">
		<select name="source" onChange="loading();document.getElementById('new').value='1';document.QNAFORM.submit();" class="example">
			<option value="new">Load Template</option>
			<option value="primer">QnA Primer</option>
			<option value="lawreview">Law Journals</option>
			<option value="game">Shall we play a game?</option>
		</select> 
		
		<input id="upload" type="file"/>
		&nbsp;&nbsp;<a href="javascript:void('');" id="upload_link">Load File</a>
		&nbsp;&nbsp;<a href="javascript:void('');" onClick="loading();document.getElementById('new').value='1';document.QNAFORM.submit();">New</a>
	</div>
</div>

<div id="codeblock" style="position:absolute;top:95px;bottom:70px;left:25px;right:460px;<?php if ($tabselect != 1 AND $tabselect != "") { echo "display:none;"; } ?>">
	<textarea id=markup name=markup style="width:100%;height:100%;border: solid 1px #aaa;" onkeydown="insertTab(this, event);"  wrap="<?php if ($wrap == "1") { echo "soft"; } else { echo "off"; } ?>"><?php echo $code ?></textarea>
</div> 

<div id="styleblock" style="position:absolute;top:95px;bottom:70px;left:25px;right:460px;<?php if ($tabselect != 2) { echo "display:none;"; } ?>">

<p>
Use the below settings to control a subset of your output's style options. For more control, use the output pulldown to save output to a file, and edit as much as you like. 
</p>

<div style="float:left;height:145px;margin:0 15px 0 0;">
<table cellpadding="5"><tr><td colspan=2>
<b>Body Text</b>
</td></tr><tr><td>
Font Family:
</td><td>
<select name="font_family" id="font_family" style="width:75px;">
<option value="Arial, Helvetica, sans-serif" <?php if ($font_family == "Arial, Helvetica, sans-serif") { echo "SELECTED"; } ?> >Arial, Helvetica, sans-serif</option>
<option value="'Courier New', Courier, monospace" <?php if ($font_family == "'Courier New', Courier, monospace") { echo "SELECTED"; } ?> >Courier New, Courier, monospace</option>
<option value="'Palatino Linotype', 'Book Antiqua', Palatino, serif" <?php if ($font_family == "'Palatino Linotype', 'Book Antiqua', Palatino, serif") { echo "SELECTED"; } ?> >Palatino Linotype, Book Antiqua, Palatino, serif</option>
<option value="Verdana, Geneva, sans-serif" <?php if ($font_family == "Verdana, Geneva, sans-serif") { echo "SELECTED"; } ?> >Verdana, Geneva, sans-serif</option>

</select>
</td></tr>
<tr><td>
Font Size: 
</td><td>
<input name="font_size" id="font_size" type="number" style="width:50px;" value="<?php echo $font_size ?>"/>
</td></tr>
<tr><td>
Line Height: 
</td><td>
<input name="line_height" id="line_height" type="number" style="width:50px;" value="<?php echo $line_height ?>"/>
</td></tr>
</table>
</div>

<div style="float:left;height:145px;margin:0 15px 0 0;">
<table cellpadding="5"><tr><td colspan=2>
<b>Framing</b>
</td></tr><tr><td>
Max Page Width: 
</td><td>
<input name="col_width" id="col_width" type="number" style="width:50px;" value="<?php echo $col_width ?>"/>
</td></tr>
<tr><td>
Frame Padding: 
</td><td>
<input name="frame_pad" id="frame_pad" type="number" style="width:50px;" value="<?php echo $frame_pad ?>"/>
</td></tr>
<tr><td>
Bubble Radius: 
</td><td>
<input name="radius" id="radius" type="number" style="width:50px;" value="<?php echo $radius ?>"/>
</td></tr>
</table>
</div>

<div style="float:left;height:145px;margin:0 15px 0 0;">
<table cellpadding="5"><tr><td colspan=2>
<b>System Text</b>
</td></tr><tr><td>
BG Color: 
</td><td>
<input name="comp_bg" id="comp_bg" type="text" style="border:solid 1px #<?php echo $comp_bg ?>; border-left: solid 20px #<?php echo $comp_bg ?>;width:55px;z-index:100;" value="<?php echo $comp_bg ?>"/>
</td></tr>
<tr><td>
Text Color: 
</td><td>
<input name="comp_txt" id="comp_txt" type="text" style="border:solid 1px #<?php echo $comp_txt ?>; border-left: solid 20px #<?php echo $comp_txt ?>;width:55px;" value="<?php echo $comp_txt ?>"/>
</td></tr>
<tr><td>
Link Color: 
</td><td>
<input name="comp_link" id="comp_link" type="text" style="border:solid 1px #<?php echo $comp_link ?>; border-left: solid 20px #<?php echo $comp_link ?>;width:55px;" value="<?php echo $comp_link ?>"/>
</td></tr>
</table>
</div>

<div style="float:left;height:145px;margin:0 15px 0 0;">
<table cellpadding="5"><tr><td colspan=2>
<b>User Text</b>
</td></tr><tr><td>
BG Color: 
</td><td>
<input name="usr_bg" id="usr_bg" type=text style="border:solid 1px #<?php echo $usr_bg ?>; border-left: solid 20px #<?php echo $usr_bg ?>;width:55px;" value="<?php echo $usr_bg ?>">
</td></tr>
<tr><td>
Text Color: 
</td><td>
<input name="usr_txt" id="usr_txt" type=text style="border:solid 1px #<?php echo $usr_txt ?>; border-left: solid 20px #<?php echo $usr_txt ?>;width:55px;" value="<?php echo $usr_txt ?>">
</td></tr>
<tr><td> 
Link Color: 
</td><td>
<input name="usr_link" id="usr_link" type="text" style="border:solid 1px #<?php echo $usr_link ?>; border-left: solid 20px #<?php echo $usr_link ?>;width:55px;" value="<?php echo $usr_link ?>"/>
</td></tr>
</table>
</div>

<div style="float:left;width:100%;padding:5px;">
	<b>Sharing Widget</b>
	<p>
		Only available for QnAs with a link. See the note under "link" in the output pulldown for more information. Not included in "HTML snippet" or "HTML full page" outputs.
	</p>
	<p>
	<select name="sharing" id="sharing">
		<option value="1" <?php if ($sharing == 1) { echo "SELECTED"; } ?> >Show</option>
		<option value="2" <?php if ($sharing == 2) { echo "SELECTED"; } ?> >Hide</option>
	</select>
	</p>
	<p>
		<input type="button" value="Restore Defaults" onClick="restoreStyle('');">
	</p>
</div>

</div> 

<div style="position:absolute;height:30px;bottom:25px;left:25px;right:460px;">
	<span style="float:right;">
		<input type=submit value="Update Outputs" onClick="sending=1;loading('');"/>&nbsp;&nbsp;
		<input type="button" value="Save Markup to File" onClick="saveTextAsFile('markup','QnA_markup.txt');">
	</span>
	<div id="wrap_box" <?php if ($tabselect != "1") { echo "style=\"display:none;\" "; } ?>><label><input type=checkbox id="wrap" name="wrap" value="1" onChange="toggle_wrap('');" <?php if ($wrap == "1") { echo "CHECKED"; } ?>/> word wrap</label>
	
	<?php if ($bugs == 1) { echo "&nbsp;&nbsp;|&nbsp;&nbsp;"; } ?>
	</div>
	<span id="bug_report" style="margin-left:5px;"><?php if ($bugs == 1) { echo " <a href=\"https://github.com/colarusso/QnAMarkup/issues\" target=_blank>report bug/issue</a>"; } ?></span></div>
</FORM>

<div style="position:absolute;top:95px;right:25px;width:400px;z-index:1;">
	<?php 
	if ($wellformed == 1) { 
	?>
	<span style="float:right;">
		<select name="output" onChange="disp_output(this.value);">
			<option value="interact" <?php if ($output == "interact") { echo "SELECTED"; } ?> >Interactive</option>
			<option value="link" <?php if ($output == "link") { echo "SELECTED"; } ?> >Link</option>
			<option value="embed" <?php if ($output == "embed") { echo "SELECTED"; } ?> >Embed Code</option>
			<option value="snippet" <?php if ($output == "snippet") { echo "SELECTED"; } ?> >HTML snippet</option>
			<option value="html" <?php if ($output == "html") { echo "SELECTED"; } ?> >HTML full page</option>
		</select>
	</span>
	<?php
	} 
	if ($query_size < 4000 and $wellformed == 1) { 
		echo "<a href=\"i/?".$query_string."\" target=\"_blank\" class=\"header\">Output&nbsp;<img src=\"images/Icon_External_Link.png\" border=\"0px\" width=\"12px\" height=\"12px\"></a>";
	} else if ($query_size >= 4000 and $wellformed == 1) {
		echo "<a href=\"javascript:alert('Your QnA is too big for the link feature. For an explanation, and other options, see the note under \'Link\' or \'Embed Code\' in the output pulldown.')\" class=\"header\">Output&nbsp;<img src=\"images/Icon_External_Link.png\" border=\"0px\"></a>";	
	} else {
		echo "<font class=\"header\">Output</font>";	
	}
	echo "</div>";
	
	if ($wellformed == 1) { 
	?>

<div id="out_interact" class="<?php if ($output == "interact" OR $output == "") { echo "output_active"; } else { echo "output_inactive"; } ?>">
	<?php echo $snippet_output ?>
</div>

<div id="out_link" class="<?php if ($output == "link") { echo "output_active"; } else { echo "output_inactive"; } ?>">

<?php 

	if ($query_size < 4000) { 
		echo "<p>Link to <a href=\"".$home."i/?".$query_string."\" target=_blank>stand-alone QnA</a>.</p>
			<input type=\"text\" style=\"width:100%;\" rows=\"2\" onClick=\"this.select();\" value=\"".$home."i/?".$query_string."\">";
	} else {
		echo "<p>The link feature passes QnA content via GET (as part of the URL). Consequently, there is a limit to how much data a QnA link can handle (how long the URL can be). This QnA is too big to share via the link feature. However, you could copy or save one of the HTML outputs and serve an interactive version on your own.</p>";	
	} 
?>
</div>

<div id="out_embed" class="<?php if ($output == "embed") { echo "output_active"; } else { echo "output_inactive"; } ?>">
<?php 
	if ($query_size < 4000) { 
		echo "<p>Embeddable HTML (iframe). Just cut-and-paste into an HTML document to embed your <a href=\"".$home."i/?".$query_string."\" target=_blank>interactive output</a>.</p><p>Width <input id=frameW value=\"100%\" size=\"4\" onChange=\"updateFrame();\"> Height <input id=frameH value=\"200px\" size=\"4\" onChange=\"updateFrame();\"> (append % or px)</p>
		<textarea id=\"iCode\" style=\"width:100%;height:200px;\" onClick=\"this.select();\"><iframe width=\"100%\" height=\"200px\" src=\"".$home."i/?".$query_string."\"></iframe></textarea>";
	} else {
		echo "<p>The link feature passes QnA content via GET (as part of the URL). Consequently, there is a limit to how much data a QnA link can handle (how long the URL can be). This QnA is too big to share via the link feature. However, you could copy or save one of the HTML outputs and serve an interactive version on your own.</p>";	
	} 
?>
</div>

<div id="out_snippet" class="<?php if ($output == "snippet") { echo "output_active"; } else { echo "output_inactive"; } ?>">
	<p>HTML snippet suitable for placement in an existing webpage.</p>
	<p>
		<input type="button" value="Save Snippet to File" style="width:100%;" onClick="saveTextAsFile('snippet_text','QnA_snippet.html');">
	</p>
	<p>Or cut-and-paste the text below.</p>
	<textarea id="snippet_text" style="width:100%;height:200px;" wrap="off" onClick="this.select();"><?php echo $snippet_output_output ?></textarea>
	<p>Note: in order to render correctly in Internet Explorer, the following needs to be added to the page's header &lt;meta http-equiv="X-UA-Compatible" content="IE=edge" /&gt; </p>

</div>

<div id="out_html" class="<?php if ($output == "html") { echo "output_active"; } else { echo "output_inactive"; } ?>">
	<p>
	HTML, full-page text.
	</p>
	<p>
		<input type="button" value="Save HTML to File" style="width:100%;" onClick="saveTextAsFile('html_text','QnA_page.html');">
	</p>
	<p>Or cut-and-paste the text below.</p>
<textarea id="html_text" style="width:100%;height:200px;" wrap="off" onClick="this.select();"><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"> 
<HTML xmlns="http://www.w3.org/1999/xhtml"
      xmlns:og="http://ogp.me/ns#"
      xmlns:fb="http://www.facebook.com/2008/fbml"> 
<HEAD>
	<title><?php if ($title_cl_textarea) { echo $title_cl_textarea; } else { echo "Untitled QnA"; } ?></title>
	<meta http-equiv="Content-type" content="text/html;charset=UTF-8"/> 
	<meta name="viewport" content="width=device-width; initial-scale=1.0; maximum-scale=1.0; user-scalable=0;" />
	<meta name="apple-mobile-web-app-capable" content="no" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black" /> 
	<meta property="og:type" content="website"/>
<?php
	if ($title_cl_textarea) {
		echo "\t<meta property=\"og:title\" content=\"".$title_cl_textarea."\"/>\n";
	}
	if ($description_cl_textarea) {
		echo "\t<meta property=\"og:description\" content=\"".$description_cl_textarea."\"/>\n";
	}
	echo "\t<meta property=\"og:image\" content=\"$og_img\"/>\n";
	if (strlen($query_string) < 4000) {
		echo "\t<meta property=\"og:url\" content=\"".$home.$query_string."\"/>\n";
	}
?>
	<meta http-equiv="X-UA-Compatible" content="IE=edge" />
	<link rel="apple-touch-icon" href="<?php echo $home."images/QnA_300.png" ?>"/> 
	<link rel="stylesheet" href="//code.jquery.com/ui/1.11.1/themes/smoothness/jquery-ui.css">
  	<script src="//code.jquery.com/jquery-1.10.2.js"></script>
  	<script src="//code.jquery.com/ui/1.11.1/jquery-ui.js"></script>
</HEAD>
<BODY BGCOLOR="#ffffff" BACKGROUND="" MARGINWIDTH="0" MARGINHEIGHT="0" onLoad="startAT('1');"><?php echo $snippet_output_output ?></BODY>
</HTML></textarea>
</div>

<?php
} else {
	echo "<div id=\"out_interact\" class=\"output_active\">$snippet_output</div>";
}

?>


<script type="text/javascript">

// http://stackoverflow.com/a/11844403
var unsaved = false;
var sending = 0;
$("#markup").change(function(){ //trigers change in all input fields including text type
    unsaved = true;
});
function unloadPage(){ 
    if(unsaved && sending != 1){
        return "You have unsaved changes. Do you want to leave this page and discard your changes or stay on this page?";
    }
}
window.onbeforeunload = unloadPage;

// h/t http://answers.splunk.com/answers/125819/fill-textarea-from-a-file.html
 //External data file handling starts here
 var control = document.getElementById("upload");    
     control.addEventListener("change", function(event){    
		if (window.File && window.FileReader && window.FileList && window.Blob) {
			var reader = new FileReader();        
			 reader.onload = function(event){
				 var contents = event.target.result;        
				   document.getElementById('markup').value = contents; 
				   loading();
				   document.QNAFORM.submit();
			 };        
			 reader.onerror = function(event){
				 console.error("File could not be read! Code " + event.target.error.code);
			 };        
			 console.log("Filename: " + control.files[0].name);
			 reader.readAsText(control.files[0]);    
		} else {
			alert('This feature is not supported by your browser.');		
		}
	 }, false);


// h/t https://github.com/josedvq/colpick-jQuery-Color-Picker/
$('#comp_bg').colpick({
	layout:'hex',
	submit:0,
	colorScheme:'light',
	color: '<?php echo $comp_bg ?>',
	onChange:function(hsb,hex,rgb,el,bySetColor) {
		$(el).css('border-color','#'+hex);
		// Fill the text box just if the color was set using the picker, and not the colpickSetColor function.
		if(!bySetColor) $(el).val(hex);
	}
}).keyup(function(){
	$(this).colpickSetColor(this.value);
});

$('#comp_txt').colpick({
	layout:'hex',
	submit:0,
	colorScheme:'light',
	color: '<?php echo $comp_txt ?>',
	onChange:function(hsb,hex,rgb,el,bySetColor) {
		$(el).css('border-color','#'+hex);
		// Fill the text box just if the color was set using the picker, and not the colpickSetColor function.
		if(!bySetColor) $(el).val(hex);
	}
}).keyup(function(){
	$(this).colpickSetColor(this.value);
});

$('#comp_link').colpick({
	layout:'hex',
	submit:0,
	colorScheme:'light',
	color: '<?php echo $comp_link ?>',
	onChange:function(hsb,hex,rgb,el,bySetColor) {
		$(el).css('border-color','#'+hex);
		// Fill the text box just if the color was set using the picker, and not the colpickSetColor function.
		if(!bySetColor) $(el).val(hex);
	}
}).keyup(function(){
	$(this).colpickSetColor(this.value);
});

$('#usr_bg').colpick({
	layout:'hex',
	submit:0,
	colorScheme:'light',
	color: '<?php echo $usr_bg ?>',
	onChange:function(hsb,hex,rgb,el,bySetColor) {
		$(el).css('border-color','#'+hex);
		// Fill the text box just if the color was set using the picker, and not the colpickSetColor function.
		if(!bySetColor) $(el).val(hex);
	}
}).keyup(function(){
	$(this).colpickSetColor(this.value);
});

$('#usr_txt').colpick({
	layout:'hex',
	submit:0,
	colorScheme:'light',
	color: '<?php echo $usr_txt ?>',
	onChange:function(hsb,hex,rgb,el,bySetColor) {
		$(el).css('border-color','#'+hex);
		// Fill the text box just if the color was set using the picker, and not the colpickSetColor function.
		if(!bySetColor) $(el).val(hex);
	}
}).keyup(function(){
	$(this).colpickSetColor(this.value);
});

$('#usr_link').colpick({
	layout:'hex',
	submit:0,
	colorScheme:'light',
	color: '<?php echo $usr_link ?>',
	onChange:function(hsb,hex,rgb,el,bySetColor) {
		$(el).css('border-color','#'+hex);
		// Fill the text box just if the color was set using the picker, and not the colpickSetColor function.
		if(!bySetColor) $(el).val(hex);
	}
}).keyup(function(){
	$(this).colpickSetColor(this.value);
});
</script>

<?php echo $analytics_code ?>

</BODY>
</HTML>
