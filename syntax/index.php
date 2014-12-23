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
	</style>
	<link rel="stylesheet" type="text/css" href="../css/generic.css">
</HEAD>

<BODY BGCOLOR="#ffffff" BACKGROUND="" MARGINWIDTH="0" MARGINHEIGHT="0">
<div style="position:absolute;top:15px;left:25px;right:25px;overflow:hidden;">
	<? 	include( dirname(__FILE__) . '/../lib/functions.php'); nav_bar($home); ?> 
</div>

<div style="max-width:970px;margin:0px auto;padding:15px;">
<h1>Syntax</h1>

<!--<p style="background:#eeffee;padding:15px;">
If you are attending this weekend's <a href="https://twitter.com/lai/status/533310165131743232" target=_blank>#prototypejam</a> (or even if you aren't), please <a href="https://github.com/colarusso/QnAMarkup/issues" target=_blank>report</a> any issues/bugs your spot on GitHub, and share examples of your work on <a href="https://github.com/colarusso/QnAMarkup/wiki/Gallery" target=_blank>our wiki</a>.
</p>-->
<p>
QnA is an <a href="http://en.wikipedia.org/wiki/Open_source" target=_blank>open source</a> <a href="https://en.wikipedia.org/wiki/Markup_language" target=_blank>markup language</a> for people with little or no programming experience. It was designed with attorneys in mind and transforms blocks of nested text into an interactive set of questions and answers. These QnAs can be used as stand-alone <a href="https://en.wikipedia.org/wiki/Expert_system" target=_blank>expert systems</a> or in the aid of rule-based document construction, and they can be <a href="<?php echo $home ?>i/?source=game" target=_blank>fun</a>. Authors define behavior by placing text after one of ten tags, described below. For example, a <a href="../">QnA interpreter</a> will treat text on a line starting with <code>Q:</code> as a question and text on a line starting with <code>A:</code> as a possible answer. Below you'll find everything you need to know to start writing your own QnAs. 
</p><p>
Feel free to start with the <a href="#body">Body</a> section. That's where all the exciting stuff happens. Plus, the header's optional.
</p>
<h3>Sections</h3>
<ul>
	<li><a href="#header">Header</a></li>
	<li><a href="#body">Body</a></li>
	<li><a href="#scripts">Predefined Javascript Functions</a></li>
	<li><a href="#docs">Document Parsers &amp; Editors</a></li>
</ul><br> 
<hr>
<a name="header"></a>
<h2>Header</h2>
<p>The header is optional text appearing before the first non-header tag (those tags listed under <em>Body</em> below). The header can be empty or contain any of the following five header tags. The values of these tags are defined by the text between tags. The order of tags is unimportant as long as they appear before the first non-header tag. If you use a tag twice, the last value provided will be used to define the tag's value.</p>

	<h2><code>Title: <font color=black><em>text/html</em></font></code></h2>
	<ul>
		If present, contents of the <code>Title</code> tag are visible in the credits at the bottom of the QnA output and as the title of any stand-alone HTML page. The contents of this tag are also used to define the <em>title</em> element in Open Graph metadata associated with any stand-alone HTML page. Contents may include HTML, but such styling will only appear in the credits, not in the HTML page's title or metadata. 
	</ul>
	<h2><code>Author: <font color=black><em>text/html</em></font></code></h2>
	<ul>
		If present, contents of the <code>Author</code> tag are visible in the credits at the bottom of the QnA output. Contents may include HTML. 
	</ul>
	<h2><code>Description: <font color=black><em>text/html</em></font></code></h2>
	<ul>
		If present, contents of the <code>Description</code> tag are visible in the credits at the bottom of the QnA output. They are also used to define the <em>description</em> element in Open Graph metadata associated with any stand-alone HTML page. Contents may include HTML, but such styling will only appear in the credits, not in the HTML page's metadata. 
	</ul>
	<h2><code>Before: <font color=black><em>text/html</em></font></code></h2>
	<ul>
		If present, the contents of this tag are placed in the QnA output directly preceding the rendering of the first Q: tag, but after a definition of the QnA's CSS and the declaration of its FORM element. This tag should include anything you want to place in the HTML output at this point. For example, you could redefine style elements, define hidden form values, add a title... 
	</ul>
	<h2><code>After: <font color=black><em>text/html</em></font></code></h2>
	<ul>
		If present, the contents of this tag are placed at the end of the QnA output directly following the rendering of its footer link(s). This is after the closing of the output's FORM element. This tag should include anything you want to place in the HTML output at this point, perhaps some Javascript. 
	</ul>

<a name="body"></a>
<h2>Body</h2>
<p>
The <em>Body</em> is where you define questions and answers along with the text of any would-be documents. This content can be plain text, or it can be formated as <a href="http://www.w3schools.com/html/default.asp" target=_blank>HTML</a>. The output will be an interactive HTML document. Consequently, if you would like to include comments (text that doesn't show up in your output), you can hide them like this: <code>&lt;!--  <font color=black>comment text here</font> --&gt;</code> just <a href="http://www.w3schools.com/html/html_comments.asp" target=_blank>as you would in HTML</a>. To get a good feel for what's possible in QnA, read through the following tag descriptions. 
</p>
	<h2><code>Q: <font color=black><em>text/html</em></font></code></h2>
	<ul>
		The content of <code>Q</code> (question) tags are rendered inside left-aligned text bubbles. The first <code>Q</code> tag's content is visible after loading. The content of other <code>Q</code> tags become visible after a user selects its preceding <code>A</code> tag.  

<a name="first"></a>
<p>For example, the first question below is displayed after loading, along with its possible answers (those <code>A</code> tags lined up below its <code>Q</code>). After a user selects an answer, the content of the <code>Q</code> following that answer is displayed, along with its possible answers (if any).</p>

<table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">Q: <font color=black>first question</font>
A: <font color=black>first answer to first question</font> 
	Q: <font color=black>first question under the first answer to the first question</font>
A: <font color=black>second answer to first question</font>
	Q: <font color=black>first question under the second answer to the first question</font></pre>
</p></td><td width=300px valign=top>
<iframe src="<?php echo $home ?>i/?markup=Q%281%29%3A+first+question%0D%0AA%3A+first+answer+to+first+question%0D%0A%09Q%281.1%29%3A+first+question+under+the+first+answer+to+the+first+question%0D%0AA%3A+second+answer+to+first+question%0D%0A%09Q%281.2%29%3A+first+question+under+the+second+answer+to+the+first+question&font_family=Verdana%2C+Geneva%2C+sans-serif&font_size=14&line_height=20&col_width=500&frame_pad=15&radius=15&comp_bg=5489eb&comp_txt=ffffff&comp_link=e3fbfc&usr_bg=eeeeee&usr_txt=000000&usr_link=0000ff&sharing=2" style="width:300px;height:300px;border: solid 1px #555;"></iframe>
</td></tr></table>	
		
		<p>
		The <code>Q</code> tag must start a new line or be indented exactly once more than the preceding <code>A</code> tag.
		</p>

		<p>After rendering, by <a href="../">an interpreter</a> every <code>Q</code> tag will have a unique <em>target ID</em> placed in a parenthetical between its Q and colon based on its relation to other <code>Q</code> tags. These ID values are updated with every rendering and can be used in conjunction with the <code>GOTO</code> tag to get users to <code>Q</code> tags that would otherwise be inaccessible to them given the linear nesting of questions and answers. A discussion of the <code>GOTO</code> tag can be found below.
<pre style="background:#eee;padding:10px;">Q(1): 
A: 
	Q(1.1):
A: 
	Q(1.2):
Q(2):</pre>
</p>

	<p><b>Formatting:</b></p>

	<p>QnA outputs HTML files. So you can format questions in their text bubbles using standard <a href="http://www.w3schools.com/html/default.asp" target=_blank>HTML</a>. If, however, you would like the text of a question to display in multiple text bubbles, use <code>&lt;br&gt;&lt;br&gt;</code> to create a bubble break. This will split the current text bubble in two at the point where it is included. You may recognize this as two <a href="http://www.w3schools.com/tags/tag_br.asp" target=_blank>HTML line breaks</a>. If you want to place two HTML line breaks in a bubble without triggering a bubble break, simply add a space between the two tags (<code>&lt;br&gt; &lt;br&gt;</code>), and they will not create a bubble break. 
	</ul>
<h2><code>GOTO:<font color=red><em>target_id</em></font></code></h2>
	<ul>
	<p>
	The <code>GOTO</code> tag moves a user to the location targeted by its <em>target_id</em>.</p>
	
<a name="sox"></a>
<p> For example, given the QnA below, a user answering "Red Sox" will find themselves presented with the reply "Cool." Whereas, a user answering "Yankees" will find him/herself presented with the text "Seriously..." followed by the original question, "Red Sox or Yankees?"
	</p>
<table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">Q(1): <font color=black>Red Sox or Yankees?</font>
A: <font color=black>Red Sox</font>
	Q(1.1):GOTO:<font color=red>2</font> 
A: <font color=black>Yankees</font>
	Q(1.2): <font color=black>Seriously...</font> GOTO:<font color=red>1</font>
Q(2): <font color=black>Cool.</font></pre>
</p></td><td width=300px valign=top>
<iframe src="<?php echo $home ?>i/?markup=Q%281%29%3A+Red+Sox+or+Yankees%3F%0D%0AA%3A+Red+Sox%0D%0A%09Q%281.1%29%3AGOTO%3A2+%0D%0AA%3A+Yankees%0D%0A%09Q%281.2%29%3A+Seriously...+GOTO%3A1%0D%0AQ%282%29%3A+Cool.&font_family=Verdana%2C+Geneva%2C+sans-serif&font_size=14&line_height=20&col_width=500&frame_pad=15&radius=15&comp_bg=5489eb&comp_txt=ffffff&comp_link=e3fbfc&usr_bg=eeeeee&usr_txt=000000&usr_link=0000ff&sharing=2" style="width:100%;height:300px;border: solid 1px #555;"></iframe>
</td></tr></table>	
<p>
<code>GOTO</code> calls can only appear at the end of a <code>Q</code> tag, and there can only be one <code>GOTO</code> call per tag. It is not allowed in <code>A</code> tags.
</p>
<p>If the target of a <code>GOTO</code> is removed or the <code><font color=red><em>target_id</em></font></code> shows up more than once before the ids are  recalculated: the <code>GOTO</code> is declared ambiguous; an error is thrown; and <code>GOTO:<font color=red><em>target_id</em></font></code> becomes something like <code>GOTO:???</code>. If the target of a <code>GOTO</code> is renumbered, the <code>GOTO</code> is renumbered as well.</p>  
<p>Note: <code>DOC:</code> tags (described below) are included when a user is moved to a target location.</p>
	</ul>

<h2><code>A: <font color=black><em>some text/html</em></font></code>, 
	
	<code>A<font color=purple>[<font color=red><em>href</em></font>]</font>: <font color=black><em>some text/html</em></font></code>,  or 
	
	<code>A:<font color=purple>[<font color=red><em>href</em></font>]</font> <font color=black><em>some text/html</em></font></code></h2>
	
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

			<p>
			<b>Advanced Usage:</b>
			</p>
			<p>If the <code>A</code> tag is written with brackets (e.g., <code>A<font color=purple>[]</font>:</code> or <code>A:<font color=purple>[]</font></code>) the contents of the brackets will be passed to that button's <a href="http://www.w3schools.com/tags/att_a_href.asp" target=_blank>href attribute</a>. That is, the button can be turned into a link. If the brackets fall before the colon, the link will target the page the button is on. If the brackets follow the colon, the <em>href</em> will target a new blank page/window. In HTML, <code>A<font color=purple>[<font color=red>http://www.nasa.gov</font>]</font>: <font color=black>I love NASA</font></code> effectively becomes <code>&lt;a <font color=purple>href</font>="<font color=red>http://www.nasa.gov</font>"&gt;<font color=black>I love NASA</font>&lt;/a&gt;</code>, whereas, <code>A:<font color=purple>[<font color=red>http://www.nasa.gov</font>]</font> <font color=black>I love NASA</font></code> effectively becomes <code>&lt;a <font color=purple>href</font>="<font color=red>http://www.nasa.gov</font>" target="_blank"&gt;<font color=black>I love NASA</font>&lt;/a&gt;</code>.
			</p>
			<p>
			When used in conjunction with QnA's predefined Javascript functions (described below), the <em>href</em> argument can do some neat stuff above and beyond linking to things because you can uses a <em>href</em> to run Javascript.</p>
			
<a name="save"></a>
			<p> For example, you could use the <code>save2()</code> and <code>transcript()</code> functions to let a user save their conversation to a file.
			</p>
<table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">Q(1): <font color=black>Do you want to see something neat?</font>
A: <font color=black>Yes.</font>
	Q(1.1): <font color=black>Cool. Click away.</font>
	A<font color=purple>[<font color=red>javascript:save2('transcript.txt', transcript());</font>]</font>: <font color=black>Save conversation.</font>
		Q(1.1.1):GOTO:<font color=red>1</font>
A: <font color=black>No.</font>
	Q(1.2):GOTO:<font color=red>1</font>
</p></td><td width=300px valign=top>
<iframe src="<?php echo $home ?>i/?markup=Q%281%29%3A+Do+you+want+to+see+something+neat%3F%0D%0AA%3A+Yes.%0D%0A%09Q%281.1%29%3A+Cool.+Click+away.%0D%0A%09A%5Bjavascript%3Asave2%28%27transcript.txt%27%2C+transcript%28%29%29%3B%5D%3A+Save+conversation.%0D%0A%09%09Q%281.1.1%29%3AGOTO%3A1%0D%0AA%3A+No.%0D%0A%09Q%281.2%29%3AGOTO%3A1&font_family=Verdana%2C+Geneva%2C+sans-serif&font_size=14&line_height=20&col_width=500&frame_pad=15&radius=15&comp_bg=5489eb&comp_txt=ffffff&comp_link=e3fbfc&usr_bg=eeeeee&usr_txt=000000&usr_link=0000ff&sharing=2" style="width:300px;height:300px;border: solid 1px #555;"></iframe>
</td></tr></table>	
	</ul>


	<h2><code>X:<font color=red><em>variable_name</em></font></code></h2>
	<ul>
	<p>
	Use the <code>X</code> tag in the place of an <code>A</code> tag when you would like users to type their own answer. Instead of a button, it will present as a input/text field. The contents of such a field is saved as a variable, and its names is based on the text following <code>X:</code>. Variable names must be unique, and they must contain only numbers or letters--no spaces and no special characters.
	</p>
	<p>
		If you enclose a variable name like so <code>&lt;x&gt;<font color=red><em>variable_name</em></font>&lt;/x&gt;</code> it will be replaced by that variable's value.</p>
		
<a name="yourname"></a>	
		<p> For example, in the QnA below, if a user types in "David," the QnA's reply would read "Nice to meet you David."
	</p>
<table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">Q: <font color=black>What is your name?</font>
X:<font color=red>name</font> 
	Q: <font color=black>Nice to meet you </font>&lt;x&gt;<font color=red>name</font>&lt;/x&gt;<font color=black>.</font></pre>
</p></td><td width=300px valign=top>
<iframe src="<?php echo $home ?>i/?markup=Q%281%29%3A+What+is+your+name%3F%0D%0AX%3Aname%0A%09Q%281.1%29%3A+Nice+to+meet+you+%3Cx%3Ename%3C%2Fx%3E.&font_family=Verdana%2C+Geneva%2C+sans-serif&font_size=14&line_height=20&col_width=500&frame_pad=15&radius=15&comp_bg=5489eb&comp_txt=ffffff&comp_link=e3fbfc&usr_bg=eeeeee&usr_txt=000000&usr_link=0000ff&sharing=2" style="width:300px;height:300px;border: solid 1px #555;"></iframe>
</td></tr></table>		
	<p>
	Note: the replacement of <code>&lt;x&gt;<font color=red><em>variable_name</em></font>&lt;/x&gt;</code> with user values includes text inside <code>DOC:</code> tags (described below). 
	</p>
	<p>
		<b>Advanced Usage:</b>
	</p>
	<p>When the <code>X</code> tag is used, in addition to the replacement described above, user answers are stored in the document itself. An answer is stored in a FORM element with an ID equal to its variable name. So if you use the <code>submit2()</code> function (described below) user variables will be passed along. Also, you can get at these values using Javascript's text value property: <a href="http://www.w3schools.com/jsref/prop_text_value.asp" target=_blank>document.getElementById("variable_name").value</a>.
	</ul>
	<h2><code>DOC: <font color=black><em>text/html</em></font></code></h2>
	<ul>
		<p>You associate a <code>DOC:</code> tag with a <code>Q:</code> tag by placing it in line with and directly before the <code>Q:</code> tag. When a <code>Q</code> tag is displayed to a user, the content of its associated <code>DOC:</code> tag is added to a QnA document variable. </p>
		
<a name="shopping"></a>
		<p>For example, in the QnA below, items are added to a shopping list based on the meals a user selects. You are then presented with two options for viewing the shopping list: (1) on screen by reading the contents of the document into an standard <a href="http://www.w3schools.com/jsref/met_win_alert.asp" target=_blank>Javascript alert</a> window; or (2) saving the shopping list as a text file using the <code>save2()</code> function (described below). Both methods access the document via the <code>doc()</code> function (described below).</p> 
<table width=100% bgcolor="#eeeeee"><tr><td valign=top><pre style="padding:0 10px 10px 10px;">DOC(1):<font color=black>SHOPPING LIST</font>

Q(1): <font color=black>What would you like to cook?</font>
A: <font color=black>Garlic Chicken</font>
	DOC(1.1):<font color=black>Garlic Chicken
	4 boneless skinless chicken breasts
	4 garlic cloves, minced
	4 tablespoons brown sugar
	1 tablespoon olive oil
	additional herbs and spices, as desired</font>
	Q(1.1):GOTO:<font color=red>2</font>
A: <font color=black>Mac and Cheese</font>
	DOC(1.2):<font color=black>Mac and Cheese	
	3/4 pound dried elbow macaroni
	1 1/2 cups grated  sharp cheddar cheese
	1/2 cup grated gruyere cheese
	1/3 cup panko bread crumbs, toasted until golden</font>
	Q(1.2):GOTO:<font color=red>2</font>
Q(2): <font color=black>Okay. I have the shopping list ready. How would you like it?</font>
A<font color=purple>[<font color=red>javascript:alert(doc());</font>]</font>: <font color=black>In an alert box.</font>
	Q(2.1):GOTO:<font color=red>3</font>
A<font color=purple>[<font color=red>javascript:save2('list.txt',doc());</font>]</font>: <font color=black>As a file I can save.</font>
	Q(2.2):GOTO:<font color=red>3</font>
Q(3): <font color=black>Enjoy the grub.</font></pre>
</p></td><td width=300px valign=top>
<iframe src="<?php echo $home ?>i/?markup=DOC%281%29%3ASHOPPING+LIST%0D%0A%0D%0AQ%281%29%3A+What+would+you+like+to+cook%3F%0D%0AA%3A+Garlic+Chicken%0D%0A%09DOC%281.1%29%3AGarlic+Chicken%0D%0A%094+boneless+skinless+chicken+breasts%0D%0A%094+garlic+cloves%2C+minced%0D%0A%094+tablespoons+brown+sugar%0D%0A%091+tablespoon+olive+oil%0D%0A%09additional+herbs+and+spices%2C+as+desired%0D%0A%09Q%281.1%29%3AGOTO%3A2%0D%0AA%3A+Mac+and+Cheese%0D%0A%09DOC%281.2%29%3AMac+and+Cheese%09%0D%0A%093%2F4+pound+dried+elbow+macaroni%0D%0A%091+1%2F2+cups+grated++sharp+cheddar+cheese%0D%0A%091%2F2+cup+grated+gruyere+cheese%0D%0A%091%2F3+cup+panko+bread+crumbs%2C+toasted+until+golden%0D%0A%09Q%281.2%29%3AGOTO%3A2%0D%0AQ%282%29%3A+Okay.+I+have+the+shopping+list+ready.+How+would+you+like+it%3F%0D%0AA%5Bjavascript%3Aalert%28doc%28%29%29%3B%5D%3A+In+an+alert+box.%0D%0A%09Q%282.1%29%3AGOTO%3A3%0D%0AA%5Bjavascript%3Asave2%28%27list.txt%27%2Cdoc%28%29%29%3B%5D%3A+As+a+file+I+can+save.%0D%0A%09Q%282.2%29%3AGOTO%3A3%0D%0AQ%283%29%3A+Enjoy+the+grub.&font_family=Verdana%2C+Geneva%2C+sans-serif&font_size=14&line_height=20&col_width=500&frame_pad=15&radius=15&comp_bg=5489eb&comp_txt=ffffff&comp_link=e3fbfc&usr_bg=eeeeee&usr_txt=000000&usr_link=0000ff&sharing=2" style="width:300px;height:475px;border: solid 1px #555;"></iframe>
</td></tr></table>			
		
	<p>
		<b>Advanced Usage:</b>
	</p>
	<p>You can make use of the <code>submit2()</code> function (described below) to pass your document to either an HTML or Markdown parser/editor. So instead of saving a document directly to ones computer, a user could have a chance to edit his/her document before saving.</p>
	<p>
	Note: the <code>DOC:</code> content is just text. It doesn't matter if it's HTML, markdown, LaTeX, CommonAccord, whatever you like. 
	</p>
	</ul>

<a name="scripts"></a>
<h2>Predefined Javascript Functions</h2>
<p>All interactive QnA documents come preloaded with a set of five <a href="http://www.w3schools.com/js/js_functions.asp" target=_blank>Javascript functions</a>. As described above, these can be called from an <code>A</code> tag using the syntax: <code>A<font color=purple>[<font color=red>javascript:<em>function_name</em>();</font>]</font>:</code>. Below we'll explain what each of these functions do.</p>	


<a name="transcript"></a>
<h2><code>transcript(<font color=red><em>format</em></font>);</code></h2>
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
<h2><code>doc();</code></h2>
		<ul>
		<p>This function will return the <code>DOC:</code> content associated with rendered <code>Q</code> tags. For example, when selected, the following tag will display the <code>DOC:</code> content <code>A<font color=purple>[<font color=red>javascript:alert(doc());</font>]</font>: <font color=black>button text</code></code>.</p>
		<p>You may recall the use of this function in the <a href="#save">save conversation</a> example above.</p>
		<p>
		</ul>

<a name="mail2"></a>
<h2><code>mail2(<font color=red><em>to</em></font>, <font color=red><em>subject</em></font>, <font color=red><em>body</em></font>);</code></h2>
		<ul>
		<p>
		When called, this function will make use of the <a href="http://en.wikipedia.org/wiki/Mailto" target=_blank>mailto URI scheme</a> to open a new email in the user's default email program. This email will be addressed to <code><font color=red><em>to</em></font></code>, with the subject line <code><font color=red><em>subject</em></font></code>, and the body of the email will be <code><font color=red><em>body</em></font></code>. For example, when selected, the following tag will email a transcript of the current QnA to <em>jdoe@example.com</em> with the subject line <em>QnA Transcript</em>. <code>A<font color=purple>[<font color=red>javascript:mail2('jdoe@example.com','QnA Transcript',transcript());</font>]</font>: <font color=black>button text</code></code>.</p>
		<span style="background:yellow">Note: Due to a user's security settings, this function may not work if the QnA is embedded in an iframe.</span>
		</ul>

<a name="save2"></a>
<h2><code>save2(<font color=red><em>filename</em></font>,<font color=red><em>content</em></font>);</code></h2>
		<ul> 
		This function will save a file to the user's computer with the name <code><font color=red><em>filename</em></font></code> and content equal to <code><font color=red><em>content</em></font></code>. For example, when selected, the following tag will save a file named <em>QnA_document.txt</em> with contents equal to the output of the <code>doc()</code> function. <code>A<font color=purple>[<font color=red>javascript:save2('QnA_document.txt',doc());</font>]</font>: <font color=black>button text</code></code>.</p>
				<p>You may recall the use of this function from the <a href="#save">save conversation</a> example above.</p>
		</ul>

<a name="submit2"></a>
<h2><code>submit2(<font color=red><em>action</em></font>, <font color=red><em>method</em></font>, <font color=red><em>docAs</em></font>, <font color=red><em>instructions</em></font>, <font color=red><em>transcriptAs</em></font>);</code></h2>
		<ul>
		The entierty of a QnA conversation is wrapped in an <a href="http://www.w3schools.com/tags/tag_form.asp" target=_blank>HTML FORM</a> tag. This function will set that tag's <em>action</em> to <code><font color=red><em>action</em></font></code> and its <em>method</em> to <code><font color=red><em>method</em></font></code>. It will send the QnA's document as a single variable named <code><font color=red><em>docAs</em></font></code> along with an HTML transcript named <code><font color=red><em>transcriptAs</em></font></code>. It will send any variables defined by the <code>X:</code> tag as well as any hidden variables placed inside the document's <code>Q</code> and <code>A</code> tags. Additionally, it will send a variable named <code>i</code> with a value equal to <code><font color=red><em>instructions</em></font></code>. This last variable is intended specifically for use with the local document parser described below.
		</ul>


</ul>	
<a name="docs"></a>
<h2>Document Parsers &amp; Editors</h2>
<p>My hope is that this section will grow into a list of parsers as people point me to various parsers around the web. The basic idea is that by using the <code>submit2()</code> function in conjunction with a document parser/editor, it is possible to hold up the document created by a QnA for review by a person. Imagine a QnA that used a combination of <code>DOC:</code> and <code>X:</code> tags to craft a custom document for a <em>pro se</em> litigant. At the end of the QnA, that document can be passed to a parser and the user can take some time to edit the text before printing or saving it. The thing is that the <code>DOC:</code> tag doesn't really care what format its content is in. It could be HTML, markdown, or LaTex. By passing that content to a parser, it can be rendered and placed in a form that's easier for a user to digest.</p>	
<h3>Local HTML/Markdown Parser &amp; Editor</h3>
 <ul> <p>For now, I've set up a local HTML and Markdown parser, available at: (1) <a href="<?php echo $home ?>doc/parse/html/" target=_blank><?php echo $home ?>doc/parse/html/</a></li>; or (2) <a href="<?php echo $home ?>doc/parse/markdown/" target=_blank><?php echo $home ?>doc/parse/markdown/</a> depending on your needs. Guess which one parses markdown.</p>
 <p>The parsers read two variables which you can send them using the <code>submit2()</code> function. The first, <code>t</code>, is the content to be parsed, and the second, <code>i</code>, is a set of instructions to be displayed after parsing. In fact, <code>submit2()</code> takes <code>i</code> as an argument. That is <code>i</code> = <code><font color=red><em>instructions</em></font></code> as defined above.</p>
 
<a name="santa"></a>
<p>For example, the QnA below can be used to create a letter to Santa. Note: the document is in HTML. So you'll notice that line breaks are indicated by the HTML tag <a href="http://www.w3schools.com/tags/tag_br.asp" target=_blank>&lt;br&gt;</a>. Also, it is sent to the HTML parser. 
 </p>
<p><pre style="padding:0 10px 10px 10px;">Q(1): <font color=black>Would you like to write a letter to Santa? </font>
A: <font color=black>Yes.</font>
	Q(1.1): <font color=black>What is your name?</font>
	X:<font color=red>myname</font>
		DOC(1.1.1):<font color=black>Dear Santa,&lt;br&gt;&lt;br&gt; </font>

		Q(1.1.1): <font color=black>Have you been naughty or nice?</font>
		A: <font color=black>Naughty</font>
			DOC(1.1.1.1): <font color=black>I am sorry that I have been naughty. I will work hard to be nice in the new year.&lt;br&gt;&lt;br&gt;</font>
			Q(1.1.1.1):GOTO:<font color=red>2</font>
		A: <font color=black>Nice</font>
			Q(1.1.1.2):GOTO:<font color=red>2</font>			
A: <font color=black>No.</font>
	Q(1.2): <font color=black>That's cool. Have a good day.</font>

Q(2): <font color=black>What would you like for Christmas?</font>
X:<font color=red>whatiwant</font>
	DOC(2.1):	<font color=black>I would like </font>&lt;x&gt;<font color=red>whatiwant</font>&lt;/x&gt;<font color=black> for Christmas. I hope all is well with you up north.&lt;br&gt;&lt;br&gt;
			Sincerely,&lt;br&gt;
			</font>&lt;x&gt;<font color=red>myname</font>&lt;/x&gt;
	Q(2.1): <font color=black>Alright, are you ready to see your letter?</font>
	A<font color=purple>[<font color=red>javascript:submit2('<?php echo $home ?>doc/parse/html/', 'POST', 't', 'Proof read your letter. Print it out, and mail it to: Santa Clause, North Pole')</font>]</font>: <font color=black>Yes.</font>
		Q(2.1.1): <font color=black>Thank you.</font></pre><p>
<p><iframe src="<?php echo $home ?>i/?markup=Q%281%29%3A+Would+you+like+to+write+a+letter+to+Santa%3F+%0D%0AA%3A+Yes.%0D%0A%09Q%281.1%29%3A+What+is+your+name%3F%0D%0A%09X%3Amyname%0A%09%09DOC%281.1.1%29%3ADear+Santa%2C%3Cbr%3E%3Cbr%3E+%0D%0A%0D%0A%09%09Q%281.1.1%29%3A+Have+you+been+naughty+or+nice%3F%0D%0A%09%09A%3A+Naughty%0D%0A%09%09%09DOC%281.1.1.1%29%3A+I+am+sorry+that+I+have+been+naughty.+I+will+work+hard+to+be+nice+in+the+new+year.%3Cbr%3E%3Cbr%3E%0D%0A%09%09%09Q%281.1.1.1%29%3AGOTO%3A2%0D%0A%09%09A%3A+Nice%0D%0A%09%09%09Q%281.1.1.2%29%3AGOTO%3A2%09%09%09%0D%0AA%3A+No.%0D%0A%09Q%281.2%29%3A+That%27s+cool.+Have+a+good+day.%0D%0A%0D%0AQ%282%29%3A+What+would+you+like+for+Christmas%3F%0D%0AX%3Awhatiwant%0A%09DOC%282.1%29%3A%09I+would+like+%3Cx%3Ewhatiwant%3C%2Fx%3E+for+Christmas.+I+hope+all+is+well+with+you+up+north.%3Cbr%3E%3Cbr%3E+%0D%0A%09%09%09Sincerely%2C%3Cbr%3E%0D%0A%09%09%09%3Cx%3Emyname%3C%2Fx%3E+%0D%0A%09Q%282.1%29%3AAlright%2C+are+you+ready+to+see+your+letter%3F%0D%0A%09A%5Bjavascript%3Asubmit2%28%27http%3A%2F%2Fwww.davidcolarusso.com%2FQnA%2Fdoc%2Fparse%2Fhtml%2F%27%2C%27POST%27%2C%27t%27%2C%27Proof+read+your+letter.+Print+it+out%2C+and+mail+it+to%3A+Santa+Clause%2C+North+Pole%27%29%5D%3A+Yes.%0D%0A%09%09Q%282.1.1%29%3A+Thank+you.&font_family=Verdana%2C+Geneva%2C+sans-serif&font_size=14&line_height=20&col_width=320&frame_pad=15&radius=15&comp_bg=5489eb&comp_txt=ffffff&comp_link=e3fbfc&usr_bg=eeeeee&usr_txt=000000&usr_link=0000ff&sharing=2" style="width:100%;height:510px;border: solid 1px #555;"></iframe>
</p>			

</ul>

<div class=footer style="float:left;width:100%;margin:30px 0 0 0;padding:15px 0px;border-top: solid 1px #aaa;">
	<?php if ($bugs == 1) { echo "<span style=\"float:right;\"><a href=\"https://github.com/colarusso/QnAMarkup/issues\" target=_blank>report bug/issue</a></span>"; } ?>
	Updated 2014-12-22
</div>
</div> 
<?php echo $analytics_code ?>
</BODY>
</HTML>