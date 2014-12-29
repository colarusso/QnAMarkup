<?php 

# The URL associated with your QnA instance's main page.
$home = "http://www.example.com/";

# Source Whitelist. See http://www.qnamarkup.org/syntax/#remote
# Provide a comma separated list of domains, and make sure to include the trailing slash (/).
$whitelist = "http://www.qnamarkup.org/,http://colarusso.github.io/";

# Dynamic Nav Bar Menu
function nav_bar($home) {
?>
	<span style="float:right;">
		<?php if (!preg_match("/^\/(syntax)\//i", $_SERVER["REQUEST_URI"])) { echo "<a href=".$home.">Home (editor)</a>&nbsp;&nbsp;"; } ?>
		<a href="<?php echo $home ?>syntax/">Syntax</a>&nbsp;&nbsp;|&nbsp;&nbsp;
		<a href="https://github.com/colarusso/QnAMarkup/wiki/Gallery/" target="_blank">Gallery</a>&nbsp;&nbsp;
		<a href="https://github.com/colarusso/QnAMarkup/wiki/" target="_blank">Wiki</a>&nbsp;&nbsp;
		<a href="https://github.com/colarusso/QnAMarkup" target="_blank">GitHub</a>
	</span>
<?php
}

# include link to report bugs/issues: 1 = yes, 0 = no
# only set to 1 if you have not altered any code
$bugs = 0; 

# A code block to be placed at the 
# very end of your pages' BODY tag.
$analytics_code = "";

function share_widget($home,$query_string) {
# A code block to be placed in your 
# interactive output right before the 
# "code your own" link, assuming sharing 
# is selected under the Style tab. 
?>

<?php
}

?>
