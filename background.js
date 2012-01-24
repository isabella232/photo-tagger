//
// The background process will store images tagged (through the injected script)
// and display the image in speed dial
//

// run the init script when page loads
window.onload = init; 

// global variables
var _storage; // localstorage
var _images; // array of images
var _debug_mode = true;
var _cache_images = false;

function debug(msg){
    if (_debug_mode) opera.postError(msg);
}

// this script is initialized when the page loads
function init(){
    // storage
    _storage = localStorage;
    
    // get all existing images
    _images = getImages();
    
    _cache_images = widget.preferences.getItem('cache');
    
    // display them
    display('init');
}

// storage handler for the options page
addEventListener( 'storage', _storageHandler, false );

// storage handler for the options page
function _storageHandler( e, forceUpdate )
{
    if( e===true || e.storageArea==widget.preferences)
    {
        _cache_images = widget.preferences.getItem('cache');
    }
}

// Listen for injected script messages (i.e. for image tags)
opera.extension.onmessage = function(event){
    switch(event.data.type){
        case 'save': // called from the user JS, works only for the index.html displayed in the SD
            var data = JSON.parse(event.data.data);
            // Post a sentence (which includes the message received) to the opera error console.
            debug("[MESSAGE FROM JS] This is what I got from the injected script: " + data.src);
            // add tag to library
            saveImage(data);
            // refresh gallery
            refreshTabsGalleries();
            display('save');
            break;
        case 'refresh':
            debug("{REFRESHING GALLERY TABS]");
            // SD forces to refresh all opened galleries tabs
            refreshTabsGalleries();
            init();
            break;
        case 'createTab':
            opera.extension.tabs.create({url:event.data.imgUrl, focused:true});
            break;
    }
}

function saveImage(data){
    debug("[SAVE IMG] Storing this url: " + data.src);
    
    // save it to local storage by adding to end of list
    if(!_storage.images) {
        _storage.images = JSON.stringify([data]);
    }
    else {
        var store = JSON.parse(_storage.images);
        store.push(data);
        _storage.images = JSON.stringify(store);
    }

    // Update the live images table
    var image = {
        src    : data.src,
        width  : data.width,
        height : data.height,
        base64 : null
    }
    
    _images.push(image);
    
    debug('[CACHE ENABLED] ' + _cache_images);
    if (_cache_images) getBase64Image(image, _images.length - 1);
}

function getBase64Image(imageData, imgInd) {
    var image = document.createElement('img');
    image.src = imageData.src;
    
    image.onload = function(){
        debug("[IMAGE LOADED]");
        // Create an empty canvas element
        var canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        
        // Copy the image contents to the canvas
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgb(255,255,255)";
        ctx.drawImage(this, 0, 0);
        var dataURL = canvas.toDataURL();
        
        _images[imgInd].base64 = dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
        
        updateStorage();
    }
}

function updateStorage(){
    var imgTag;
    var imgs = _images;
    var store = [];
    var org_storage = _storage.images;
    
    for (var i = 0, img; img = imgs[i]; i++){
        store.push(img);
    }

    try{
        _storage.images = JSON.stringify(store);
    }
    catch(e){
        opera.postError("Couldn't save to the storage - storage is full.");
        _storage.images = org_storage;
    }
}

// Get all tags as an array
function getImages(){
    if(!_storage.images) {
        return [];
    }
    
    return JSON.parse(_storage.images);
}

// display images
function display(evt){
    debug('[DISPLAY IMAGES BY] ' + evt);
    var gallery = document.getElementById('gallery');
    var images_count = _images.length;
    var image;
    var imgContainer;
    var close;
    var close_img;
    
    // clear gallery
    gallery.innerHTML = '';

    debug("[DISPLAY] images array: " + JSON.stringify(_images, null, '\t'));
    
    if (images_count == 0){ 
    	document.getElementById('info').style.display = 'block';
    	document.getElementById('header').style.display = 'none';
    }
    else{
    	document.getElementById('info').style.display = 'none';
    	document.getElementById('header').style.display = 'block';
    }
        
    // _images is a global variable and is filled with all images in _storage on init
    for(i = 0; i < images_count; i++){
        // for the grid layout
        
        var a = document.createElement('a');
        a.rel = 'gallery_img';
        a.setAttribute('imgId', i);
        a.href = (_images[i].base64 ? _images[i].base64 : _images[i]["src"]);
        
        image = document.createElement('div');
        image.className = 'image';
        _images[i]["width"] >= _images[i]["height"] ? image.className += ' landscape' : image.className += ' portrait'; //"100% auto" : "auto 100%";
        image.style.backgroundImage = "url(\"" + (_images[i].base64 ? "data:;base64," + _images[i].base64 : _images[i]["src"]) + "\")";
        image.title = _images[i]["src"];
        
        $(a).colorbox({
            transition:"fade", 
            current:"{current} / {total}", 
            maxWidth:"95%",
            maxHeight:"95%",
            scalePhotos:true
        });
        
        a.appendChild(image);
        
        imgContainer = document.createElement('div');
        imgContainer.setAttribute('class', 'imgContainer');
        //imgContainer.setAttribute('imgId', i);
        //imgContainer.style.backgroundImage = "url(" + _images[i]["src"] + ")";
        //_images[i]["width"] >= _images[i]["height"] ? imgContainer.className += ' landscape' : imgContainer.className += ' portrait'; //"100% auto" : "auto 100%";
        //imgContainer.title = _images[i]["src"];
        //imgContainer.setAttribute('href',imgContainer.title);
        
        imgContainer.addEventListener('mouseover', function(){
            this.className += ' active';
        }, false);
        imgContainer.addEventListener('mouseout', function(){
            this.className = this.className.replace(' active', '');
        }, false);
        //imgContainer.addEventListener('click', imgOnClick, false);
        
        // button to remove image from the gallery
        close = document.createElement('div');
        close.className = 'close';
        close.title = "Remove image from the gallery";
        close_img = document.createElement('img');
        close_img.src = 'images/close.png';
        close.appendChild(close_img);
        close.addEventListener('click', removeImage, false);
        
        imgContainer.appendChild(a);
        imgContainer.appendChild(close);
        
        gallery.appendChild(imgContainer);
        
        debug("[DISPLAY] --- " + i + " - Image source: " + _images[i]["src"]);
        debug('[DISPLAY] img width vs height: ' + _images[i]["width"] + '/' + _images[i]["height"]);
    }
}

/*function imgOnClick(){
    var imgUrl = _images[this.getAttribute('imgId')].src;
    opera.extension.postMessage({type: 'createTab', imgUrl:imgUrl});
}*/

function removeImage(){
    var imgIndex = parseInt(this.parentNode.firstChild.getAttribute('imgId'));

    var images = getImages();
    images.splice(imgIndex, 1);
    _storage.images = JSON.stringify(images);
    
    // this will refresh only SD
    opera.extension.postMessage({type:'refresh'});
}

function refreshTabsGalleries(){
    //check if background process
    if (opera.extension.broadcastMessage)
        opera.extension.broadcastMessage({type:'refresh'});
}
