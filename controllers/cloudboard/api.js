var $ = exports;

var fs = require('fs');
var common = require('../../cloudboard/common.js');
var resumable = require('../../cloudboard/resumable-node.js')();

$.apiGetFiles = function() {

	var self = this;

	if(self.post.active == null) {

		self.json({success: false, message: "Expecting active state boolean.", end: false, files: [] })

	} else if(self.post.startId == null) {

		self.json({success: false, message: "Expecting next start identification: _id.", end: false, files: [] })

	} else if(self.post.limit == null) {

		self.json({success: false, message: "Expecting limit integer.", end: false, files: [] })

	} else if(self.post.order == null) {

		self.json({success: false, message: "Expecting order integer.", end: false, files: [] })

	} else {

		common.EBGetFiles(self, function(result) {

			self.json(result);
		});
	}
};

$.apiGetFile = function() {

	var self = this;

	var key = self.post.id;

	common.EBGetFile(self, key, function(result) {

		self.json(result);
	});
};

//Need to do serious security checks here!
$.apiReturnFile = function(type, key) {

	var self = this;

	//Check user has that file in db and if they do return it with the mime type set...otherwise return 404
	common.EBGetFile(self, key, function(result) {

		if(result.success == false) {

			self.view404();

		} else {

			//Set the download name to the orignal filename rather then the file key
			var headers = [];
			headers['Content-Type'] = result.file.type;
			headers['Access-Control-Allow-Origin'] = '*';

			var filename = self.config['files-' + type + '-dir'] + result.file.key;

			var fullPath = F.path.root(filename);

			fs.exists(fullPath, function (exists) {
			
				if(exists == false) {

					self.file('/images/cloudboard/file-generic-icon-' + type + '.png');
			
				} else {

					self.file('~' + fullPath, result.file.name, headers);
				}
			});
		}
	});
};

$.apiBootstrapFile = function() {

	var self = this;

	common.EBStoreFile(self, function(file) {

		if(file == null) {

			self.json({success: false, message: 'An error occued during the upload.', file: null});

		} else {

			self.json({success: true, message: 'Found or Generated file.', file: file});
		}
	});
};

$.apiCheckFile = function() {

	var self = this;

	var key = self.post.resumableIdentifier;
	var chunkNumber = self.post.resumableChunkNumber;
	var totalChunks = self.post.resumableTotalChunks;

	//Returns: FOUND, NOT_FOUND
	resumable.get(self, function(status) {

		common.EBGetFile(self, key, function(result) {

			if(result == null || result.success == false) {

				self.json({success: false, message: 'An error occued during the upload.'});

			} else {

				var file = result.file; 
				file.success = 'Uploading';
				file.message = Math.round((chunkNumber / totalChunks) * 100) + '%';

				common.EBUpdateFile(file, function(newFile) {

					if(newFile == null) {

						self.json({success: false, message: 'Failed to update file.'});

					} else {
					
						if(status == 'found') {

							self.json({success: true, message: 'found'});

						} else {

							self.json({success: true, message: 'not_found'});
						}
					}
				});
			}
		});

	});
};

$.apiSaveFile = function() {

	var self = this;

	//Do not delete temporary files until the end of the request
	self.noClear(true);	

	var user = self.user.id;
	var key = self.post.resumableIdentifier;

	common.EBGetFile(self, key, function(result) {

		if(result == null || result.success == false) {

			self.json({success: false, message: 'An error occued during the upload.', file: null});

		} else {

			var file = result.file; 

			//Returns: DONE, PARTLY_DONE, FAILED
			resumable.post(self, function(status) {

				console.log("STATSS" + status);
				console.log(self.post.resumableChunkNumber);

				if(status == 'done') {

					file.success = 'Processing';
					file.message = 'Post Processing...';
					file.active = false;
					file.created = new Date();

					common.EBUpdateFile(file, function(finalFile) {

						if(finalFile == null) {

							self.json({success: false, message: 'Failed to complete file upload.'});

						} else {
						
							self.json({success: true, message: status});
						}	
					});

					//Move the chunks into a single file to be processed!
					resumable.completeFile(self, function(status) {

						//Now move the temp file to the file store and perform any manipulations to the file
						// The user does not need to wait for this due to it potentially being very slow process...especially large files
						// If the status is failed from completeFile then we will let EBCompleteFile handle it and update the status
						common.EBCompleteFile(file, function() {

							//Remove the temporary upload files
							resumable.clean(self, key);
						});
					});

				} else if(status == 'failed') {

					file.success = 'Failed';
					file.message = 'Failed to upload file.';

					//Remove the temporary upload files
					resumable.clean(self, key);

					common.EBUpdateFile(file, function(newFile) {

						if(newFile == null) {

							self.json({success: false, message: 'Failed to update file.'});

						} else {
						
							self.json({success: false, message: status});
						}
					});

				//partly_done
				} else {

					self.json({success: true, message: status});
				}
			});
		}
	});
};

$.apiRemoveFile = function() {

	var self = this;

	common.EBRemoveFile(self, function(result) {

		self.json(result);	
	});
};

$.apiSaveTag = function() {

	var self = this;

	common.EBSaveTag(self, function(result) {

		self.json(result);
	});
};

$.apiRemoveTag = function() {

	var self = this;

	common.EBRemoveTag(self, function(result) {

		self.json(result);
	});
};
