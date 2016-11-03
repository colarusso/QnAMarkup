<?php 

# TODO Notes:
# double triple check encoding url for links et al
# fix title tag on stand alone
# add meta data to engine and standalone
# what are \n added on edit this link?

# Set Error Reporting
error_reporting(0);

# Load common configuration file
include 'config.php';

function enumerate_tree($editor) {
	# $editor = 1 if called from editor
	# $editor = 0 if called from interactive

	# ----------------------------------
	# Define scope of global variables
	# ----------------------------------
	# The following variables should
	# be accessible to the page that 
	# called this function. 

	# Site variables
	global $home;
	global $bugs;	
	global $analytics_code;	
	
	# Values for OpenGraph metadata
	global $title_cl;
	global $title_cl_textarea;
	global $description_cl;
	global $description_cl_textarea;
	global $og_img;
	global $fb_admin;

	# Editor settings
	global $tabselect;
	global $wrap;
	global $output;

	# Style settings
	global $font_family;
	global $font_size;
	global $line_height;
	global $col_width;
	global $frame_pad;
	global $radius;
	global $comp_bg;
	global $comp_txt;
	global $comp_link;
	global $usr_bg;
	global $usr_txt;
	global $usr_link;
	global $sharing;	
	
	# Input 
	global $source;

	# Output 
#	global $ordercheck;
	global $wellformed;
	global $errormsg;
#	global $questions;	
#	global $answers;
	global $snippet_output;
	global $snippet_output_output;
	global $query_string;
#	global $compressed_q;
	global $query_size;
	global $code;
	
	#position
	global $Qpos;

	# ----------------------------------
	# Define variable values
	# ----------------------------------
		
	# Test to see if we should be reading GET or POST
	# by checking for values that will always be present
	if ($_GET['markup'] != "" OR $_GET['source'] != "") {
		$method = "GET";
	} else {
		$method = "POST";	
	}
	
	# If variables sent via POST
	if ($method == "POST" and $editor == 1) {
		# Note: the interactive viewer does not accept data via POST

		# Read style settings 
		$font_family = $_POST['font_family'];
		$font_size = $_POST['font_size'];
		$line_height = $_POST['line_height'];
		$col_width = $_POST['col_width'];
		$frame_pad = $_POST['frame_pad'];
		$radius = $_POST['radius'];
		$comp_bg = $_POST['comp_bg'];
		$comp_txt = $_POST['comp_txt'];
		$comp_link = $_POST['comp_link'];
		$usr_bg = $_POST['usr_bg'];
		$usr_txt = $_POST['usr_txt'];
		$usr_link = $_POST['usr_link'];	
		$sharing = $_POST['sharing'];
		$Qpos = $_POST['start'];
				 
		# Determine if markup should be loaded from a file. 
		if ($_POST['source'] != "" and $_POST['new'] != "0") {
			# This function is being called from the editor, 
			# and is asking to load the markup from a file.
			# Load the markup from file 
			$content = from_file($_POST['source']); 
			# Force the editor's tab to Markup
			$tabselect = 1;
			# Set template pulldown value to the appropriate file name.
			$source = $_POST['source'];
			# Read editor settings 
			$wrap = $_POST['wrap'];  
			$output = $_POST['output'];  
		} else {
			# This function is being called from the editor, 
			# If markup and tabselect are empty,
			# assume that page is a fresh load and load default markup
			if (!$_POST['markup'] and !$_POST['tabselect']) { 
				$content = from_file("primer"); 
			} else {
				$content = $_POST['markup']; 
			}
			# Read editor settings 
			$tabselect = $_POST['tabselect'];
			if ($tabselect == "") { $tabselect = 1; }
			$wrap = $_POST['wrap'];  
			$output = $_POST['output'];  
		}		
		
	# If variables sent via GET
	} else {
		# Load style settings 
		$font_family = $_GET['font_family'];
		$font_size = $_GET['font_size'];
		$line_height = $_GET['line_height'];
		$col_width = $_GET['col_width'];
		$frame_pad = $_GET['frame_pad'];
		$radius = $_GET['radius'];
		$comp_bg = $_GET['comp_bg'];
		$comp_txt = $_GET['comp_txt'];
		$comp_link = $_GET['comp_link'];
		$usr_bg = $_GET['usr_bg'];
		$usr_txt = $_GET['usr_txt'];
		$usr_link = $_GET['usr_link'];	
		$sharing = $_GET['sharing'];
		$Qpos = $_GET['start'];

		# Determine if markup should be loaded from a file. 
		if ($editor == 1 and $_GET['source'] != "" and $_GET['new'] != "0") {
			# This function is being called from the editor, 
			# and is asking to load the markup from a file.
			# Load the markup from file 
			$content = from_file($_GET['source']);
			# Force the editor's tab to Markup
			$tabselect = 1;
			# Set template pulldown value to the appropriate file name.
			$source = $_GET['source'];
			# Read editor settings 
			$wrap = $_GET['wrap'];  
			$output = $_GET['output'];  
		} else if ($editor == 1) {
			# This function is being called from the editor, 
			# If markup and tabselect are empty,
			# assume that page is a fresh load and load default markup
			if (!$_GET['markup'] and !$_GET['tabselect']) { 
				$content = from_file("primer"); 
			} else {
				$content = $_GET['markup']; 
			}
			# Read editor settings 
			$tabselect = $_GET['tabselect'];
			if ($tabselect == "") { $tabselect = 1; }
			$wrap = $_GET['wrap'];  
			$output = $_GET['output'];  
		} else if ($editor == 0 and $_GET['source'] != "") {
			# This function is being called from the stand-alone viewer, 
			# and asking to load the markup from a file 
			# Load the markup from file 
			$content = from_file($_GET['source']);
			# find preview image
			$og_img = og_img($home,$content);
		} else if ($editor == 0) {
			# This function is being called from the stand-alone viewer.
			# If markup is empty, load default
			if ($_GET['markup']) { 
				$content = $_GET['markup'];  
			} else {
				$content = from_file("primer"); 
			}
			# find preview image
			$og_img = og_img($home,$content);
		}
	}

	# Remove slashes that may have been added to markup in transit. 
	$content = stripslashes($content); 		
	
	# Set style defaults in the absence of alternatives 
	if (preg_match("/^([a-zA-Z,\s-'])+$/", stripslashes($font_family)) != 1) { $font_family = "Verdana, Geneva, sans-serif"; } else {  $font_family = stripslashes($font_family); }	
	if (preg_match("/^\d+$/", $font_size) != 1) { $font_size = "14"; }
	if (preg_match("/^\d+$/", $line_height) != 1) { $line_height = "20"; }
	if (preg_match("/^\d+$/", $col_width) != 1) { $col_width = "500"; }
	if (preg_match("/^\d+$/", $frame_pad) != 1) { $frame_pad = "15"; }
	if (preg_match("/^\d+$/", $radius) != 1) { $radius = "15"; }
	if (preg_match("/^(\d|[a-z]){6}$/", $comp_bg) != 1) { $comp_bg = "5489eb"; }
	if (preg_match("/^(\d|[a-z]){6}$/", $comp_txt) != 1) { $comp_txt = "ffffff"; }
	if (preg_match("/^(\d|[a-z]){6}$/", $comp_link) != 1) { $comp_link = "e3fbfc"; }
	if (preg_match("/^(\d|[a-z]){6}$/", $usr_bg) != 1) { $usr_bg = "eeeeee"; }
	if (preg_match("/^(\d|[a-z]){6}$/", $usr_txt) != 1) { $usr_txt = "000000"; }
	if (preg_match("/^(\d|[a-z]){6}$/", $usr_link) != 1) { $usr_link = "0000ff"; }
	if ($sharing == "") { $sharing = "1"; }	
	if (!$Qpos) { $Qpos = "1"; }

	# Prep for Error Checks
	# ----------------------------------	
	# Start with the assumption that QnA 
	# code is valid until proven otherwise 
	$wellformed = 1;
	# Start with an empty error message. 
	$errormsg = "";
	
	# Check for GOTO ambiguity
	# ----------------------------------		
	# See if the targets of any GOTO statements are 0 or > than 1. 
	# If they are, replace them with GOTO:???? or GOTO:???		
	preg_match_all("/GOTO:\s?([a-z0-9\._-]*)\s*(\n|$)/", $content, $gotos);
	foreach ($gotos[0] as $gvalue) {
		$regex = preg_replace("/GOTO:/", "", $gvalue);
		$regex = preg_replace("/(\s|\n)/", "", $regex);
		$regex_label = preg_replace("/\./", "\.", $regex);
		$regex = "/(^|\n)+\t*(Q\($regex_label\):)/i";
		# If they point at nothing 
		if (!preg_match($regex, $content)) {
			$regex = "/GOTO:\s?$regex_label/i";
			$content = preg_replace($regex, "GOTO:????", $content);	
		# If they point to more than one location
		} else if (preg_match_all($regex, $content,$gt) > 1) {
			$regex = "/GOTO:\s?$regex_label/i";
			$content = preg_replace($regex, "GOTO:???", $content);			
		}
	}

	# ----------------------------------
	# Parse tags
	# ----------------------------------
	
	# Define regex for non-header tags
	$regex = '/(^|\n)\t*((Q(\((.*)\))?|X|DOC\(?(\d?)(.\s*\d+)*\)?):|A((\(.*\))|)((\[[^\]]*\])+:|:(\[[^\]]*\])?))/';
	# Split content based no header tags. 
	$text = preg_split($regex, $content);
	# Define regex to split into Q blocks
	$regex_q = '/(^|\n)\t*(Q(\((.*)\))?:)/';
	# Split content based Q tags only. 
	$question_array = preg_split($regex_q, $content);
	# Get non-header tag contents. 	
	$hits = preg_match_all($regex,$content,$matches,PREG_PATTERN_ORDER);	
	
	# Parse header $text[0] for tags
	$regex_cred = '/^(Title|Author|Description|Before|After):/im';
	$credits = preg_split($regex_cred, $text[0], -1, PREG_SPLIT_NO_EMPTY);	
	$credit_hits = preg_match_all($regex_cred,$text[0],$cred_matches, PREG_PATTERN_ORDER);
	$n = 0;
	foreach ($cred_matches[0] as $value) {
		if (preg_match("/title:/i",$value)) {
			$title = $credits[$n];
			$title = preg_replace("/\s*$/", "", $title);
		} else if (preg_match("/author:/i",$value)) {
			$author = $credits[$n];		
			$author = preg_replace("/\s*$/", "", $author);
		} else if (preg_match("/description:/i",$value)) {
			$description = $credits[$n];
			$description = preg_replace("/\s*$/", "", $description);
		} else if (preg_match("/before:/i",$value)) {
			$before = $credits[$n];		
		} else if (preg_match("/after:/i",$value)) {
			$after = $credits[$n];		
		}
		$n++;
	}
	# Clean up header tag contents for use in metadata
	$title_cl = preg_replace("/<[^>]*>/", "", $title);
	$title_cl = preg_replace("/^\s*|\n*|\r*/", "", $title_cl);
	$title_cl = htmlentities($title_cl); 
	$description_cl = preg_replace("/<[^>]*>/", "", $description);
	$description_cl = preg_replace("/^\s*|\n*|\r*/", "", $description_cl);
	$description_cl = htmlentities($description_cl);
	# "clean" twice anything that will go in an output text area.
	$title_cl_textarea = htmlentities($title_cl);
	$description_cl_textarea = htmlentities($description_cl);
	
	# Read header into $code for later output
	$code = $text[0];

	# Set counters et al
	$numberline = "";
#	$ordercheck = "";
	$lastnest = -1;
	$lastvalue = "";
	$Qnode = 0;
	$i = 1;
	$iq = 0;
	$ia = 0;
	foreach ($matches[0] as $value) {
		#count nesting of this tag
		$nested = preg_match_all("/\t/",$value,$mo);		
		
		# For Q tags
		if (preg_match("/Q(\((.*)\))?:/", $value)) {
			# For Q tags that start a line w/o indents
			if ($nested == 0) {
				$lastnest = -1;
				$Qnode++;
			}	
			# Build Q ID, assign to label
			$numberline[$nested] = 0;
			$label = $Qnode;
			$j=0;
			while($j < $nested and $numberline[$j]){
				$label = $label.".".$numberline[$j];
				$j++;
			}

			# If a Q target number is changing since submit, change any GOTO statements that point to it. 
			# We add in the "hold:" to stop subsequent changes to updated GOTO calls. 
			$regex_label = preg_replace("/\./", "\.", $label);
			$regex = "/Q\($regex_label\):/";
			preg_match('/Q\((.*)\):/', $value, $matches);			
			$regex_label_2 = preg_replace("/\./", "\.", $matches[1]);
			$regex_2 = "/Q\($regex_label_2\):/";
			$regex_goto = preg_replace("/Q|\(|\)|:|\n|\t/", "", $value);
			$regex_goto = "/GOTO:\s?$regex_goto/";
			if (preg_match($regex, $value) != 1 AND preg_match($regex_2, $value) != 1 AND $regex_goto != "/GOTO:\s?/") {
				$l = 0;
				foreach ($text as $tvalue) {
					# I've added the ":hold" to be sure that the GOTO isn't changed on 
					# subsequent passes through the loop. We'll remove it below.
					$text[$l] = preg_replace($regex_goto, "GOTO:hold:$label", $tvalue);
					$l++;
				}
			}

			# Update Q target ID with current label
			$qvarname[$iq][0] = $label;
			# be sure to replace things that look like the number id but not those that don't (custom ids must include letters)
			preg_match('/Q\(((\d*)(\.\d)*)?\):/', $value, $matches);
			if ($matches[1] != "" or preg_match('/Q\(\):/', $value) or preg_match('/Q:/', $value) ) {
				$value = preg_replace("/Q(\((.*)\))?:/", "Q($label):", $value);
				$qvarname[$iq][1] = $label;				
			} else {
				preg_match('/Q\((.*)\):/', $value, $matches);			
				$qvarname[$iq][1] = $matches[1];							
			}


			# If Q is not indented once from the last nest, throw an error.
			if (($nested+(-1)*$lastnest) != 1) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$near = preg_replace("/</", "&lt;", $near);
				$near = preg_replace("/>/", "&gt;", $near);
				$errormsg = $errormsg."<li class=\"error\">Misaligned Q. Error near:<br><code>$near</code></li>";
			}

			# If the preceding tag was a Q, make sure this Q is on a new line (i.e., $lastnest == -1)
			if (preg_match("/Q(\((.*)\))?:/", $lastvalue) AND $lastnest != -1) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$near = preg_replace("/</", "&lt;", $near);
				$near = preg_replace("/>/", "&gt;", $near);
				$errormsg = $errormsg."<li class=\"error\">Mismatched Q and Q. Error near:<br><code>$near</code></li>";
			}
			
			
			# GOTO Errors
			if (preg_match("/GOTO:\?\?\?\?/i", $text[$i])) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$near = preg_replace("/</", "&lt;", $near);
				$near = preg_replace("/>/", "&gt;", $near);
				$errormsg = $errormsg."<li class=\"error\">The target of a GOTO call is missing/was removed. Look for \"GOTO:????\" near:<br><code>$near</code></li>";			
			} else if (preg_match("/GOTO:\?\?\?/i", $text[$i])) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$near = preg_replace("/</", "&lt;", $near);
				$near = preg_replace("/>/", "&gt;", $near);
				$errormsg = $errormsg."<li class=\"error\">The target of a GOTO showed up more than once. So we weren't sure what to do other than disable the call. Look for \"GOTO:???\" near:<br><code>$near</code></li>";			
			} else if (preg_match("/GOTO:/i", $text[$i]) and preg_match("/(GOTO:(hold:)?([a-z0-9\._-]*)\s*)$/i", $text[$i]) == 0) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$near = preg_replace("/</", "&lt;", $near);
				$near = preg_replace("/>/", "&gt;", $near);
				$errormsg = $errormsg."<li class=\"error\">Poorly-formed GOTO call. Error near:<br><code>$near</code></li>";
			}
			
			# If variable_name containes unallowed characters.
			if (preg_match_all("/^(([a-z0-9\._-]*)|((\d*)(\.\d)*))$/i", $qvarname[$iq][1], $mx) != 1) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$errormsg = $errormsg."<li class=\"error\">Variable names must contain only letters, numbers, periods, underscores, or dashes. Error near:<br><code>$near</code></li>";
			} 
			
			# If variable_name is not unique, throw an error
			if (preg_match_all("/^((\d*)(\.\d*)*)$/", $content, $mx) == 0 and preg_match_all("/Q\(".$qvarname[$iq][1]."\):/", $content, $mx) > 1) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$errormsg = $errormsg."<li class=\"error\">Variable names must be unique (not repeated). Error near:<br><code>$near</code></li>";
			} 

			# Read updated content into questions array
			$questions[$iq][0] = $label;
			$questions[$iq][1] = $text[$i];
			$iq++;

		# For A tags
		} else if (preg_match("/A(\((.*)\))?((\[[^\]]*\])+:|:(\[[^\]]*\])?)/", $value)) {
			# Build Q ID, assign to label
			$numberline[$nested]++;
			$label = $Qnode;
			$j=0;
			while($j < $nested and $numberline[$j]){
				$label = $label.".".$numberline[$j];
				$j++;
			}
			$label = $label.".".$numberline[$nested];

			# Update a target ID with current label
			#$value = preg_replace("/A(\((.*)\))?((\[[^\]]*\])+:|:(\[[^\]]*\])?)/", "A($numberline[$nested])$3", $value);

			# If this A tag isn't lined up with previous tag, throw an error
			if (($nested+(-1)*$lastnest) > 0) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$near = preg_replace("/</", "&lt;", $near);
				$near = preg_replace("/>/", "&gt;", $near);
				$errormsg = $errormsg."<li class=\"error\">Misaligned A. Error near:<br><code>$near</code></li>";
			}
			
			# If there is a GOTO: tag in an A tag, throw an error
			if (preg_match("/GOTO:/", $text[$i])) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$near = preg_replace("/</", "&lt;", $near);
				$near = preg_replace("/>/", "&gt;", $near);
				$errormsg = $errormsg."<li class=\"error\">GOTO calls not allowed in A tags. Error near:<br><code>$near</code></li>";
			}
			
			# Read content into answers array 
			$answers[$ia][0] = $label; #id 
			$answers[$ia][1] = $text[$i]; #content
			if (preg_match("/A(\((.*)\))?:\[([^\]]*)\]/", $value, $href)) {
				$answers[$ia][2] = $href[3]; #href
				$answers[$ia][3] = "target=\"_blank\""; # target
			} else if (preg_match("/A(\((.*)\))?\[([^\]]*)\]:/", $value, $href)) {
				$answers[$ia][2] = $href[3]; #href			
				#if (!preg_match("/\[javascript([^\]]*)\]:/", $value, $href)) { 
				#	# you have to watch the target because 
				#	#it can be used to define the scope of javascript functions
				#	$answers[$ia][3] = "target=\"_top\""; # target
				#} 
			} else {
				$answers[$ia][2] = "javascript:void('');"; #href						
			}
			preg_match('/A(\((.*)\))?((\[[^\]]*\])+:|:(\[[^\]]*\])?)/', $value, $matches);
			if ($matches[2] != "") {
				$answers[$ia][4] = $matches[2]; #variable name
			} else {
				$answers[$ia][4] = trim($text[$i]); #variable	
			}
			$ia++;

		# For X tags
		} else if (preg_match("/X:/", $value)) {
			# Build Q ID, assign to label
			$numberline[$nested]++;
			$label = $Qnode;
			$j=0;
			while($j < $nested and $numberline[$j]){
				$label = $label.".".$numberline[$j];
				$j++;
			}
			$label = $label.".".$numberline[$nested];

			# If this X tag isn't lined up with previous tag, throw an error
			if (($nested+(-1)*$lastnest) > 0) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$near = preg_replace("/</", "&lt;", $near);
				$near = preg_replace("/>/", "&gt;", $near);
				$errormsg = $errormsg."<li class=\"error\">Misaligned X. Error near:<br><code>$near</code></li>";
			}
			
			# If X tag contains spaces or special characters, throw an error
			#if (!preg_match("/^[a-zA-Z0-9\.]+\s*$/", $text[$i])) { #pre v 1
			if (!preg_match("/^\s*$/", $text[$i])) {
				$text[$i] = preg_replace("/\s/", "", $text[$i]);
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$near = preg_replace("/</", "&lt;", $near);
				$near = preg_replace("/>/", "&gt;", $near);
				$errormsg = $errormsg."<li class=\"error\">Starting in September 2016, the space after an X (variable) tag must be left blank. Variable names are now pulled from the parent question's target_id. That is, the number or letters in parentheses between the \"Q\" and \":\". For example: <p><code>Q(<font color=red><em>target_id</em></font>):</code></p><p>See <a href=\"http://www.qnamarkup.org/syntax/#x\" taregt=\"_blank\">Documenation</a>. Error near:<br><code>$near</code></li>";
			}			
			
			# If there is more than one X in this answer set		
			$tabcount = substr_count($value,"\t");
			if (preg_match_all("/(^|\n)\t{".$tabcount."}Q(((?!\t*Q).)*\n)*(\t{".$tabcount."}X)(((?!\t*Q).)*\n)*(\t{".$tabcount."}X)/", $content,$m, PREG_PATTERN_ORDER)>0) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$errormsg = $errormsg."<li class=\"error\">Limit one variable per answer set. Error near:<br><code>$near</code></li>";			
			}

			# Read content into answers array 
			$answers[$ia][0] = $label; #id 
			$answers[$ia][1] = "<variable>"; #content
			$answers[$ia][2] = "javascript:void('');"; #href	
			$text[$i] = preg_replace("/\s*$/", "", $text[$i]);					
			$answers[$ia][4] = $label; #variable name 
			$ia++;
			
		# For DOC tags
		} else if (preg_match("/DOC\(?(\d?)(.\s*\d+)*\)?:/", $value)) {
			if ($nested == 0 and $lastvalue != "DOC:") {
				$lastnest = -1;
				$lastvalue = "Q:";
				$Qnode++;
			}	
			# Build Q ID, assign to label
			$numberline[$nested] = 0;
			$label = $Qnode;
			$j=0;
			while($j < $nested and $numberline[$j]){
				$label = $label.".".$numberline[$j];
				$j++;
			}
			if ($nested == 0 and $lastvalue != "DOC:") {
				$Qnode--;
			}	
			# Update Q target ID with current label
			$value = preg_replace("/DOC\(?(\d?)(.\s*\d+)*\)?:/", "DOC($label):", $value);
			
			# If DOC is not indented once from the last nest, throw an error.
			if (($nested+(-1)*$lastnest) != 1) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$near = preg_replace("/</", "&lt;", $near);
				$near = preg_replace("/>/", "&gt;", $near);
				$errormsg = $errormsg."<li class=\"error\">Misaligned DOC. Error near:<br><code>$near</code></li>";
			}

			# If the preceding tag was a Q, make sure this Q is on a new line (i.e., $lastnest == -1)
			if (preg_match("/Q\(?(\d?)(.\s*\d+)*\)?:/", $lastvalue) AND $lastnest != -1) {
				$wellformed = 0;
				$near = $value.substr($text[$i], 0, 50)."...";
				$near = preg_replace("/</", "&lt;", $near);
				$near = preg_replace("/>/", "&gt;", $near);
				$errormsg = $errormsg."<li class=\"error\">Mismatched DOC. Error near:<br><code>$near</code></li>";
			}

			# Read updated content into questions array
			$questions[$iq][2] = $label;
			$questions[$iq][3] = $text[$i];

		}

		if (!preg_match("/DOC\(?(\d?)(.\s*\d+)*\)?:/", $value)) {
			$lastnest = $nested;
			$lastvalue = $value;
		}
#		$ordercheck[$nested] = "$ordercheck[$nested] $value";
		$code = $code."$value$text[$i]";		
		$i++;
	}
	
	$regex = "/GOTO:hold:/i";
	$code = preg_replace($regex, "GOTO:", $code);

	foreach ($qvarname as $qpair) {
		$regex_clean = preg_replace("/\./", "\.", $qpair[0]);
		$regex = "/((^|\n)+\t*)(Q\(($regex_clean)\):)/i";
		$code = preg_replace($regex, "$1Q($qpair[1]):", $code);	
		$regex = "/GOTO:\s?$regex_clean(\s*(\n|$))/i";
		$code = preg_replace($regex, "GOTO:$qpair[1]$1", $code);	
	}
	
	if (!$questions) {
		$wellformed = 0;
		$near = $value.substr($text[$i-1], 0, 50)."...";
		$near = preg_replace("/</", "&lt;", $near);
		$near = preg_replace("/>/", "&gt;", $near);
		$errormsg = $errormsg."<li class=\"error\">You must have at least one Q: tag. Error near:<br><code>$near</code></li>";
	}	
	if (!$answers) {
		$wellformed = 0;
		$near = $value.substr($text[$i-1], 0, 50)."...";
		$near = preg_replace("/</", "&lt;", $near);
		$near = preg_replace("/>/", "&gt;", $near);
		$errormsg = $errormsg."<li class=\"error\">You must have at least one A: tag. Error near:<br><code>$near</code></li>";
	}			
		
	$query_string = 'markup=' . urlencode($code) . '&font_family=' . urlencode($font_family)  . '&font_size=' . urlencode($font_size) . '&line_height=' . urlencode($line_height) . '&col_width=' . urlencode($col_width) . '&frame_pad=' . urlencode($frame_pad) . '&radius=' . urlencode($radius) . '&comp_bg=' . urlencode($comp_bg) . '&comp_txt=' . urlencode($comp_txt) . '&comp_link=' . urlencode($comp_link) . '&usr_bg=' . urlencode($usr_bg) . '&usr_txt=' . urlencode($usr_txt) . '&usr_link=' . urlencode($usr_link) . '&sharing=' . urlencode($sharing); 
	#$compressed_q = urlencode(gzdeflate($query_string, 9));
	$query_size = strlen($query_string);

	ob_start();
	include( dirname(__FILE__) . '/css.php');
	$style = ob_get_clean();
	
	$snippet_output = $style."\n";
	$original = "";

	if ($wellformed != "1") {
		$snippet_output = $snippet_output."$errormsg";
	} else { 
		 
if ($wellformed ==1) {
			
		$i=0;
		foreach ($questions as $value) {
			$value[1] = stripslashes($value[1]);
			preg_match('/GOTO:\s?([a-zA-Z0-9\._-]*)\s*$/', $value[1], $matches);
			$regex_clean = preg_replace("/\./", "\.", $matches[1]);
			$regex = "/GOTO:\s?$regex_clean(\s*$)/i";
			foreach($qvarname as $keypair) {
					#print "$keypair[1] == $matches[1]\n";
					if ($matches[1] == $keypair[1]) {
						$value[1] = preg_replace($regex, "GOTO:$keypair[0]", $value[1]);
						#$value[1] = "hey";
					}
			}
			#$value[1] = "$matches[1] | $value[1]";
			if ($i==0) { 
				$snippet_output = $snippet_output."<FORM name=\"FORM\" id=\"FORM\"><div id=\"conversation\" style=\"margin:".($frame_pad)."px auto 0 auto;padding:0 ".$frame_pad."px;max-width:".$col_width."px\">".$before."<div id='QandA' class='QandA'><div style='padding:15px;background:#ddffdd;text-align:center;'>Loading QnA...</div></div>"; 
				$snippet_output = $snippet_output."<div id='Choices' class='choices'>";
				#$j=0;
				#foreach ($answers as $valuetoo) {
				#	$valuetoo[1] = stripslashes($valuetoo[1]);
				#	if (preg_match("/^$value[0](\.{1}\d+){1}$/", $valuetoo[0])) {
				#		if (preg_match("/^\<variable\>$/",$valuetoo[1])) {
				#			$snippet_output = $snippet_output."<div class=\"xdiv\"><input type=\"text\" id=\"Xi-$valuetoo[0]\" name=\"Xi-$valuetoo[0]\" class=\"xinput\" onkeypress=\"{if (event.keyCode==13)answerQ('".$valuetoo[0]."')}\"/><a href=\"javascript:void('');\" class=\"xbutton\" onClick=\"answerQ('".$valuetoo[0]."');\"><span class=\"qpad\">Save above text as answer.</span></a></div><script type=\"text/javascript\">document.getElementById('Xi-$valuetoo[0]').focus();</script>";
				#		} else {
				#			$snippet_output = $snippet_output."<a href=\"".$valuetoo[2]."\" class=\"qabutton\" onClick=\"answerQ('".$valuetoo[0]."');\"".$valuetoo[3]."><span class=\"qpad\">".$valuetoo[1]."</span></a>";
				#		}
				#	}
				#	$j++;
				#}
				$snippet_output = $snippet_output."</div><div id=\"rawmarkup\" style=\"display:none;\">$content</div><div id=\"ondeck\" name=\"ondeck\">";	
				#$original = $original."<div id=\"doc\" name=\"doc\" style=\"display:none;\"></div>";				
			}

			
			if ($value[2] and $value[3]) {
				$original = $original."<div id='D-$value[0]' name='D-$value[2]' style='display:none;'>$value[3]</div>";
			} 
			
			if (preg_match("/^GOTO:\s?([a-z0-9\._-]*)\s*$/i", $value[1])) {
				$original = $original."<div id='Q-$value[0]' name='Q-$value[0]' style='display:none;'>$value[1]</div>";
			} else if (preg_match("/^\<variable\>$/", $value[1])) {
				$original = $original."<div id='Q-$value[0]' name='Q-$value[0]' style='display:none;'>input $value[1]</div>";
			} else {
				#$original = $original."<div id='Q-$value[0]' name='Q-$value[0]' style='display:none;'><div class='frame'><div class='full'><div class='question_text'>$value[1]</div></div><div class='question_arrow'></div></div></div>";			
				$original = $original."<div id='Q-$value[0]' name='Q-$value[0]' style='display:none;'>$value[1]</div>";			
			}
			
			$i++;
		}
		
		foreach ($answers as $value) {
			$original = $original."<div id='A-$value[0]' name='A-$value[0]' style='display:none;'>$value[1]</div>";
			$original = $original."<div id='A-href-$value[0]' name='A-href-$value[0]' style='display:none;'>$value[2]</div>";
			$original = $original."<div id='A-target-$value[0]' name='A-target-$value[0]' style='display:none;'>$value[3]</div>";
			$original = $original."<div id='X-$value[0]' name='X-$value[0]' style='display:none;'>$value[4]</div>";
		}
		
		$original = $original."\n<script>\n\tvar QVnames = [";
		$inc = 0;
		foreach ($qvarname as $value) {
			$original = $original."['$value[0]','$value[1]']";
			$inc++;
			if (count($qvarname) == $inc) {
				$original = $original;
			} else {
				$original = $original.",";	
			}
		}
		$original = $original."];\n";		
		#$original = $original."\tfunction indexis(variablename) {\n\t\tfor(var i = 0; i < QVnames.length; i++) {\n\t\t\tif(QVnames[i][1] === variablename) {\n\t\t\t\treturn QVnames[i][0];\n\t\t\t}\n\t\t}\n\t}\n";
		#$original = $original."\tfunction valueis(variablekey) {\n\t\tfor(var i = 0; i < QVnames.length; i++) {\n\t\t\tif(QVnames[i][0] === variablekey) {\n\t\t\t\treturn QVnames[i][1];\n\t\t\t}\n\t\t}\n\t}\n";
		$original = $original."</script>\n";
		
		$snippet_output = $snippet_output.$original."</div>";
		$snippet_output = $snippet_output."<textarea id=\"original\" name=\"original\" style=\"display:none;\" disabled=\"disabled\">".$original."</textarea>";
		$snippet_output = $snippet_output."<textarea id=\"transcript\" name=\"transcript\" style=\"display:none;\" disabled=\"disabled\"></textarea>";
		$snippet_output = $snippet_output."<div style=\"float:left;width:100%;margin:15px 0 0px 0;border-top: solid 1px #ddd;\">";
		$snippet_output_output = $snippet_output;
		$snippet_output_temp = "";
		if ($sharing == 1 and $query_size < 4000) {
			ob_start();
			share_widget($home,$query_string);
			$share_widget = ob_get_clean();
		 	$snippet_output = $snippet_output."<p align=center>".$share_widget."</p>";
		}
		$snippet_output_temp = $snippet_output_temp."<div id=credits class=credits style=\"display:none;\"><div class=credit_text>";
		if ($title) { $snippet_output_temp = $snippet_output_temp."<p><b>$title</b></p>"; }
		if ($author) { $snippet_output_temp = $snippet_output_temp."<p>By $author</p>"; }
		if ($description) { $snippet_output_temp = $snippet_output_temp."<p>$description</p>"; } 
		$snippet_output_temp = $snippet_output_temp."</div></div><p align=center>";
		
		if ($title OR $author OR $description) {
			$snippet_output_temp = $snippet_output_temp."<a href=\"javascript:void('');\" onClick=\"shoh('credits');\">credits</a> |";
		}
		if ($query_size < 4000) { 
			$snippet_output_temp = $snippet_output_temp." <a href=\"".$home."?$query_string\" onClick=\"javascript:alert('You are about to edit a copy of this QnA. Any edits will not change this instance.');\" target=_top>edit</a> |";
		}		
		$snippet_output_temp = $snippet_output_temp." <a href=\"".$home."\" target=_top>code your own</a></p></div></FORM>".$after."</div></div>";

		$js = file_get_contents( dirname(__FILE__) . '/../js/interactive.js', true);
		$snippet_output_temp = $snippet_output_temp."\n".$js;
		
		$snippet_output = $snippet_output.$snippet_output_temp."\n";
		$snippet_output_output = htmlentities($snippet_output_output.$snippet_output_temp); 
	}
}
	
}	

function from_file($pointer) {
	global $whitelist;
	if(filter_var($pointer, FILTER_VALIDATE_URL)){		
		preg_match("/^http(s)*:\/\/([^\/]*)/", $pointer, $matches);
		$pattern = "/(^|,)".preg_replace("/\//", "\/", $matches[0])."\//i";
		if (preg_match($pattern , $whitelist)) {
			$content_tmp = 	@file_get_contents($pointer, true);
			if (!$content_tmp) { 
				$content_tmp = "Error loading from remote location.";
			}
		} else {
				$content_tmp = "Error loading. Domain not on whitelist.";			
		}
	} else if ($pointer) {
		$content_tmp = @file_get_contents(dirname(__FILE__) . '/../templates/'.$pointer.'.txt', true);
		if (!$content_tmp) { 
 	   		$content_tmp = "Template not found.";
		}
	} else {
 	   		$content_tmp = $pointer;	
	}
	return $content_tmp;
}

function og_img($home,$content) {
	$regex = "/<img.+?src=[\"'](.+?)[\"'].*?>/i";
	$og_img = preg_match($regex, $content, $img_match);
	if ($og_img == 1) {
		$og_img = $img_match[1];
	} else {
		$og_img = $home."images/QnA_300.png";	
	}
	return $og_img;
}

?>
