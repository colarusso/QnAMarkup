<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"> 
<HTML xmlns="http://www.w3.org/1999/xhtml"
      xmlns:og="http://ogp.me/ns#"
      xmlns:fb="http://www.facebook.com/2008/fbml">
<HEAD>
	<TITLE>Document Editor</TITLE>
  	<script src="//code.jquery.com/jquery-1.10.2.js"></script>
  	<script src="//code.jquery.com/ui/1.11.1/jquery-ui.js"></script>
	<script src="//cdn.ckeditor.com/4.4.5/full/ckeditor.js"></script>
	
	<base href="<?php echo $home?>">
	<link rel="stylesheet" type="text/css" href="css/generic.css">

</HEAD>
<BODY BGCOLOR="#ffffff" BACKGROUND="" MARGINWIDTH="0" MARGINHEIGHT="0">
<div style="max-width:800px;margin:0px auto;padding:0 15px 40px 15px;">
<form> 
<p>
	<span style="float:right;"><a href="javascript:void('');" onClick="CKEDITOR.instances['t'].execCommand('maximize');">maximize editor</a></span>
	<input id="inputfile" type="file" style="display:none;"/>
	<a href="javascript:void('');" onClick="CKEDITOR.instances['t'].setData('', function() { CKEDITOR.instances['t'].resetDirty(); });">clear</a>
	&nbsp;&nbsp;<a href="javascript:void('');" id="upload_link">load file</a>
	&nbsp;&nbsp;<a href="javascript:void('')" onCLick="saveCKEditor();">save as</a>
</p>
<?php if ($i) { echo "<p style=\"background:#ddffdd;padding:15px;\">$i</p>"; } ?>
<p><textarea name="t" id="t"><?php echo $t ?></textarea></p>
<p>
If you'd like to save your work and come back later, use the <em>save as</em> link to save this document to your computer. When you're ready to work on it again, visit: <?php echo "<a href=\"".$home."doc/\">$home"."doc/</a>" ?> and load your file. Alternatively, you should be able to edit the saved file in most word processors, such as MS Word. However, in that case, you may lose some of the formatting above.
</p>
<p>This page provides a WYSIWYG editor for use in conjunction with <a href="<?php echo $home ?>syntax/#docs">QnA-assisted document construction</a>.</p>
<div class=footer style="margin:30px 0 0 0;padding:15px 3px;border-top: solid 1px #aaa;">
<a href="<?php echo $home ?>">QnA Editor</a>
</div>
</from>
</div> 
<script type="text/javascript">
	CKEDITOR.replace( 't', {
		// See http://ckeditor.com/latest/samples/plugins/toolbar/toolbar.html
		toolbar: [
			{ name: 'document', groups: [ 'mode', 'document', 'doctools' ], items: [ 'Source', '-', 'Preview', 'Print' ] },	
			{ name: 'clipboard', groups: [ 'clipboard', 'undo' ], items: [ 'Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo' ] },
			{ name: 'editing', groups: [ 'find', 'selection', 'spellchecker' ], items: [ 'Find', 'Replace', '-', 'SelectAll', '-', 'Scayt' ] },
			{ name: 'insert', items: [ 'Image', 'Table', 'HorizontalRule', 'SpecialChar', 'PageBreak'] },
			{ name: 'tools', items: [ 'Maximize' ] },
			{ name: 'others', items: [ '-' ] },
			{ name: 'about', items: [ 'About' ] },
			'/',
			{ name: 'basicstyles', groups: [ 'basicstyles', 'cleanup' ], items: [ 'Bold', 'Italic', 'Underline', 'Strike', 'Subscript', 'Superscript', '-', 'RemoveFormat' ] },
			{ name: 'paragraph', groups: [ 'list', 'indent', 'blocks', 'align', 'bidi' ], items: [ 'NumberedList', 'BulletedList', '-', 'Outdent', 'Indent', '-', 'Blockquote', '-', 'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock', '-', 'BidiLtr', 'BidiRtl'] },
			{ name: 'links', items: [ 'Link', 'Unlink', 'Anchor','-', 'ShowBlocks'] },
			'/',
			{ name: 'styles', items: [ 'Styles', 'Format', 'Font', 'FontSize' ] },
			{ name: 'colors', items: [ 'TextColor', 'BGColor' ] }
		]
	});
	
	CKEDITOR.on('instanceReady',
	function( evt ) {
		var editor = evt.editor;
	//	editor.execCommand('maximize');
    });
	
	function clearCKEDITOR() {
	}
	
	$(function(){
	$("#upload_link").on('click', function(e){
		e.preventDefault();
		$("#inputfile:hidden").trigger('click');
	});
	});

	// http://docs.ckeditor.com/#!/api/CKEDITOR.editor-method-checkDirty
	function beforeUnload( evt ) {
		if ( CKEDITOR.instances['t'].checkDirty() )
			return evt.returnValue = "If you have not saved your most-recent changes, they will be lost.";
	}

	if ( window.addEventListener )
		window.addEventListener( 'beforeunload', beforeUnload, false );
	else
		window.attachEvent( 'onbeforeunload', beforeUnload );	
	

	// h/t http://answers.splunk.com/answers/125819/fill-textarea-from-a-file.html
	 //External data file handling starts here
	 var control = document.getElementById("inputfile");    
		 control.addEventListener("change", function(event){    
			if (window.File && window.FileReader && window.FileList && window.Blob) {
				var reader = new FileReader();        
				 reader.onload = function(event){
					 var contents = event.target.result;        
					   //document.getElementById('putcontentshere').value = contents; 
					   CKEDITOR.instances['t'].setData(contents, function() { CKEDITOR.instances['t'].resetDirty(); });
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
			
		
	// h/t http://runnable.com/U5HC9xtufQpsu5aj/use-javascript-to-save-textarea-as-a-txt-file
	function saveCKEditor()
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
		var textToWrite = CKEDITOR.instances['t'].getData()
	//  create a new Blob (html5 magic) that conatins the data from your form feild
		var textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
		
	// Specify the name of the file to be saved
		var fileNamecontentAs = 'CKEditor_output.html';
		
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
		alert('This feature is not supported by your browser. You could, however, cut-and-paste your text into a standard text editor to save it.');
	}
		
	}

	function destroyClickedElement(event)
	{
	// remove the link from the DOM
		document.body.removeChild(event.target);
	}

	// EOF

</script>
<?php echo $analytics_code ?>
</BODY>
</HTML>
