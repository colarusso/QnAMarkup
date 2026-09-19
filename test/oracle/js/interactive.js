<script type="text/javascript">
	var QNum = 0;
	var Qhtml = "";
	var Dhtml = "";
	var label = "";
	var GOTOfired = 0;
	var path = [];
	var doc_bin = [];
	var convo_bin = [];
	var freetext = 0;
	var goingback = 0;

	$("#conversation input").on("keypress", 'form', function (e) {
    	var code = e.keyCode || e.which;
    	if (code == 13) {
        	e.preventDefault();
        	return false;
    	}
	});

	function answerQ(lb,restart) {
		currentQ = label;
		label = lb;
		Dhtml = 'D-'+label;
		Qhtml = 'Q-'+label;
		var Ahtml = 'A-'+label;
		var Jhtml = 'J-'+QNum;
		var Xhtml = 'X-'+label;
		var Xihtml = 'Xi-'+label;
		
		var input_error = 0;
		if (restart == undefined) {
			var regexp = new RegExp("\<variable\>");
			//if (document.getElementById(Xihtml)) {
			//	console.log("document.getElementById("+Xihtml+").value: "+document.getElementById(Xihtml).value);
			//} else {
			//	console.log("NO document.getElementById("+Xihtml+").value: ");
			//}
			if (document.getElementById(Ahtml).innerHTML.match(regexp)) {
				document.getElementById(Xihtml).value = document.getElementById(Xihtml).value.replace(/(^\s*|\s*$)/,"");
				if (document.getElementById(Xihtml).value == "") {
					input_error = "Your answer appears to be empty.";
					label = currentQ;
				} else {
					document.getElementById(Xihtml).value = document.getElementById(Xihtml).value.replace(/</g,"&lt;");
					document.getElementById(Xihtml).value = document.getElementById(Xihtml).value.replace(/>/g,"&gt;");
				}
			} 
		}
			
		if (input_error != 0) {
			alert(input_error);
			document.getElementById(Xihtml).focus();			
		} else {
			if (restart == undefined) {
				document.getElementById('QandA').innerHTML += "<div id=\"break-at-"+QNum+"\" class='frame'><div class='full'><div class='ans_text'>"+document.getElementById(Ahtml).innerHTML+"</div></div><div class='ans_arrow'></div></div></div></div>";
				// insert answer from button
				if (document.getElementById(valueis(currentQ))) {
					document.getElementById(valueis(currentQ)).outerHTML='';
				}
				if (document.getElementById(Xihtml)) {
					document.getElementById('QandA').innerHTML = "<textarea style=\"display:none;\" id=\""+valueis(currentQ)+"\" name=\""+valueis(currentQ)+"\">"+document.getElementById(Xihtml).value+"</textarea>\n" + document.getElementById('QandA').innerHTML				
				} else {
					document.getElementById('QandA').innerHTML = "<textarea style=\"display:none;\" id=\""+valueis(currentQ)+"\" name=\""+valueis(currentQ)+"\">"+document.getElementById(Xhtml).innerHTML+"</textarea>\n" + document.getElementById('QandA').innerHTML
				}
				if (document.getElementById('QandA').innerHTML.match(regexp)) {
				 	var duplicatevars = new RegExp("id=\""+document.getElementById(Xhtml).innerHTML+"(.)*"+document.getElementById(Xhtml).innerHTML+"\"","g");
					document.getElementById('QandA').innerHTML = document.getElementById('QandA').innerHTML.replace(duplicatevars, "");
					document.getElementById('QandA').innerHTML = document.getElementById('QandA').innerHTML.replace(/\<variable\>(\<\/variable\>)?/, "<input type=hidden id=\""+document.getElementById(Xhtml).innerHTML+"\" name=\""+document.getElementById(Xhtml).innerHTML+"\" value=\""+document.getElementById(Xihtml).value+"\"/>"+document.getElementById(Xihtml).value);
					//document.getElementById('transcript').value = document.getElementById('transcript').value.replace(/\<variable\>(\<\/variable\>)?/, document.getElementById(Xihtml).value+"\n");
					var thisvariable = new RegExp("<(X|x)>"+document.getElementById(Xhtml).innerHTML+"<\/(X|x)>","g");
					//document.getElementById('doc').innerHTML = document.getElementById('doc').innerHTML.replace(thisvariable, document.getElementById(document.getElementById(Xhtml).innerHTML).innerHTML);
					//document.getElementById('ondeck').innerHTML = document.getElementById('ondeck').innerHTML.replace(thisvariable, document.getElementById(valueis(currentQ)).innerHTML);
					//console.log("thisvariable: "+thisvariable);
					//console.log("Variable name: "+valueis(currentQ));
					//console.log("Variable value: "+document.getElementById(valueis(currentQ)).innerHTML);
					if(document.getElementById(Ahtml).innerHTML != "") { 
						//document.getElementById('transcript').value += "USER: "+document.getElementById(Xihtml).value+"\n"; 
						convo_bin.push("USER: "+document.getElementById(Xihtml).value+"\n");
					}
				} else {
					//document.getElementById('transcript').value += "USER: "+document.getElementById(Ahtml).innerHTML+"\n";
					convo_bin.push("USER: "+document.getElementById(Ahtml).innerHTML+"\n");
				}
				document.getElementById('Choices').innerHTML = '';
				if (goingback == 0) {
					setTimeout(function() {renderQnA(Qhtml,Jhtml,Dhtml,restart)}, 300);
				} else {
					renderQnA(Qhtml,Jhtml,Dhtml,restart);
				}
			} else {
				document.getElementById('Choices').innerHTML = '';
				path = [];
				renderQnA(Qhtml,Jhtml,Dhtml,restart);			
			}

		}
		
	}


	function renderQnA(Qht,Jht,Dht,restar) {
		Dhtml = Dht;
					
		GOTOfired = 0;
		path.push(label);

		swapGOTO(Qht,Jht);

		console.log("After swap: "+GOTOfired);

		if (GOTOfired == 0) {
			document.getElementById('QandA').innerHTML += "<div id="+Jht+" style=\"float:left;width:100%;height:1px;\">&nbsp;</div>";
		}
		document.getElementById('QandA').innerHTML += "<div class='frame'><div class='full'><div class='question_text'>"+swapvar(document.getElementById(Qhtml).innerHTML)+"</div></div><div class='question_arrow'></div></div>";		

		document.getElementById('QandA').innerHTML = document.getElementById('QandA').innerHTML.replace(/(\<br\>){2}/gi,"</div></div><div class='question_arrow'></div></div></div></div><div class='frame'><div class='full'><div class='question_text'>");
		document.getElementById('QandA').innerHTML = document.getElementById('QandA').innerHTML.replace(/(\<br\> \<br\>)/gi,"<br><br>");

		// add question 
		//document.getElementById('transcript').value += swapvar("BOT: "+ document.getElementById(Qhtml).innerHTML);
		//document.getElementById('transcript').value = document.getElementById('transcript').value.replace(/(\<br\>){2}/gi,"\nBOT: ");
		this_text = swapvar("BOT: "+ document.getElementById(Qhtml).innerHTML);
		this_text = this_text.replace(/(\<br\>){2}/gi,"\nBOT: ");
		convo_bin.push(this_text);
				
		// make push doc into array in doc() cycle through array and put into output
		// maybe remove doc div
		if (document.getElementById(Dhtml)) {
			doc_bin.push([document.getElementById(Dhtml).innerHTML,currentQ]);
			console.log("Add to Doc ("+Dhtml+"): "+document.getElementById(Dhtml).innerHTML);
			//document.getElementById('doc').innerHTML += document.getElementById(Dhtml).innerHTML;
		}
						
		tmp = getElementsByIdRegExp("div", "A-"+label+"(\\.{1}\\d){1}$");
		a_href = getElementsByIdRegExp("div", "A-href-"+label+"(\\.{1}\\d){1}$");
		a_target = getElementsByIdRegExp("div", "A-target-"+label+"(\\.{1}\\d){1}$");
		tmp_x = getElementsByIdRegExp("div", "X-"+label+"(\\.{1}\\d){1}$");
		var Xishere = 0;
		for ( var i = 0; i < tmp.length; i++ ) {
			var nextlabel = tmp[i].id.substr(2);
			var Xihtml = 'Xi-'+nextlabel;
			var regexp = "\<variable\>";
			var regexp_js = "^javascript:";
			if (tmp[i].innerHTML.match(regexp)) {
				document.getElementById('Choices').innerHTML += "<div class=\"xdiv\"><input type=\"text\" id=\""+Xihtml+"\" name=\""+Xihtml+"\" class=\"xinput\" onkeypress=\"{if (event.keyCode==13)answerQ('"+nextlabel+"')}\"/><a href=\"javascript:void('');\" class=\"xbutton\" onClick=\"answerQ('"+nextlabel+"');\"><span class=\"qpad\">Save above text as answer.</span></a></div>";
				Xishere = Xihtml;
				freetext = Xihtml;
			} else if (a_href[i].innerHTML.match(regexp_js) && a_href[i].innerHTML != "javascript:void('');") {
				tmp[i].innerHTML = tmp[i].innerHTML.replace(/(\<br\>){2}/gi,"<br> <br>");
				var script_call = a_href[i].innerHTML.replace(/^javascript:/gi,"");
				document.getElementById('Choices').innerHTML += "<a href=\"javascript:void('');\" class=\"qabutton\" onClick=\"answerQ('"+nextlabel+"');"+script_call+"\" "+a_target[i].innerHTML+"><span class=\"qpad\">"+tmp[i].innerHTML+"</span></a>";							
				freetext = 0;
			} else {
				tmp[i].innerHTML = tmp[i].innerHTML.replace(/(\<br\>){2}/gi,"<br> <br>");
				document.getElementById('Choices').innerHTML += "<a href=\""+a_href[i].innerHTML+"\" class=\"qabutton\" onClick=\"answerQ('"+nextlabel+"');\" "+a_target[i].innerHTML+"><span class=\"qpad\">"+tmp[i].innerHTML+"</span></a>";				
				freetext = 0;
			}
		}			

		if (restar == undefined) {
			
			document.getElementById('Choices').innerHTML += "<div class=\"standard_buttons\">";
			if (QNum > 1) { 
				document.getElementById('Choices').innerHTML += "<a href=\"javascript:void('');\" class=\"sbutton\" onClick=\"goback(QNum);\">GO BACK ONE</a>";
				document.getElementById('Choices').innerHTML += "<a href=\"javascript:void('');\" class=\"sbutton\" style=\"float:right\" onClick=\"startAT('1');\">START OVER</a>";
			} else if (QNum == 1) {
				document.getElementById('Choices').innerHTML += "<a href=\"javascript:void('');\" class=\"sbutton\" onClick=\"startAT('1');\">GO BACK ONE</a>";
				document.getElementById('Choices').innerHTML += "<a href=\"javascript:void('');\" class=\"sbutton\" style=\"float:right\" onClick=\"startAT('1');\">START OVER</a>";				
			}
			document.getElementById('Choices').innerHTML += "</div>"
		}
				
		if (QNum != 0) { 
			if (goingback == 0) {
				scroll2Q(Jht,800);           	
			} else {
				window.scrollTo(0, document.getElementById(Jht).offsetTop);     		
			}
		} else if (restar != undefined) {
			window.scrollTo(0,0);
		}
		if (Xishere != 0 && window.self == window.top) {
			console.log("Set focus for: "+Xishere);
			document.getElementById(Xishere).focus();
		}
		console.log("Q#: "+QNum);
		console.log("New Path: "+path);
		QNum++;
		goingback = 0;
					
	}

	
	function swapGOTO(QH,JH) {
		var regex = new RegExp("GOTO:(\d*)(\.\d+)*");
		if (regex.test(document.getElementById(QH).innerHTML)) {
			var Qtext = document.getElementById(QH).innerHTML.match(/(GOTO:(\d*)(.\s*\d+)*)/);
			document.getElementById('QandA').innerHTML += "<div id="+JH+" style=\"float:left;width:100%;height:1px;\">&nbsp;</div>";
			// Add question
			// note I added () around the < to avoid a < followed by a ? which causes problems in php
			var Qtexttrans = document.getElementById(QH).innerHTML.replace(/(<)?GOTO:(\d*)(.\s*\d+)*>?/,"");
			Qtexttrans = Qtexttrans.replace(/\s*$/,"");
			if (Qtexttrans != "") {
				//document.getElementById('transcript').value += swapvar("BOT: "+Qtexttrans+"\n");
				convo_bin.push(swapvar("BOT: "+Qtexttrans+"\n"));
			}
			if (document.getElementById(QH).innerHTML.match(/^GOTO:(\d*)(.\s*\d+)*/)) {
				document.getElementById('QandA').innerHTML += document.getElementById(QH).innerHTML.replace(/(<)?GOTO:(\d*)(.\s*\d+)*>?/,"<"+Qtext+">");
			} else {
				document.getElementById('QandA').innerHTML += "<div class='frame'><div class='full'><div class='question_text'>"+ swapvar(document.getElementById(QH).innerHTML.replace(/(<)?GOTO:(\d*)(.\s*\d+)*>?/,"<"+Qtext+">"))+"</div></div><div class='question_arrow'></div></div>";						
			}
			// replace GOTO with text
			label = Qtext[0].replace("GOTO:","");
			Qhtml = 'Q-'+label;
			if (document.getElementById(Dhtml)) {
				doc_bin.push([document.getElementById(Dhtml).innerHTML,currentQ]);
				console.log("Add to Doc ("+Dhtml+"): "+document.getElementById(Dhtml).innerHTML);
				//document.getElementById('doc').innerHTML += document.getElementById(Dhtml).innerHTML;
			}
			Dhtml = 'D-'+label;
			GOTOfired = 1;
			console.log("In swap: "+GOTOfired);
			swapGOTO(Qhtml,JH);
		}
	}

	
	function scroll2Q(id,speed) {
		var top = document.getElementById(id).offsetTop; //Getting Y of target element
		console.log("Jump to Y for ("+id+"): "+top);
		//adapted from https://github.com/Yappli/smooth-scroll
		var moving_frequency = 5; // Affects performance !
		var hop_count = speed/moving_frequency
        var getScrollTopDocumentAtBegin = document.documentElement.scrollTop + document.body.scrollTop;
        var gap = (top - getScrollTopDocumentAtBegin) / hop_count;
		for(var i = 1; i <= hop_count; i++)
        {
        	(function()
           	{
           		var hop_top_position = gap*i;
           	    setTimeout(function(){  window.scrollTo(0, hop_top_position + getScrollTopDocumentAtBegin); }, moving_frequency*i);
           	 })();
        }
	}

	function getElementsByIdIs(selectorTag, name) {
		var items = [];
		var myPosts = document.getElementsByTagName(selectorTag);
			//omitting undefined null check for brevity
			if (myPosts[0].id == name) {
				items.push(myPosts[0]);
			}
		
		return items;
	}

	function getElementsByIdRegExp(selectorTag, expression) {
		// note you need to escape \ in the expression with \, i.e., \\ = \
		var regex = new RegExp(expression);
		var items = [];
		var myPosts = document.getElementsByTagName(selectorTag);
		for (var i = 0; i < myPosts.length; i++) {
			if (regex.test(myPosts[i].id)) {
				items.push(myPosts[i]);
			}
		}
		
		return items;
	}	

	// startAT QnA
	function startAT(id) {
		document.getElementById('ondeck').innerHTML = document.getElementById('original').value;
		document.getElementById('QandA').innerHTML = "";
		//document.getElementById('transcript').value = "";
		doc_bin = [];
		convo_bin = [];
		QNum = 0;
		answerQ(id,'1');
	}
		
	//show funtion
	function show(id) { 
   		if (document.getElementById) { // DOM3 = IE5, NS6
        	document.getElementById(id).style.display = 'block';
    	} else { 
        	if (document.layers) {  
            	document.id.display = 'block';
        	} else {
                document.all.id.style.display = 'block';
        	}
    	}
	}

	//hide funtion
	function hide(id) { 
    	if (document.getElementById) { // DOM3 = IE5, NS6
        	document.getElementById(id).style.display = 'none';         
    	} else { 
        	if (document.layers) {  
                document.id.display = 'none';
        	} else {
                document.all.id.style.display = 'none';
        	}
    	}
	}

	//show OR hide funtion depends on if element is shown or hidden
	function shoh(id) { 
    	if (document.getElementById) { // DOM3 = IE5, NS6
        	if (document.getElementById(id).style.display == "none"){
            	document.getElementById(id).style.display = 'block';
        	} else {
            	document.getElementById(id).style.display = 'none';         
        	}   
    	} else { 
        	if (document.layers) {  
            	if (document.id.display == "none"){
                	document.id.display = 'block';
            	} else {
                	document.id.display = 'none';
            	}
        	} else {
            	if (document.all.id.style.visibility == "none"){
                	document.all.id.style.display = 'block';
            	} else {
                	document.all.id.style.display = 'none';
            	}
        	}
    	}
	}
	
	function swapvar(input) {
		var output; 
		for(var i = 0; i < QVnames.length; i++) {
			if (document.getElementById(QVnames[i][1])) {
				var item = QVnames[i][1].replace(/\./g,"\\.");
				var varegx = new RegExp("<x>"+item+"<\/x>","gi");
				//console.log(QVnames[i][1]);
				input = input.replace(varegx,document.getElementById(QVnames[i][1]).innerHTML);
			} 
		}
		output = input
		return output
	}
	
	function docforindex(indexID) {
		for(var i = 0; i < doc_bin.length; i++) {
			if(doc_bin[i][1] == indexID) {
				return true;
			}
		}
	}
	function indexis(variablename) {
		for(var i = 0; i < QVnames.length; i++) {
			if(QVnames[i][1] == variablename) {
				return QVnames[i][0];
			}
		}
	}
	function valueis(variablekey) {
		for(var i = 0; i < QVnames.length; i++) {
			if(QVnames[i][0] == variablekey) {
				return QVnames[i][1];
			}
		}
	}
	
	function look4goto(qn,id) {
		console.log("GOTO SEARCH: "+id);
		var qID = "Q-"+id;
		// If there's a doc in the XXXXXXXXXXXXXXXX, remove it.
		if (docforindex(path.indexOf(id))) {
			console.log("DOC FOUND "+id);
			doc_bin.splice(doc_bin.length-1,1);
		}
		convo_bin.splice(-2,2);
		var re = new RegExp("GOTO:(([a-z0-9\._-]*)\s*)$","gi");
		if (document.getElementById(qID).innerHTML.match(re)) {
			convo_bin.splice(-1,1);
			console.log("GOTO FOUND: "+id);
			textinput = re.exec(document.getElementById(qID).innerHTML)[2]+"";
			if (docforindex(indexis(textinput))) {
				document.getElementById("Xi-"+path[qn]).value = document.getElementById(valueis(textinput)).innerHTML;
				console.log("DOC FOUND "+textinput);
				doc_bin.splice(doc_bin.length-1,1);
			}
			look4goto(qn,textinput);
		}
	}
	
	function goback(qn) {
		Qlast = qn - 3
		qn = qn - 2;
		label = path[qn];
		goingback = 1;
		
		console.log("GO BACK TO:"+qn);
		var re = new RegExp('(((^|\\n).*)*)<div id="break-at-'+qn+'" class="frame">((.*)(\\W.*))*', 'g');
		document.getElementById("QandA").innerHTML = document.getElementById("QandA").innerHTML.replace(re, '$1');
		document.getElementById('Choices').innerHTML += "<input type=\"hidden\" id=\"Xi-"+path[qn]+"\" name=\"Xi-"+path[qn]+"\" value=\"\">";
			console.log("####################: "+path[path.length-1]);
		
		//look4goto(qn,path[path.length-1]);
		
		path.splice(-1,1);
		convo_bin.splice(-4,4);
		//convo_bin.splice(-2,2);

		// If there's a doc in the last Q that you're removing, hold on to it.
		// And put it back after you've removed it. When you rerender the Q.
		if (document.getElementById("X-"+path[qn]) && document.getElementById(valueis(path[Qlast]))) {
			document.getElementById("Xi-"+path[qn]).value = document.getElementById(valueis(path[Qlast])).innerHTML;
			doc_bin.splice(doc_bin.length-1,1);
		}
		
		// If there's a doc in the current Q, remove it.
		if (docforindex(currentQ)) {
			console.log("DOC FOUND (current) "+currentQ);
			doc_bin.splice(doc_bin.length-1,1);
		}
		// If there's a doc in the queued up Q, remove it. 
		if (document.getElementById(Dhtml)) {
			console.log("DOC FOUND (ondeck)"+Dhtml);
			doc_bin.splice(doc_bin.length-1,1);
		}
		
		look4goto(qn,path[path.length-1]);
		
		if (freetext != 0) {
			document.getElementById(freetext).value = "";
		}
		QNum = qn;
		loadQ = path[path.length-1];
		path.splice(-1,1);
		
		console.log("Reload ans for: "+loadQ);
		answerQ(loadQ);
	}

	function transcript(output) {
		var convo_output = "";
		for (var i = 0, len = convo_bin.length; i < len; i++) {
			convo_output += convo_bin[i];
		}
		if (output == 1) {
			return convo_output;
		} else {
			return convo_output.replace(/<[^>]*>/g,"");
		}
	}		
	
	function doc() {
		var doc_output = ""; 
		for (var i = 0, len = doc_bin.length; i < len; i++) {
			doc_output += doc_bin[i][0];
		}
		return swapvar(doc_output);
	}	
	
	function json_str() {
		
		var json_list = "{";
		for(var i = 0; i < QVnames.length; i++) {
			if (!document.getElementById("Q-"+QVnames[i][0]).innerHTML.match(/(GOTO:(\d*)(.\s*\d+)*)/)) {
				if (document.getElementById(QVnames[i][1])) {
					json_list = json_list+'"'+QVnames[i][1]+'":"'+document.getElementById(QVnames[i][1]).innerHTML+'"';
				} else {
					json_list = json_list+'"'+QVnames[i][1]+'":"'+'"';
				}
				json_list = json_list+",";
			} 
			if (i+1 == QVnames.length) {
				json_list = json_list.replace(/,$/, '');
				json_list = json_list+"}";
			}
		}
		return json_list;
	}

	function mail2(to,subject,body) {
		to = encodeURIComponent(to);
		subject = encodeURIComponent(subject);
		body = encodeURIComponent(body);
		window.location.href = "mailto:"+to+"?subject="+subject+"&body="+body;
	}
	
	function submit2(action,method,docAs,instructions,transcriptAs,jsonAs,target) {
		document.FORM.action = action;
		document.FORM.method = method;
		if (target) {
			document.FORM.target = target;
		} else {
			document.FORM.target = "_self";		
		}
		
		if (docAs) {
			var doctext = document.createElement("textarea");
			doctext.style.display ='none';
			doctext.name= docAs;
			doctext.value= doc();
			document.getElementById('FORM').appendChild(doctext);
			if (instructions) {
				var instructtext = document.createElement("textarea");
				instructtext.type='hidden';
				instructtext.style.display ='none';
				instructtext.name= 'i';
				instructtext.value= instructions;
				document.getElementById('FORM').appendChild(instructtext);	
			}
		}
		if (transcriptAs) {
			var ttext = document.createElement("textarea");
			ttext.type='hidden';
			ttext.style.display ='none';
			ttext.name= transcriptAs;
			ttext.value= transcript();
			document.getElementById('FORM').appendChild(ttext);
		}
		if (jsonAs) {
			var json = document.createElement("textarea");
			json.type='hidden';
			json.style.display ='none';
			json.name= jsonAs;
			json.value= json_str();
			document.getElementById('FORM').appendChild(json);
		}
		var ondeckdiv = document.getElementById('ondeck').innerHTML;
		var rawmarkupdiv = document.getElementById('rawmarkup').innerHTML;
		document.getElementById('ondeck').innerHTML = "";
		document.getElementById('rawmarkup').innerHTML = "";
		document.FORM.submit();
		document.getElementById('ondeck').innerHTML = ondeckdiv;
		document.getElementById('rawmarkup').innerHTML = rawmarkupdiv;
	}

	// h/t http://runnable.com/U5HC9xtufQpsu5aj/use-javascript-to-save-textarea-as-a-txt-file
	function save2(filename,content)
	{

	// I'm using file system support as a proxy for support for this feature. 
	// Check based on one found at: http://blog.teamtreehouse.com/building-an-html5-text-editor-with-the-filesystem-apis
	// Handle vendor prefixes.
	window.requestFileSystem = window.requestFileSystem || 
							   window.webkitRequestFileSystem;
	// Check for support.
	if (window.requestFileSystem) {
	// content = ID of textarea to save
	// name = name to save file as, including file extension     
	// grab the content of the form field and place it into a variable
	//    var textToWrite = document.getElementById(content).value;
	//  create a new Blob (html5 magic) that conatins the data from your form feild
		var textFileAsBlob = new Blob([content], {type:'text/plain'});
		
	// Specify the name of the file to be saved
		var fileNamecontentAs = filename;
		
	// Optionally allow the user to choose a file name by providing 
	// an imput field in the HTML and using the collected data here
	// var fileNamecontentAs = txtFileName.text;

	// create a link for our script to 'click'
		var downloadLink = document.createElement("a");
	//  supply the name of the file (from the var above).
	// you could create the name here but using a var
	// allows more flexability later.
		downloadLink.download = fileNamecontentAs;
	// provide text for the link. This will be hidden so you
	// can actually use anything you want.
		downloadLink.innerHTML = "My Hidden Link";
		
	// allow our code to work in webkit & Gecko based browsers
	// without the need for a if / else block.
		window.URL = window.URL || window.webkitURL;
			  
	// Create the link Object.
		downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
	// when link is clicked call a function to remove it from
	// the DOM in case user wants to save a second file.
		downloadLink.onclick = destroyClickedElement;
	// make sure the link is hidden.
		downloadLink.style.display = "none";
	// add the link to the DOM
		document.body.appendChild(downloadLink);
		
	// click the new link
		downloadLink.click();
	} else {
		alert('This feature is not supported by your browser.');
	}
		
	}

	function destroyClickedElement(event)
	{
	// remove the link from the DOM
		document.body.removeChild(event.target);
	}

	// EOF

</script>
