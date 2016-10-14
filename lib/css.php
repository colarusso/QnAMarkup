<style>	
	body {
		font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif;
	}

	#rawmarkup{
		display:none;
	}
	
	#QandA img{
		width:100%;
	}

	div.main{
		min-width:300px;
		max-width:650px;
		margin: 0 auto;
	padding:0 5px 0 5px;
		}
	div.frame{
		float:left;
		width:100%;
		margin:5px 0 5px 0;
	}
	div.full{
		float:left;
		width:100%;
	}
	.button{
		padding:8px;
		margin:8px 0 0px 0;
		width:100%;
	}
	div.question_text{
		float:left;
		font-family: <?php echo $font_family ?>;
		font-size: <?php echo $font_size ?>px;
		line-height: <?php echo $line_height ?>px;
		color:#<?php echo $comp_txt ?>;
		min-width:<?php echo $radius+15 ?>px;
		background:#<?php echo $comp_bg ?>;
		border-radius: <?php echo $radius ?>px;
		padding:<?php echo $line_height*0.5 ?>px <?php echo $line_height*0.75 ?>px <?php echo $line_height*0.70 ?>px <?php echo $line_height*0.75 ?>px;
		margin-right:<?php echo $radius+30 ?>px;
	}

	div.question_text a:link, div.question_text a:hover, div.question_text a:active, div.question_text a:visited{ color:#<?php echo $comp_link ?>; } 

	div.question_arrow{
		float:left; 
		width: 0; 
		height: 0; 
		border-left: 5px solid transparent; 
		border-right: 10px solid transparent; 
		border-top: 15px solid #<?php echo $comp_bg ?>;
		margin:0 <?php echo $radius+5 ?>px;
	}
	div.ans_text{
		float:right;
		font-family: <?php echo $font_family ?>;
		font-size: <?php echo $font_size ?>px;
		line-height: <?php echo $line_height ?>px;
		color:#<?php echo $usr_txt ?>;
		min-width:<?php echo $radius+15 ?>px;
		background:#<?php echo $usr_bg ?>;
		border-radius: <?php echo $radius ?>px;
		padding:<?php echo $line_height*0.5 ?>px <?php echo $line_height*0.75 ?>px <?php echo $line_height*0.70 ?>px <?php echo $line_height*0.75 ?>px;
		margin-left:<?php echo $radius+30 ?>px;
	}
	div.ans_arrow{
		float:right; 
		width: 0; 
		height: 0; 
		border-left: 10px solid transparent; 
		border-right: 5px solid transparent; 
		border-top: 15px solid #<?php echo $usr_bg ?>;
		margin:0 <?php echo $radius+5 ?>px;
	}
	div.choices{
		float:left;
		width:100%;
		margin:15px 0 0 0;
	}
	div.standard_buttons{
		float:left;
		width:100%;
		margin-top:5px;
		border-top: 1px solid #ddd; 
		padding-top:12px;		
	}
	div.credits{
		float:left;
		dispaly:none;
		width:100%;
		background:#eee;
		margin:0px 0 15px 0;
	}
	div.credit_text{
		font-family: Verdana, Geneva, sans-serif;
		font-size: 14px;
		line-height: 20px;
		padding:4px 15px 10px 15px;
	}
	li.error{
		list-style-type: none;
		background:#ffdddd;
		margin: 10px 0 0 0;
		padding: 5px;
	}

	.qpad {
		float:left;
		padding:0 <?php echo $line_height*0.75 ?>px;
	}
	
	a.sbutton {
		float:left;
		font-family: <?php echo $font_family ?>;
		font-size: <?php echo $font_size ?>px;
		line-height: <?php echo $line_height ?>px;
		width:48%;
		background: #eee;
		border-radius: 8px;
		padding:<?php echo $line_height*0.5 ?>px 0px <?php echo $line_height*0.6 ?>px 0;
		margin: 0 0 3px 0;
		border: solid 1px #888;
		text-align:center;
		color: #000000;
		text-decoration: none;
	}

	a.sbutton:hover, a.sbutton:active {
		float:left;
		font-family: <?php echo $font_family ?>;
		font-size: <?php echo $font_size ?>px;
		line-height: <?php echo $line_height ?>px;
		width:48%;
		background: #ddd;
		border-radius: 8px;
		padding:<?php echo $line_height*0.5 ?>px 0px <?php echo $line_height*0.6 ?>px 0;
		margin: 0 0 3px 0;
		border: solid 1px #888;
		text-align:center;
		color: #000000;
		text-decoration: none;
	}

	a.qabutton {
		float:left;
		font-family: <?php echo $font_family ?>;
		font-size: <?php echo $font_size ?>px;
		line-height: <?php echo $line_height ?>px;
		width:100%;
		background: #eee;
		border-radius: 8px;
		padding:<?php echo $line_height*0.5 ?>px 0px <?php echo $line_height*0.6 ?>px 0;
		margin: 0 0 8px 0;
		border: solid 1px #888;
		text-align:left;
		color: #000000;
		text-decoration: none;
	}

	a.qabutton:hover, a.qabutton:active {
		float:left;
		font-family: <?php echo $font_family ?>;
		font-size: <?php echo $font_size ?>px;
		line-height: <?php echo $line_height ?>px;
		width:100%;
		background: #ddd;
		border-radius: 8px;
		padding:<?php echo $line_height*0.5 ?>px 0px <?php echo $line_height*0.6 ?>px 0;
		margin: 0 0 8px 0;
		border: solid 1px #888;
		text-align:left;
		color: #000000;
		text-decoration: none;
	}
	

	div.xdiv {
		float:left;
		width:100%;
		margin: 0 0 8px 0;
		background: #eee;
		border: solid 1px #888;
		border-radius: 8px;
	}	

	input.xinput {
		-webkit-box-sizing: border-box; /* Safari/Chrome, other WebKit */
		-moz-box-sizing: border-box;    /* Firefox, other Gecko */ 
		box-sizing: border-box;         /* Opera/IE 8+ */
		float:left;
		width:100%;
		font-family: <?php echo $font_family ?>;
		font-size: <?php echo $font_size ?>px;
		line-height: <?php echo $line_height ?>px;
		background: #fff;
		border-top-left-radius: 8px;
		border-top-right-radius: 8px;
		padding:<?php echo $line_height*0.5 ?>px <?php echo $line_height*0.5 ?>px <?php echo $line_height*0.6 ?>px <?php echo $line_height*0.5 ?>px;
		border: solid 0px #888;
		border-bottom: solid 1px #888;
		text-align:left;
		color: #000000;
		text-decoration: none;
	}
	
	a.xbutton {
		float:left;
		width:100%;
		text-align:left;
		font-family: <?php echo $font_family ?>;
		font-size: <?php echo $font_size ?>px;
		line-height: <?php echo $line_height ?>px;
		background: #eee;
		border-radius: 8px;
		padding:<?php echo $line_height*0.5 ?>px 0px <?php echo $line_height*0.6 ?>px 0px;
		color: #000000;
		text-decoration: none;
	}
	
	a.xbutton:hover, a.xbutton:active {
		border-top-left-radius: 0px;
		border-top-right-radius: 0px;
		background: #ddd;
	}
</style>