<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/HTML4/loose.dtd">
<HTML xmlns="http://www.w3.org/1999/xhtml"
      xmlns:og="http://ogp.me/ns#"
      xmlns:fb="http://www.facebook.com/2008/fbml">
<HEAD>
	<TITLE>Syntax</TITLE>
	<style>
	code {
		background:#eee;
		font-weight: bold;
		//color:#0c6912;
		color:blue;
		padding:2px 5px;
	}
	pre {
		background:#eee;
		font-weight: bold;
		color:blue;
		padding:10px;
		white-space: pre-wrap;		
	}
	a.anchor {
		display:block;
		float:right;
		width:22px;
		height:16px;
		background-image: url("../images/link.png");	
		background-repeat: no-repeat;
		background-position: center; 		
	}
	a.foot {
		font-family:Verdana, Geneva, sans-serif;
		color:white;
		font-size:14px;
		line-height:20px;
	}
	</style>
	<link rel="stylesheet" type="text/css" href="../css/generic.css">
</HEAD>

<BODY BGCOLOR="#ffffff" BACKGROUND="" MARGINWIDTH="0" MARGINHEIGHT="0">
<div style="position:absolute;top:15px;left:25px;right:25px;overflow:hidden;">
	<? 	include( dirname(__FILE__) . '/../lib/functions.php'); nav_bar($home); ?> 
</div>

<div style="max-width:970px;margin:0px auto;padding:15px;">
<h1>Syntax &amp; Usage</h1>

<!--<p style="background:#eeffee;padding:15px;">
If you are attending this weekend's <a href="https://twitter.com/lai/status/533310165131743232" target=_blank>#prototypejam</a> (or even if you aren't), please <a href="https://github.com/colarusso/QnAMarkup/issues" target=_blank>report</a> any issues/bugs your spot on GitHub, and share examples of your work on <a href="https://github.com/colarusso/QnAMarkup/wiki/Gallery" target=_blank>our wiki</a>.
</p>-->
<div style="float:left;margin: 0 0 35px 0;border-bottom: solid 1px #aaa;padding: 0 0 15px 0;">
<div style="float:right;background:#fff;border: solid 1px #bbb;padding:20px 20px 5px 20px;width:230px;margin: 5px 0 20px 20px;">
<img src="http://www.davidcolarusso.com/flowcharts/images/better.jpg"/ width="230px;"/><br>
<p>
Not up for a full syntax lesson? Download and print this three-page quick start guide. It has pretty flowcharts. 
</p>
<p align=center><a href="QnA_Quick_Start.pdf" target=_blank>Quick Start Guide</a></p>
</div>

<p>
QnA is a <a href="https://en.wikipedia.org/wiki/Markup_language" target="_blank">markup language</a> for people with little or no programming experience. It was designed with attorneys in mind and transforms blocks of text into interactive question and answer sessions (QnAs). These QnAs can be used as stand-alone <a href="https://en.wikipedia.org/wiki/Expert_system" target="_blank">expert systems</a> or in the aid of rule-based document construction. See <a href="#santa">example below</a>. Plus, they can be <a href="<?php echo $home ?>i/?source=game" target="_blank">fun</a>, and the entire project is <a href="http://en.wikipedia.org/wiki/Open_source" target="_blank">open source</a>.
</p><p>
Authors define behavior by placing text after one of ten tags described below. On this page, you'll find everything you need to write your own QnA. Assuming an average reading speed of 180 words per minute, this entire page should only take about 20 minutes to read. Of course, you should probably <a href="http://www.qnamarkup.org/" target="_blank">open a QnA editor</a> and play around as you read. So it might take an hour before you're an expert. ;)  
</p><p>
If you're pressed for time, start with the <a href="#body">Body</a> section. That's where all the exciting stuff happens, and you can build a very respectable QnA with body tags alone. Alternatively, you could try our <a href="QnA_Quick_Start.pdf" target=_blank>quick start guide</a>.
</p>
<h3>Sections</h3>
<ul>
	<li><a href="#header">Header</a><!--(364 words) assuming 180 words/min => -->  (~2 min. to read)</li>
	<li><a href="#body">Body</a> <!-- (1,658 words) --> (~9.5 min. to read)</li>
	<li><a href="#scripts">Predefined Javascript Functions</a> <!--(525 words)--> (~3 min. to read)</li>
	<li><a href="#docs">Document Parsers &amp; Editors</a> <!--(731 words)--> (~4 min. to read)</li>
	<li><a href="#remote">Loading a Remote QnA</a> <!--(457 words)--> (~1 min. to read)</li>  
</ul><br> 
</div>

<h2>Header<a name="header" href="#header" class="anchor"></a></h2>
<p>The header is optional text appearing before the first non-header tag (those tags listed under <em>Body</em> <a href="#body">below</a>). The header can be empty or contain any of the following five header tags. The values of these tags are defined by the text between tags. The order of tags is unimportant as long as they appear before the first non-header tag. If you use a tag twice, the last value provided will be used to define the tag's value.</p>

	<h2><code>Title: <font color=black><em>text/html</em></font></code><a name="title" href="#title" class="anchor"></a></h2>
	<ul>
		If present, contents of the <code>Title</code> tag are visible in the credits at the bottom of the QnA output and as the title of any stand-alone HTML page. The contents of this tag are also used to define the <em>title</em> element in Open Graph metadata associated with any stand-alone HTML page. Contents may include HTML, but such styling will only appear in the credits, not in the HTML page's title or metadata. 
	</ul>
	<h2><code>Author: <font color=black><em>text/html</em></font></code><a name="author" href="#author" class="anchor"></a></h2>
	<ul>
		If present, contents of the <code>Author</code> tag are visible in the credits at the bottom of the QnA output. Contents may include HTML. 
	</ul>
	<h2><code>Description: <font color=black><em>text/html</em></font></code><a name="description" href="#description" class="anchor"></a></h2>
	<ul>
		If present, contents of the <code>Description</code> tag are visible in the credits at the bottom of the QnA output. They are also used to define the <em>description</em> element in Open Graph metadata associated with any stand-alone HTML page. Contents may include HTML, but such styling will only appear in the credits, not in the HTML page's metadata. 
	</ul>
	<h2><code>Before: <font color=black><em>text/html</em></font></code><a name="before" href="#before" class="anchor"></a></h2>
	<ul>
		If present, the contents of this tag are placed in the QnA output directly preceding the rendering of the first Q: tag, but after a definition of the QnA's CSS and the declaration of its FORM element. This tag should include anything you want to place in the HTML output at this point. For example, you could redefine style elements, define hidden form values, add a title... 
	</ul>
	<h2><code>After: <font color=black><em>text/html</em></font></code><a name="after" href="#after" class="anchor"></a></h2>
	<ul>
		If present, the contents of this tag are placed at the end of the QnA output directly following the rendering of its footer link(s). This is after the closing of the output's FORM element. This tag should include anything you want to place in the HTML output at this point, perhaps some Javascript. 
	</ul>
	<a href="#">Back to top</a><hr>

<h2>Body<a name="body" href="#body" class="anchor"></a></h2>
<p>
The <em>Body</em> is where you define questions and answers along with the text of any would-be documents. This content can be plain text, or it can be formated as <a href="http://www.w3schools.com/html/default.asp" target="_blank">HTML</a>. The output of a QnA is an interactive HTML document. Consequently, if you would like to include comments (text that doesn't show up in your output), you can hide them like this: <code>&lt;!--  <font color=black>comment text here</font> --&gt;</code>, just <a href="http://www.w3schools.com/html/html_comments.asp" target="_blank">as you would in HTML</a>. To get a good feel for what's possible in QnA, read through the following tag descriptions. 
</p>
	<h2><code>Q<font color=purple>(<font color=red><em>variable_name</em></font>)</font>: <font color=black><em>text/html</em></font></code><a name="q" href="#q" class="anchor"></a></h2>
	<ul>
		The content of <code>Q</code> (question) tags are rendered inside left-aligned text bubbles. The first <code>Q</code> tag's content is visible after loading. The content of other <code>Q</code> tags become visible after a user selects its preceding <code>A</code> tag.  

<a name="first"></a>
<p>For example, the first question below is displayed after loading, along with its possible answers (those <code>A</code> tags in a vertical line below its <code>Q</code>). After a user selects an answer, the content of the <code>Q</code> following that answer is displayed, along with its possible answers (if any).</p>

<table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">Q: <font color=black>first question</font>
A: <font color=black>first answer to first question</font> 
	Q: <font color=black>first question under the first answer to the first question</font>
A: <font color=black>second answer to first question</font>
	Q: <font color=black>first question under the second answer to the first question</font></pre>
</p></td><td width=300px valign=top>
<iframe src="<?php echo $home ?>i/?source=http://colarusso.github.io/QnAMarkup/examples/source/first_q.txt&sharing=2" style="width:300px;height:300px;border: solid 1px #555;"></iframe>
</td></tr>
<tr><td colspan=2 bgcolor="#666666">&nbsp; <a href="<?php echo $home ?>?source=http://colarusso.github.io/QnAMarkup/examples/source/first_q.txt&sharing=2" class="foot" target="_QnA">edit this QnA in an new window</a></td></tr>
</table>	
		
		<p>
		The <code>Q</code> tag must start a new line or be indented exactly once more than the preceding <code>A</code> tag.
		</p>

		<p>After rendering, by <a href="../" target=
		_blank">an interpreter</a> every <code>Q</code> tag will have a unique <code><font color=red><em>variable_name</em></font></code> placed in a parenthetical between its Q and colon based on its relation to other <code>Q</code> tags. If left in the default form of alternating numbers and periods (e.g., <em>1.1.1.3.4</em>), these <code><font color=red><em>variable_name</em></font></code>s are updated with every rendering. You can, however, change these default names to any unique combination of letters, numbers, periods, dashes, and underscores (e.g., <em>my_cool_vaiable</em>). Regardless of the format, <code><font color=red><em>variable_name</em></font></code>s can be used in conjunction with the <code>GOTO</code> tag to direct users to <code>Q</code> tags that would otherwise be inaccessible given the linear nesting of questions and answers. A discussion of the <code>GOTO</code> tag can be found <a href="#goto">below</a>.
<pre style="background:#eee;padding:10px;">Q<font color=purple>(<font color=red>1</font>)</font>: 
A: 
	Q<font color=purple>(<font color=red>1.1</font>)</font>:
A: 
	Q<font color=purple>(<font color=red>1.2</font>)</font>:
Q<font color=purple>(<font color=red>2</font>)</font>:</pre>
</p>

	<p><b>Formatting:</b></p>

	<p>QnA outputs HTML files. So you can format questions in their text bubbles using standard <a href="http://www.w3schools.com/html/default.asp" target="_blank">HTML</a>. If, however, you would like the text of a question to display in multiple text bubbles, use <code>&lt;br&gt;&lt;br&gt;</code> to create a bubble break. This will split the current text bubble in two at the point where it is included. You may recognize this as two <a href="http://www.w3schools.com/tags/tag_br.asp" target="_blank">HTML line breaks</a>. If you want to place two HTML line breaks in a bubble without triggering a bubble break, simply add a space between the two tags (<code>&lt;br&gt; &lt;br&gt;</code>), and they will not create a bubble break. 
	</ul>
<h2><code>GOTO:<font color=red><em>variable_name</em></font></code><a name="goto" href="#goto" class="anchor"></a></h2>
	<ul>
	<p>
	The <code>GOTO</code> tag moves a user to the location targeted by its <code><font color=red><em>variable_name</em></font></code>.</p>
	
<a name="sox"></a>
<p> For example, given the QnA below, a user answering "Red Sox" will find themselves presented with the reply "Cool." Whereas, a user answering "Yankees" will find him/herself presented with the text "Seriously..." followed by the original question, "Red Sox or Yankees?"
	</p>
<table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">Q<font color=purple>(<font color=red>1</font>)</font>: <font color=black>Red Sox or Yankees?</font>
A: <font color=black>Red Sox</font>
	Q<font color=purple>(<font color=red>1.1</font>)</font>:GOTO:<font color=red>2</font> 
A: <font color=black>Yankees</font>
	Q<font color=purple>(<font color=red>1.2</font>)</font>: <font color=black>Seriously...</font> GOTO:<font color=red>1</font>
Q<font color=purple>(<font color=red>2</font>)</font>: <font color=black>Cool.</font></pre>
</p></td><td width=300px valign=top>
<iframe src="<?php echo $home ?>i/?source=http://colarusso.github.io/QnAMarkup/examples/source/sox.txt&sharing=2" style="width:100%;height:300px;border: solid 1px #555;"></iframe>
</td></tr>
<tr><td colspan=2 bgcolor="#666666">&nbsp; <a href="<?php echo $home ?>?source=http://colarusso.github.io/QnAMarkup/examples/source/sox.txt&sharing=2" class="foot" target="_QnA">edit this QnA in an new window</a></td></tr>
</table>	
<p>
<code>GOTO</code> calls can only appear at the end of a <code>Q</code> tag, and there can only be one <code>GOTO</code> call per tag. They are not allowed in <code>A</code> tags.
</p>
<p>If the target of a <code>GOTO</code> is removed or the <code><font color=red><em>variable_name</em></font></code> shows up more than once before the ids are  recalculated: the <code>GOTO</code> is declared ambiguous; an error is thrown; and <code>GOTO:<font color=red><em>variable_name</em></font></code> becomes something like <code>GOTO:???</code>. If the target of a <code>GOTO</code> is renumbered, in most cases, the <code>GOTO</code> is renumbered as well.</p>  
<p>Note: <code>DOC:</code> tags (<a href="#doc">described below</a>) are included when a user is moved to a target location.</p>
	</ul>

<h2><a name="a" href="#a" class="anchor"></a>
	<code>A<font color=purple>(<font color=red><em>variable_value</em></font>)</font>: <font color=black><em>some text/html</em></font></code>, 
	
	<code>A<font color=purple>(<font color=red><em>variable_value</em></font>)[<font color=red><em>href</em></font>]</font>: <font color=black><em>some text/html</em></font></code>,  or 
	
	<code>A<font color=purple>(<font color=red><em>variable_value</em></font>)</font>:<font color=purple>[<font color=red><em>href</em></font>]</font> <font color=black><em>some text/html</em></font></code></h2>
	
	<ul>		<p>
			The <code>A</code> tag is rendered as a button following the preceding question's text. By default, clicking on this button will replace all buttons with a right-aligned word bubble containing the contents of the selected button and followed by the text of the next nested question in a left-aligned text bubble.
			</p>
			<p>
			The <code>A</code> tag must line up with the preceding <code>Q</code> tag (i.e., have the same number of tabs between it and the start of the line). You can have as many <code>A</code> tags following a <code>Q</code> as you like. For example:
			</p>
<pre style="background:#eee;padding:10px;">Q: 
A: 
A:
A:
		Q:
		A:
		A:
</pre>

			<p><b>Advanced Usage:</b></p>
			<ul><p>
			<p>
			<a name="a" href="#variables" class="anchor"></a>
			<b>Variables</b>
			</p>
			Answers are stored in variables with names defined by <code><font color=red><em>variable_name</em></font></code> in the parent <code>Q</code> tag. By default, answer values are equal to the text/html in the <code>A</code> tag. However, if the <code>A</code> tag is written with parentheses (e.g., <code>A<font color=purple>()</font>:</code>) the contents of these parentheses are used as the answer.
			</p>
			<p>You can access an answer's values by enclosing its <code><font color=red><em>variable_name</em></font></code> like so: <code>&lt;x&gt;<font color=red><em>variable_name</em></font>&lt;/x&gt;</code>. Instances of such enclosures will be replaced with that variable's value. For example, consider the following. </p>
<table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">Q<font color=purple>(<font color=red>drink</font>)</font>: <font color=black>Coffee or tea?</font>
A: <font color=black>coffee</font>
	Q<font color=purple>(<font color=red>1.1</font>)</font>:GOTO:<font color=red>extras</font>
A: <font color=black>tea</font>
	Q<font color=purple>(<font color=red>1.2</font>)</font>:GOTO:<font color=red>extras</font>

Q<font color=purple>(<font color=red>extras</font>)</font>: <font color=black>Milk and sugar?</font>
A<font color=purple>(<font color=red>milk and sugar</font>)</font>: <font color=black>Yes. Milk and sugar.</font>
	Q<font color=purple>(<font color=red>2.1</font>)</font>:GOTO:<font color=red>gotit</font>
A<font color=purple>(<font color=red>nothing added</font>)</font>: <font color=black>No. I take it black.</font>
	Q<font color=purple>(<font color=red>2.2</font>)</font>:GOTO:<font color=red>gotit</font>
A<font color=purple>(<font color=red>milk</font>)</font>: <font color=black>Milk only.</font>
	Q<font color=purple>(<font color=red>2.3</font>)</font>:GOTO:<font color=red>gotit</font>
A<font color=purple>(<font color=red>sugar</font>)</font>: <font color=black>Sugar only.</font>  
	Q<font color=purple>(<font color=red>2.4</font>)</font>:GOTO:<font color=red>gotit</font>

Q<font color=purple>(<font color=red>gotit</font>)</font>: <font color=black>Got it. You like </font>&lt;x&gt;<font color=red>drink</font>&lt;/x&gt;<font color=black> with </font>&lt;x&gt;<font color=red>extras</font>&lt;/x&gt;.</font> 
</pre></td><td width=300px valign=top>
<iframe src="<?php echo $home ?>i/?source=http://colarusso.github.io/QnAMarkup/examples/source/drink.txt&sharing=2" style="width:300px;height:300px;border: solid 1px #555;"></iframe>
</td></tr>
<tr><td colspan=2 bgcolor="#666666">&nbsp; <a href="<?php echo $home ?>?source=http://colarusso.github.io/QnAMarkup/examples/source/drink.txt&sharing=2" class="foot" target="_QnA">edit this QnA in an new window</a></td></tr>
</table>
			<p>
				Note: the replacement of <code>&lt;x&gt;<font color=red><em>variable_name</em></font>&lt;/x&gt;</code> with user values includes text inside <code>DOC:</code> tags (<a href="#doc">described below</a>). 
			</p>
			<p>In addition to the replacement example above, user answers are stored in the document itself. So if you use the <code>submit2()</code> function (<a href="#submit2()">described below</a>) these variables will be passed along. Also, you can get at these values using Javascript's innerHTML property: <a href="http://www.w3schools.com/jsref/prop_html_innerhtml.asp" target="_blank">document.getElementById("variable_name").innerHTML</a>.</p>
			</ul>
			<ul>
			<p>
			<a name="a" href="#links" class="anchor"></a>
			<b>Links</b>
			</p>
			<p>If the <code>A</code> tag is written with brackets (e.g., <code>A<font color=purple>[]</font>:</code> or <code>A:<font color=purple>[]</font></code>) the contents of the brackets will be passed to that button's <a href="http://www.w3schools.com/tags/att_a_href.asp" target="_blank">href attribute</a>. That is, the button can be turned into a link. If the brackets fall before the colon, the link will target the page the button is on. If the brackets follow the colon, the <em>href</em> will target a new blank page/window. In HTML, <code>A<font color=purple>[<font color=red>http://www.nasa.gov</font>]</font>: <font color=black>I love NASA</font></code> effectively becomes <code>&lt;a <font color=purple>href</font>="<font color=red>http://www.nasa.gov</font>"&gt;<font color=black>I love NASA</font>&lt;/a&gt;</code>, whereas, <code>A:<font color=purple>[<font color=red>http://www.nasa.gov</font>]</font> <font color=black>I love NASA</font></code> effectively becomes <code>&lt;a <font color=purple>href</font>="<font color=red>http://www.nasa.gov</font>" target="_blank"&gt;<font color=black>I love NASA</font>&lt;/a&gt;</code>.
			</p>
			<p>
			When used in conjunction with QnA's predefined Javascript functions (<a href="#scripts">described below</a>), the <em>href</em> argument can do some neat stuff above and beyond linking to things because you can uses a <em>href</em> to run Javascript.</p>
			
<a name="save"></a>
			<p> For example, you could use the <code>save2()</code> and <code>transcript()</code> functions to let a user save their conversation to a file.
			</p>
<table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">Q<font color=purple>(<font color=red>1</font>)</font>: <font color=black>Do you want to see something neat?</font>
A: <font color=black>Yes.</font>
	Q<font color=purple>(<font color=red>1.1</font>)</font>: <font color=black>Cool. Click away.</font>
	A<font color=purple>[<font color=red>javascript:save2('transcript.txt', transcript());</font>]</font>: <font color=black>Save conversation.</font>
		Q<font color=purple>(<font color=red>1.1.1</font>)</font>:GOTO:<font color=red>1</font>
A: <font color=black>No.</font>
	Q<font color=purple>(<font color=red>1.2</font>)</font>:GOTO:<font color=red>1</font>
</pre></td><td width=300px valign=top>
<iframe src="<?php echo $home ?>i/?source=http://colarusso.github.io/QnAMarkup/examples/source/neat.txt&sharing=2" style="width:300px;height:300px;border: solid 1px #555;"></iframe>
</td></tr>
<tr><td colspan=2 bgcolor="#666666">&nbsp; <a href="<?php echo $home ?>?source=http://colarusso.github.io/QnAMarkup/examples/source/neat.txt&sharing=2" class="foot" target="_QnA">edit this QnA in an new window</a></td></tr>
</table></ul>	
	</ul>


	<h2><code>X:</code><a name="x" href="#x" class="anchor"></a></h2>
	<ul>
	<p>
	Use the <code>X</code> tag in the place of an <code>A</code> tag when you would like users to type their own answer. Instead of a button, it will present as a input/text field. The contents of such a field is saved as the question's variable value, and its names is based on the <code>Q</code> tag's <code><font color=red><em>variable_name</em></font></code>.</p>
	<p>
		As with <code>A</code> tags, if you enclose a variable name like so <code>&lt;x&gt;<font color=red><em>variable_name</em></font>&lt;/x&gt;</code> it will be replaced by that variable's value.</p>
		
<a name="yourname"></a>	
		<p> For example, in the QnA below, if a user types in "David," the QnA's reply would read "Nice to meet you David."
	</p>
<table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">Q<font color=purple>(<font color=red>name</font>)</font>: <font color=black>What is your name?</font>
X: 
	Q: <font color=black>Nice to meet you </font>&lt;x&gt;<font color=red>name</font>&lt;/x&gt;<font color=black>.</font></pre>
</p></td><td width=300px valign=top>
<iframe src="<?php echo $home ?>i/?source=http://colarusso.github.io/QnAMarkup/examples/source/what_is_your_name.txt&sharing=2" style="width:300px;height:300px;border: solid 1px #555;"></iframe>
</td></tr>
<tr><td colspan=2 bgcolor="#666666">&nbsp; <a href="<?php echo $home ?>?source=http://colarusso.github.io/QnAMarkup/examples/source/your_name.txt&sharing=2" class="foot" target="_QnA">edit this QnA in an new window</a></td></tr>
</table>		
	<p>
	Note: as with <code>A</code> tags, the replacement of <code>&lt;x&gt;<font color=red><em>variable_name</em></font>&lt;/x&gt;</code> with user values includes text inside <code>DOC:</code> tags (<a href="#doc">described below</a>). 
	</p>
	<p>
		<b>Advanced Usage:</b>
	</p>
	<p>When the <code>X</code> tag is used, as with the <code>A</code> tag, in addition to the replacement described above, user answers are stored in the document itself. So if you use the <code>submit2()</code> function (<a href="#submit2()">described below</a>) user variables will be passed along. Also, you can get at these values using Javascript's innerHTML property: <a href="http://www.w3schools.com/jsref/prop_html_innerhtml.asp" target="_blank">document.getElementById("variable_name").innerHTML</a>.</p>
	</ul>
	<h2><code>DOC: <font color=black><em>text/html</em></font></code><a name="doc" href="#doc" class="anchor"></a></h2>
	<ul>
		<p>You associate a <code>DOC:</code> tag with a <code>Q:</code> tag by placing it in line with and directly before the <code>Q:</code> tag. When a <code>Q</code> tag is displayed to a user, the content of its associated <code>DOC:</code> tag is added to a QnA document variable. </p>
		
<a name="shopping"></a>
		<p>For example, in the QnA below, items are added to a shopping list based on the meals a user selects. You are then presented with two options for viewing the shopping list: (1) on screen by reading the contents of the document into an standard <a href="http://www.w3schools.com/jsref/met_win_alert.asp" target="_blank">Javascript alert</a> window; or (2) saving the shopping list as a text file using the <code>save2()</code> function (<a href="#save2()">described below</a>). Both methods access the document via the <code>doc()</code> function (<a href="#doc()">described below</a>).</p> 
<table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">DOC(1):<font color=black>SHOPPING LIST</font>

Q<font color=purple>(<font color=red>1</font>)</font>: <font color=black>What would you like to cook?</font>
A: <font color=black>Garlic Chicken</font>
	DOC<font color=purple>(<font color=red>1.1</font>)</font>:<font color=black>Garlic Chicken
	4 boneless skinless chicken breasts
	4 garlic cloves, minced
	4 tablespoons brown sugar
	1 tablespoon olive oil
	additional herbs and spices, as desired</font>
	Q<font color=purple>(<font color=red>1.1</font>)</font>:GOTO:<font color=red>2</font>
A: <font color=black>Mac and Cheese</font>
	DOC<font color=purple>(<font color=red>1.2</font>)</font>:<font color=black>Mac and Cheese	
	3/4 pound dried elbow macaroni
	1 1/2 cups grated  sharp cheddar cheese
	1/2 cup grated gruyere cheese
	1/3 cup panko bread crumbs, toasted until golden</font>
	Q<font color=purple>(<font color=red>1.2</font>)</font>:GOTO:<font color=red>2</font>
Q<font color=purple>(<font color=red>2</font>)</font>: <font color=black>Okay. I have the shopping list ready. How would you like it?</font>
A<font color=purple>[<font color=red>javascript:alert(doc());</font>]</font>: <font color=black>In an alert box.</font>
	Q<font color=purple>(<font color=red>2.1</font>)</font>:GOTO:<font color=red>3</font>
A<font color=purple>[<font color=red>javascript:save2('list.txt',doc());</font>]</font>: <font color=black>As a file I can save.</font>
	Q<font color=purple>(<font color=red>2.2</font>)</font>:GOTO:<font color=red>3</font>
Q<font color=purple>(<font color=red>3</font>)</font>: <font color=black>Enjoy the grub.</font></pre>
</p></td><td width=300px valign=top>
<iframe src="<?php echo $home ?>i/?source=http://colarusso.github.io/QnAMarkup/examples/source/shopping_list.txt&sharing=22" style="width:300px;height:475px;border: solid 1px #555;"></iframe>
</td></tr>
<tr><td colspan=2 bgcolor="#666666">&nbsp; <a href="<?php echo $home ?>?source=http://colarusso.github.io/QnAMarkup/examples/source/shopping_list.txt&sharing=2" class="foot" target="_QnA">edit this QnA in an new window</a></td></tr>
</table>			
		
	<p>
		<b>Advanced Usage:</b>
	</p>
	<p>You can make use of the <code>submit2()</code> function (<a href="#submit2()">described below</a>) to pass your document to either an HTML or Markdown parser/editor. So instead of saving a document directly to ones computer, a user could have a chance to edit his/her document before saving.</p>
	<p>
	Note: the <code>DOC:</code> content is just text. It doesn't matter if it's HTML, markdown, LaTeX, CommonAccord, whatever you like. 
	</p>
	</ul>
	<a href="#">Back to top</a><hr>

<h2>Predefined Javascript Functions<a name="scripts" href="#scripts" class="anchor"></a></h2>
<p>All interactive QnA documents come preloaded with a set of five <a href="http://www.w3schools.com/js/js_functions.asp" target="_blank">Javascript functions</a>. As described above, these can be called from an <code>A</code> tag using the syntax: <code>A<font color=purple>[<font color=red>javascript:<em>function_name</em>();</font>]</font>:</code>. Below we'll explain what each of these functions do.</p>	


<a name="transcript"></a>
<h2><code>transcript(<font color=red><em>format</em></font>);</code><a name="transcript()" href="#transcript()" class="anchor"></a></h2>
	<ul>
		<p>This function will return a transcript of the current QnA as it exists at the time the function is called. For example, when selected, the following tag will display a transcript in an alert window. <code>A<font color=purple>[<font color=red>javascript:alert(transcript());</font>]</font>: <font color=black>button text</code></code>.</p>
		<p>
		This function accepts an argument called <code><font color=red><em>format</em></font></code>. When set equal to <code>1</code>, the transcript will include HTML found in the original QnA questions and answers. Otherwise, all HTML will be removed from the presented transcript. For example, this call will include HTML <code>A<font color=purple>[<font color=red>javascript:alert(transcript('1'));</font>]</font>:</code>
		, and this one will not
		<code>A<font color=purple>[<font color=red>javascript:alert(transcript());</font>]</font>:</code>
		.
		</p>
		<p>You may recall the use of this function from the <a href="#shopping">shopping list</a> example above.</p>
		</ul>

<a name="doc"></a>
<h2><code>doc();</code><a name="doc()" href="#doc()" class="anchor"></a></h2>
		<ul>
		<p>This function will return the <code>DOC:</code> content associated with rendered <code>Q</code> tags. For example, when selected, the following tag will display the <code>DOC:</code> content: <code>A<font color=purple>[<font color=red>javascript:alert(doc());</font>]</font>: <font color=black>button text</code></code>.</p>
		<p>You may recall the use of this function in the <a href="#save">save conversation</a> example above.</p>
		<p>
		</ul>
		
<a name="json_str"></a>
<h2><code>json_str();</code><a name="json_str()" href="#json_str()" class="anchor"></a></h2>
		<ul>
		<p>This function will return a JSON string containg the QnA's <code><font color=red><em>variable_name</em></font></code> and <code><font color=red><em>variable_name</em></font></code> as key and value pairs. For example, when selected, the following tag will display the the QnA's variables as a JSON string: <code>A<font color=purple>[<font color=red>javascript:alert(json_str());</font>]</font>: <font color=black>button text</code></code>.</p>
		<p>
		</ul>

<a name="mail2"></a>
<h2><code>mail2(<font color=red><em>to</em></font>, <font color=red><em>subject</em></font>, <font color=red><em>body</em></font>);</code><a name="mailto()" href="#mailto()" class="anchor"></a></h2>
		<ul>
		<p>
		When called, this function will make use of the <a href="http://en.wikipedia.org/wiki/Mailto" target="_blank">mailto URI scheme</a> to open a new email in the user's default email program. This email will be addressed to <code><font color=red><em>to</em></font></code>, with the subject line <code><font color=red><em>subject</em></font></code>, and the body of the email will be <code><font color=red><em>body</em></font></code>. For example, when selected, the following tag will email a transcript of the current QnA to <em>jdoe@example.com</em> with the subject line <em>QnA Transcript</em>. <code>A<font color=purple>[<font color=red>javascript:mail2('jdoe@example.com','QnA Transcript',transcript());</font>]</font>: <font color=black>button text</code></code>.</p>
		<span style="background:yellow">Note: Due to a common security setting, this function may not work if the QnA is embedded in an iframe.</span>
		</ul>

<a name="save2"></a>
<h2><code>save2(<font color=red><em>filename</em></font>,<font color=red><em>content</em></font>);</code><a name="save2()" href="#save2()" class="anchor"></a></h2>
		<ul> 
		This function will save a file to the user's computer with the name <code><font color=red><em>filename</em></font></code> and content equal to <code><font color=red><em>content</em></font></code>. For example, when selected, the following tag will save a file named <em>QnA_document.txt</em> with contents equal to the output of the <code>doc()</code> function. <code>A<font color=purple>[<font color=red>javascript:save2('QnA_document.txt',doc());</font>]</font>: <font color=black>button text</code></code>.</p>
				<p>You may recall the use of this function from the <a href="#save">save conversation</a> example above.</p>
		</ul>

<a name="submit2"></a>
<h2><code>submit2(<font color=red><em>action</em></font>, <font color=red><em>method</em></font>, <font color=red><em>docAs</em></font>, <font color=red><em>instructions</em></font>, <font color=red><em>transcriptAs</em></font>, <font color=red><em>jsonAs</em></font>, <font color=red><em>target</em></font>);</code><a name="submit2()" href="#submit2()" class="anchor"></a></h2>
		<ul>
		The entierty of a QnA conversation is wrapped in an <a href="http://www.w3schools.com/tags/tag_form.asp" target="_blank">HTML FORM</a> tag. This function will set that tag's <em>action</em> to <code><font color=red><em>action</em></font></code>, its <em>method</em> to <code><font color=red><em>method</em></font></code>, and its <em>target</em> to <code><font color=red><em>target</em></font></code>. Note: the <code><font color=red><em>target</em></font></code> parameter is optional. It's default setting is: <code>target = "_self"</code>.</p>
		<p>It will send the QnA's document as a single variable named <code><font color=red><em>docAs</em></font></code> along with an HTML transcript named <code><font color=red><em>transcriptAs</em></font></code> and a JSON string named <code><font color=red><em>jsonAs</em></font></code>.</p>
		<p>It will send all variables defined with their names as defined by the <code>Q</code> tag's <code><font color=red><em>variable_name</em></font></code> as well as any hidden variables placed inside the document's <code>Before</code>, <code>After</code>, <code>Q</code> and <code>A</code> tags.</p>
		<p>Additionally, it will send a variable named <code>i</code> with a value equal to <code><font color=red><em>instructions</em></font></code>. This last variable is intended specifically for use with the WYSIWYG document parsers described <a href="#docs">below</a>.
		</ul>

	<a href="#">Back to top</a><hr>
</ul>	

<h2>Document Parsers &amp; Editors<a name="docs" href="#docs" class="anchor"></a></h2>
<p>My hope is that this section will grow into a list of parsers as people point me to various parsers around the web. The basic idea is that by using the <code>submit2()</code> function in conjunction with a document parser/editor, it is possible to hold up the document created by a QnA for review by a person. Imagine a QnA that used a combination of <code>DOC:</code> and <code>X:</code> tags to craft a custom document for a <em>pro se</em> litigant. At the end of the QnA, that document can be passed to a parser and the user can take some time to edit the text before printing or saving it. The thing is that the <code>DOC:</code> tag doesn't really care what format its content is in. It could be HTML, markdown, or LaTex. By passing that content to a parser, it can be rendered and placed in a form that's easier for a user to digest.</p>	
<h3>Local WYSIWYG Parsers &amp; Editors</h3>
 <ul> <p>For now, I've set up local parsers for <a href="http://www.w3schools.com/html/" target="_blank">HTML</a>, <a href="https://en.wikipedia.org/wiki/Markdown" target="_blank">Markdown</a>, and <a href="https://parall.ax/products/jspdf" target="_blank">jsPDF</a>. They are available at:</p><ul>
 (1) <a href="<?php echo $home ?>doc/parse/html/" target="_blank"><?php echo $home ?>doc/parse/html/</a></li><br>
 (2) <a href="<?php echo $home ?>doc/parse/markdown/" target="_blank"><?php echo $home ?>doc/parse/markdown/</a><br>
 (3) <a href="<?php echo $home ?>doc/parse/jspdf/" target="_blank"><?php echo $home ?>doc/parse/jspdf/</a></ul>
<p><span style="background:yellow">Note: the jsPDF parser doesn't allow users to edit output, and isn't <a href="https://parall.ax/products/jspdf" target="_blank">compatible</a> with all browsers.</span></p>
 <p>The parsers read two variables which you can send them using the <code>submit2()</code> function. The first, <code>t</code>, is the content to be parsed, and the second, <code>i</code>, is a set of instructions to be displayed after parsing. In fact, <code>submit2()</code> takes <code>i</code> as an argument. That is <code>i</code> = <code><font color=red><em>instructions</em></font></code> as defined above.</p>
 
<a name="santa"></a>
<p>For example, the QnA below can be used to create a letter to Santa. Note: the document is in HTML. So you'll notice that line breaks are indicated by the HTML tag <a href="http://www.w3schools.com/tags/tag_br.asp" target="_blank">&lt;br&gt;</a>. Also, it is sent to the HTML parser. 
 </p>
<p><table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">Q<font color=purple>(<font color=red>1</font>)</font>: <font color=black>Would you like to write a letter to Santa? </font>
A: <font color=black>Yes.</font>
	Q<font color=purple>(<font color=red><font color=red>myname</font></font>)</font>: <font color=black>What is your name?</font>
	X:
		DOC<font color=purple>(<font color=red>1.1.1</font>)</font>:<font color=black>Dear Santa,&lt;br&gt;&lt;br&gt; </font>

		Q<font color=purple>(<font color=red>naughty</font>)</font>: <font color=black>Have you been naughty or nice?</font>
		A<font color=purple>(<font color=red>I am sorry that I have been naughty. I will work hard to be nice in the new year.&lt;br&gt;&lt;br&gt;</font>)</font>: <font color=black>Naughty</font>
			Q<font color=purple>(<font color=red>1.1.1.1</font>)</font>:GOTO:<font color=red>whatiwant</font>
		A<font color=purple>()</font>: <font color=black>Nice</font>
			Q<font color=purple>(<font color=red>1.1.1.2</font>)</font>:GOTO:<font color=red>whatiwant</font>		
A: <font color=black>No.</font>
	Q<font color=purple>(<font color=red>1.2</font>)</font>: <font color=black>That's cool. Have a good day.</font>

Q<font color=purple>(<font color=red>whatiwant</font></font>)</font>: <font color=black>What would you like for Christmas?</font>
X:
	DOC<font color=purple>(<font color=red>2.1</font>)</font>:</font>&lt;x&gt;<font color=red>naughty</font>&lt;/x&gt;<font color=black>I would like </font>&lt;x&gt;<font color=red>whatiwant</font>&lt;/x&gt;<font color=black> for Christmas. I hope all is well with you up north.&lt;br&gt;&lt;br&gt;
			Sincerely,&lt;br&gt;
			</font>&lt;x&gt;<font color=red>myname</font>&lt;/x&gt;
	Q<font color=purple>(<font color=red>2.1</font>)</font>: <font color=black>Alright, are you ready to see your letter?</font>
	A<font color=purple>[<font color=red>javascript:submit2('<?php echo $home ?>doc/parse/html/', 'POST', 't', 'Proof read your letter. Print it out, and mail it to: Santa Clause, North Pole')</font>]</font>: <font color=black>Yes.</font>
		Q<font color=purple>(<font color=red>2.1.1</font>)</font>: <font color=black>Thank you.</font></pre>
<tr><td bgcolor="#666666">&nbsp; <a href="<?php echo $home ?>?source=http://colarusso.github.io/QnAMarkup/examples/source/santa_letter.txt&sharing=2" class="foot" target="_QnA">edit this QnA in an new window</a></td></tr>
</table>
<p>
<p><iframe src="<?php echo $home ?>i/?source=http://colarusso.github.io/QnAMarkup/examples/source/santa_letter.txt&col_width=320&sharing=2" style="width:100%;height:510px;border: solid 1px #555;"></iframe>
</p>			
</ul>
<h3>Working with .docx Documents<a name="docx_docs" href="#docx_docs" class="anchor"></a></h3>
<ul> 
<p>Although the above parsers offer a good deal of flexability, sometime you want to control a document's format with greater percision than allowed by HTML et al. For such instances, you can make use of <em>.docx</em> templates such as <a href="http://www.qnamarkup.org/docxmerge/templates/Santa-letter.docx" target="_new">this one</a>.<p>
<p>Instead of constructing the document in QnA you can merge your QnA answers with an existing template. Below we'll do this with a standard .docx (Word) file with mail merge feilds. The service below will take in a JSON string, the URL of a .docx file from which to make a merged .docx file, and the name for the output file. The service we'll be using below is an instance of <a href="https://github.com/colarusso/docx_webmerge" target="_new">docx_webmerge</a>.</p>
<p>However, the tool only accepts .docx files from a whitelist of servers. if you're a non-profit and would like me to add your website to the whitelist for the example service available at <a href="http://colarusso.pythonanywhere.com/" target="_blank">http://colarusso.pythonanywhere.com/</a> (the app behind the live example below), let me know. As long as you aren't expecting wicked crazy volume, I'll probably just add you to the list.</p>
<p>That being said, let us write another letter to Santa.</p>
<p><table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">Before: <font color=black>
&lt;input type="hidden" name="name" value="Letter to Santa"/&gt;
&lt;input type="hidden" name="docx_uri" value="http://www.qnamarkup.org/docxmerge/templates/Santa-letter.docx"/&gt;</font>

Q<font color=purple>(<font color=red>1</font>)</font>:<font color=black> Would you like to write a letter to Santa? </font>
A: Yes.
	Q<font color=purple>(<font color=red>myname</font>)</font>: <font color=black>What is your name?</font>
	X:
		Q<font color=purple>(<font color=red>1.1.1</font>)</font>:GOTO:<font color=red>whatiwant</font>		

Q<font color=purple>(<font color=red>whatiwant</font>)</font>:<font color=black> What would you like for Christmas? </font>
X:
	Q<font color=purple>(<font color=red>2.1</font>)</font>:<font color=black>Alright, are you ready to see your letter?</font>
	A<font color=purple>[<font color=red>javascript:submit2('http://colarusso.pythonanywhere.com/','GET','','','','json_doc')</font>]</font>:<font color=black>Yes.</font>
		Q<font color=purple>(<font color=red>2.1.1</font>)</font>: <font color=black>Thank you.</font></pre>
<tr><td bgcolor="#666666">&nbsp; <a href="<?php echo $home ?>?source=http://colarusso.github.io/QnAMarkup/examples/source/santa_docx.txt&sharing=2" class="foot" target="_QnA">edit this QnA in an new window</a></td></tr>
</table>
<p>
<p><iframe src="<?php echo $home ?>i/?source=http://colarusso.github.io/QnAMarkup/examples/source/santa_docx.txt&col_width=320&sharing=2" style="width:100%;height:510px;border: solid 1px #555;"></iframe>
</p>	
<p>Note: if you'd like to include instructions along with your document, consider appending an instructions page to the begining of the document.</p>
</ul>
<a href="#">Back to top</a><hr>

<h2>Loading a Remote QnA<a name="remote" href="#remote" class="anchor"></a></h2>
<p>
If you have a text file containing QnA Markup at a URL, you can pass that URL to a QnA instance for rendering using the <code>source</code> parameter and the following syntax: 
</p>
<ul><code><font color=black>[<em>QnA instance's URL</em>]/i/</font><font color=purple>?source=</font><font color=red>[<em>QnA text file's URL</em>]</font></code></ul>
<p>For example:</p>
<ul><code><font color=black>http://www.qnamarkup.org/i/</font><font color=purple>?source=</font><font color=red>http://colarusso.github.io/QnAMarkup/examples/source/first_q.txt</font></code> (<a href="http://www.qnamarkup.org/i/?source=http://colarusso.github.io/QnAMarkup/examples/source/first_q.txt" target="_blank">view link</a>)</ul>
<p>Permissible domains, however, are limited to a <a href="http://en.wikipedia.org/wiki/Whitelist" target="_blank">whitelist</a> established in the configuration file (i.e., <a href="https://github.com/colarusso/QnAMarkup/blob/master/lib/config.php" target="_blank">config.php</a>) of a QnA instance. The instance running at QnAMarkup.org, for example, accepts pointers to "www.qnamarkup.org" and "colarusso.github.io".</p>
<p>The <code>source</code> parameter is accepted by both the the stand-alone QnA page (e.g., <code><font color=black>http://www.qnamarkup.org/i/</font><font color=purple>?source=</font><font color=red><em>text URL</em></font></code>) and the editor page (e.g., <code><font color=black>http://www.qnamarkup.org/</font><font color=purple>?source=</font><font color=red><em>text URL</em></font></code>).</p>
<p>
You can submit content to "colarusso.github.io" by following the <a href="https://github.com/colarusso/QnAMarkup/wiki/Gallery#hosting-your-qna" target="_blank">instructions for "Hosting your QnA"</a> found on this project's Gallery page.
</p>
<a href="#">Back to top</a>

<div class=footer style="float:left;width:100%;margin:30px 0 0 0;padding:15px 5px 50px 5px;border-top: solid 1px #aaa;">
	<?php if ($bugs == 1) { echo "<span style=\"float:right;\"><a href=\"https://github.com/colarusso/QnAMarkup/issues\" target=_blank>report bug/issue</a></span>"; } ?>
	Updated 2016-09-19  
</div>
</div> 
<?php echo $analytics_code ?>
</BODY>
</HTML>