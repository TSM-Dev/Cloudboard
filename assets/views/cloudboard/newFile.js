$(document).ready(function() {

	var r = new Resumable({
		bootstrapTarget: '{{pages.apiBootstrapFile.uri}}',
		checkTarget: '{{pages.apiCheckFile.uri}}',
		saveTarget: '{{pages.apiSaveFile.uri}}',
		simultaneousUploads: 1
	});

	// Resumable.js isn't supported, fall back on a different method
	if(!r.support) {

		window.location.replace('{{pages.home.uri}}');
	}

	var checkProcessing = [];

	function addToProcessing(file) {

		//If we are adding a file that being processed then don't enable the cancel button...as it can't be cancelled now
		if(file.success != "Processing") {
			$('#progress-cancel-link').removeClass('button-disabled');
		}

		var found = false;

		for(var i = 0; i < checkProcessing.length; i++) {
			if(checkProcessing[i] == file) {
				found = true;
				break;
			}
		}

		if(found == false) {
			checkProcessing.push(file);
		}
	};

	function removeProcessing(key) {

		var checking = checkProcessing.slice(0);

		for(var i = 0; i < checking.length; i++) {

			if(checking[i].key == key) {

				checkProcessing.splice(i, 1);
			}
		}

		//We have removed all items to be processed so don't show action buttons
		if(checkProcessing.length == 0) {
			$('#progress-resume-link').addClass('button-disabled');
			$('#progress-pause-link').addClass('button-disabled');
			$('#progress-cancel-link').addClass('button-disabled');
		}
	};

	var checkHistory = function() {

		var checking = checkProcessing.slice(0);

		//We are checking this file so remove it so it won't be checked again until it has been first checked
		checkProcessing = [];

		for(var i = 0; i < checking.length; i++) {

			var file = checking[i];

			if(file.success == "Successful" || file.success == "Failed") {
				continue;
			}

			var getFile = $.ajax({
				type: "POST", 
				url: '{{pages.apiGetFile.uri}}', 
				data: { 
					id : file.key
				}
			});

			getFile.done(function(result) {

				console.log(result);

				if(result.success == true) {

					var processingFile = result.file;

					//We are uploading the file...or processing it...so update the history to prevent flickering
					if(processingFile.success == "Processing" || processingFile.success == "Uploading" || processingFile.success == "Pending") {

						updateHistory(processingFile, 'prepend', 'update');

						addToProcessing(processingFile);

					//It is at an end state of Failed or Success, so update the history to the top of the list
					} else if(processingFile.success == "Successful" || processingFile.success == "Failed") {

						updateHistory(processingFile, 'prepend', 'remove');
					}
					
				} else {

					console.log("Could not get file.");
					console.log(result.message);
				}
			});		

			getFile.fail(errorHandler);
		}
	};

	function updateTags() {

		var tags = $('.tags li').not('#default-tag-item').not('.new-tag').map(function() {
			return $(this).children('.tag-text').text();
		}).get();

		r.setTags(tags);
	}
	
	// Handle file add event
	r.on('fileAdded', function(file) {

		// Show pause, hide resume
		$('#progress-resume-link').addClass('button-disabled');
		$('#progress-pause-link').removeClass('button-disabled');
		$('#progress-cancel-link').removeClass('button-disabled');
			
		updateHistory(file, 'prepend', 'remove');

		if(file.success == "Processing" || file.success == "Uploading" || file.success == "Pending") {
			addToProcessing(file);
		}

		// Actually start the upload
		r.upload();
	});

	r.on('pause', function() {
		$('#progress-resume-link').removeClass('button-disabled');
		$('#progress-pause-link').addClass('button-disabled');
	});
	
	r.on('complete', function() {

		// Hide pause/resume when the upload has completed
		$('#progress-resume-link').addClass('button-disabled');
		$('#progress-pause-link').addClass('button-disabled');
		$('#progress-cancel-link').addClass('button-disabled');
	});

	r.on('fileError', function(file, message) {

		// Reflect that the file upload has resulted in error
		//console.log(message);

		//updateHistory(file);
	});

	r.on('alreadyQueued', function() {

		alert("Already queued");
	});
	
	r.on('uploadStart', function() {

		// Show pause, hide resume
		$('#progress-resume-link').addClass('button-disabled');
		$('#progress-pause-link').removeClass('button-disabled');
		$('#progress-cancel-link').removeClass('button-disabled');
	});

	$("#progress-resume-link").click(function() {

		if($(this).hasClass('button-disabled') == false) {
			console.log("Resuming...");
			r.upload();
		}
	});

	$("#progress-pause-link").click(function() {

		if($(this).hasClass('button-disabled') == false) {
			console.log("Pausing all uploads...");
			r.pauseAll();
		}
	});

	function removeOne(key) {

		window.clearInterval(timer);

		var removeFile = $.ajax({
			type: "POST", 
			url: '{{pages.apiRemoveFile.uri}}', 
			data: { 
				key : key
			}
		});

		removeFile.done(function(result) {

			if(result.success == true) {

				removeProcessing(key);

				var item = $('#history .history-item[data-id="' + key + '"]');

				$(item).remove();

			} else {

				console.log("Could not remove file.");
				console.log(result.message);
			}

			timer = window.setInterval(checkHistory, 5000);
		});		

		removeFile.fail(errorHandler);
	}


	$('#progress-cancel-link').click(function() {

		if($(this).hasClass('button-disabled') == false) {

			$('#progress-resume-link').addClass('button-disabled');
			$('#progress-pause-link').addClass('button-disabled');
			$('#progress-cancel-link').addClass('button-disabled');
		
			r.cancelAll();

			var checking = checkProcessing.slice(0);

			for(var i = 0; i < checking.length; i++) {

				//We don't want to cancel something thats being processed
				if(checking[i].success != "Processing") {

					removeOne(checking[i].key);
				}
			}
		}
	});


	$('#history').on('click', '.fa-play', function() {
	
		console.log("Resume One");

		var historyItem = $(this).closest('.history-item');	

		var key = $(historyItem).attr('data-id');

		var exists = r.resumeOne(key);

		//We need to select the file to be uploaded to continue uploading
		if(exists == false) {

			$('#upload').trigger('click');
		}
	});

	$('#history').on('click', '.fa-pause', function() {
	
		console.log("Pause One");

		var historyItem = $(this).closest('.history-item');	

		var key = $(historyItem).attr('data-id');

		r.pauseOne(key);
	});

	$('#history').on('click', '.fa-times-circle', function() {
	
		console.log("Cancel One");

		var historyItem = $(this).closest('.history-item');	

		var key = $(historyItem).attr('data-id');

		r.cancelOne(key);

		removeOne(key);
	});

	$('#upload-options').on('click', '.fa-check-circle', function() {
	
		$(this).removeClass().addClass('fa fa-times-circle');

		$(this).closest('.progress-bar').children('h5').text('Public Access Allowed');

		//By removing actions class we hide the button
		$(this).closest('.progress-bar').removeClass().addClass('progress-bar pending');

		r.setPublic(true);
	});

	$('#upload-options').on('click', '.fa-times-circle', function() {
	
		$(this).removeClass().addClass('fa fa-check-circle');

		$(this).closest('.progress-bar').children('h5').text('Public Access Denied');

		//By removing actions class we hide the button
		$(this).closest('.progress-bar').removeClass().addClass('progress-bar failed');

		r.setPublic(false);
	});

	$('#upload-options .progress-bar').hover(function(e) {

		var text = $(this).children('h5').text();

		if(e.type == "mouseenter") {

			if(text == "Public Access Allowed") {

				$(this).removeClass().addClass('progress-bar actions failed');

			} else {

				$(this).removeClass().addClass('progress-bar actions pending');
			}
		
		} else {

			if(text == "Public Access Allowed") {

				$(this).removeClass().addClass('progress-bar actions pending');

			} else {

				$(this).removeClass().addClass('progress-bar actions failed');
			}
		}

	});


	function clearHistory() {

		var fileItem = $('#default-history-item').clone();
		
		$('#history').empty();
		$('#grid').append(fileItem);
	};

	function updateHistory(file, order, action) {

		var item = $('#history .history-item[data-id="' + file.key + '"]');

		if(item.length != 0 && action == 'remove') {
			$(item).remove();

			item = null;
		}

		if(item == null || item == undefined || item.length == 0) {

			item = $('#default-history-item').clone();

			$(item).removeAttr('id');				

			$(item).attr('data-id', file.key);

			if(order == "prepend") {

				$('#history').prepend(item);

			} else {

				$('#history').append(item);
			}
		}

		$(item).find('.message').find('h5').text(file.message);

		$(item).find('.message').find('.loading').width(0);

		var progressBar = $(item).find('.message').find('.progress-bar');

		$(progressBar).removeClass();

		$(progressBar).addClass('progress-bar');


		if(file.active == true) {
		
			$(item).find('a.filename').attr('href', "{{pages.returnFile.original}}" + file.key);
			$(item).find('a.filename').text(file.name);
	
			$(item).find('span.filename').css('display', 'none');
			$(item).find('a.filename').css('display', 'inline-block');

		} else {

			$(item).find('span.filename').css('display', 'inline-block');
			$(item).find('a.filename').css('display', 'none');

			$(item).find('span.filename').text(file.name);

			if(file.success == "Pending") {

				$(progressBar).addClass('pending');
				$(progressBar).addClass('actions');
	
			} else if(file.success == "Uploading") {

				$(item).find('.message').find('.loading').width(file.message);
				$(progressBar).addClass('uploading');
				$(progressBar).addClass('actions');

			} else if(file.success == "Failed") {

				$(progressBar).addClass('failed');
			}
		};
	}

	function getHistory() {

		$.post('{{pages.apiGetFiles.uri}}', {active: '', startId: '', limit: 25, order: 'desc'}, function(data) {
					
			if(data.success == true) {
				
				data.files.forEach(function(file) {
					
					updateHistory(file, 'append', 'remove');

					//If a file is Processing or is Uploading then lets listen for updates
					if(file.success == "Processing" || file.success == "Uploading" || file.success == "Pending") {
						addToProcessing(file);
					}
				});
			}
		});
	}

	$("#resumable-drop").on("dragenter", function(event) {

		event.preventDefault();

		$(this).addClass("resumable-dragover");
	});

	$("#resumable-drop").on("drop", function(event) {

		event.preventDefault(); 

		$(this).removeClass('resumable-dragover');	
	});

	$("#resumable-drop").on("dragend", function(event) {

		event.preventDefault(); 

		$(this).removeClass('resumable-dragover');
	});

	
	$('#grid').on('click', '.new-tag-text', function() {

		$(this).html("&nbsp;");
	});

	$('#grid').on('click', '.new-tag-button', function() {

		//Text will need to be validated here!!
		var tag = $(this).prev().text();

		var selected = this;

		$(selected).prev().html('Add new tag...');

		var key = $('.details').not('#default-details-item').attr('data-id');	

		var tagItem = $('#default-tag-item').clone();

		$(tagItem).removeAttr('id');

		$(tagItem).children('.tag-text').html(tag);

		$(selected).closest('ul').children('.new-tag').after(tagItem);

		updateTags();
	});

	$('#grid').on('click', '.remove-tag-button', function() {

		var selected = this;

		var key = $('.details').not('#default-details-item').attr('data-id');	

		var tag = $(selected).parent().children(':first').text();

		$(selected).parent().remove();

		updateTags();
	});

	$('#progress-pause-link').addClass('button-disabled');
	$('#progress-resume-link').addClass('button-disabled');
	$('#progress-cancel-link').addClass('button-disabled');


	//How frequently we should poll the server for file changes
	var timer = setInterval(checkHistory, 5000);

	r.assignDrop($('#resumable-drop')[0]);
	r.assignBrowse($('.resumable-browse')[0], $('#upload')[0]);

	//Lets get started!
	getHistory();
});

