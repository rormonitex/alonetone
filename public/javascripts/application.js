// for debug purposes
$.fn.log = function() {
  if (this.size()==0) return "<em>wrapped set is empty</em>"
  var text = '';
  this.each(function(){
    text += this.tagName;
    if (this.id) text += '#' + this.id;
  });
  console.log(text);
}

// hack up a periodical executor
jQuery.timer = function (interval, callback)
 {
	var interval = interval || 100;

	if (!callback)
		return false;
	
	_timer = function (interval, callback) {
		this.stop = function () {
			clearInterval(self.id);
		};
		
		this.internalCallback = function () {
			callback(self);
		};
		
		this.reset = function (val) {
			if (self.id)
				clearInterval(self.id);
			
			var val = val || 100;
			this.id = setInterval(this.internalCallback, val);
		};
		
		this.interval = interval;
		this.id = setInterval(this.internalCallback, this.interval);
		
		var self = this;
	};
	
	return new _timer(interval, callback);
};

jQuery.easing.def = "jswing"

// png fix if ie
$(function(){$(document).pngFix();});


// front page carousel
$(function() {
    $(".playlists_carousel").jCarouselLite({
        btnNext: ".next",
        btnPrev: ".prev",
        visible: 4,
        scroll: 4,
        circular: false
    });
});




// TRACKS

/* Most of the code here is taking advantage of 2 main concepts by dan webb.

Event Delegation, which exponentially reduces the amount of event listeners by relying on bubbling
http://www.danwebb.net/2008/2/8/event-delegation-made-easy-in-jquery

Inheritable Behaviours, which allows one to build componentized behaviours that are inheritable

Both are baked into lowpro

DateSelector = $.klass({
  onclick: $.delegate({
    '.close': function() { this.close() },
   '.day': function(e) { this.selectDate(e) }
  }),
  selectDate: function(dayElement) {
    // code ...
  },
  close: function() {
    // code ...
  }
});

*/


// abstracts ui.tabs a bit further   
Tabbies = $.klass({
  initialize : function(desiredTab){
    this.defaultTab = 0;
    this.element.tabs({ fx: [null,{ height: 'toggle',duration: 300,easing:'easeOut'}, ], selected: (desiredTab || this.defaultTab) });
    this.currentTab = 0;
  },
  openTab : function(desiredTab){
    desiredTab = desiredTab || this.defaultTab;
    this.element.tabs('select', desiredTab);
    this.currentTab = desiredTab;
  }
});


Track = $.klass({  
  initialize: function() {
    this.playButton = $(".play-button",this.element);
    this.trackLink = $("a.track_link",this.element);
    this.time = $('span.time',this.element);
    this.deleteButton = $(".delete-button",this.element);
    this.trackURL = this.trackLink.attr('href');
    this.soundID = "play-"+this.trackLink.id; 
    this.more = this.element.next();
    this.tabbies = false; // wait on initializing those tabs
  },
  
  
  // Lets Delegate!
  // we want the track to do lots of things onclick, but not add 100s of event handlers
  // so test the origin element of the click using selectors
  onclick: $.delegate({
    '.play_link' : function(e){ return this.togglePlay()},      // open comments
    '.track_link': function(e){ return this.toggleDetails(1)}, // open info
    '.download_link':function(e){ return this.toggleDetails(2)}, // open sharing
    '.title':function(e){ return this.toggleDetails(1)} // open 
  }),
  
  onmouseenter: $.delegate({
    '.asset' : function(e){  this.element.addClass('hover');}
  }),
  
  onmouseleave: $.delegate({
    '.asset' : function(e){  this.element.removeClass('hover');}
  }),
  
  toggleDetails: function(desiredTab){
    if(this.more.is(':hidden')) this.openDetails(desiredTab);
    else if (this.isPlaying()) this.openDetails(desiredTab); // never close the tabs when playing
    else this.closeDetails();
    return false;
  },
  
  openDetails: function(desiredTab){
    // set up the tabs if this track hasn't been opened yet
    if(!this.tabbies) this.createTabbies();
    
    // change the tab if the desired is not currently open
    if(this.tabbies.currentTab != desiredTab) this.tabbies.openTab(desiredTab);
    
    // open the pane if it is not already open
    if(this.isOpen != false) this.more.slideDown({duration:300,queue:false});
    
    // close all other detail panes except currently playing
    $.each(Track.instances, function(n, track){
        if(!track.isPlaying() && this.element.id != track.element.id) track.closeDetails();
    });
    
    this.element.addClass('open');
  },
  
  closeDetails:function(){
    this.more.slideUp({duration:300});
    this.element.removeClass('open');
  },
  
  isOpen:function(){
    this.more.is(':visible');
  },
  
  togglePlay: function(target){  
    if(this.isPlaying()) 
      this.pause();
    else
      this.playOrResume();
    // don't follow the link
    return false;
  },
  
  playOrResume : function(){
    this.killOtherTracks();
    this.element.addClass('playing');
    this.openDetails(0);
    this.startTimer();
    // if the track has already been played
    if (this.isPlaying()){
      this.resume();
    }else{
      this.play();
    }
  },
  
  play: function(){
    soundManager.play(this.soundID,{url:this.trackUrl,onfinish:this.startNextTrack().bind(this)});
  }, 
  
  isPlaying: function(){
    return this.element.hasClass('playing');
  },
  
  pause: function(){
    soundManager.pause(this.soundID);
    this.element.removeClass('playing');
    this.closeDetails();
  },
  
  isPaused: function(){
    return soundManager.soundIDs.include(this.soundID);
  },
  
  resume: function(){
    soundManager.resume(this.soundID);
  },
  
  startNextTrack: function(){
    this.pause();
    Track.instances[this.nextTrackIndex()].playOrResume();
  },
  
  nextTrackIndex : function(){
    // index of next Track in Track.instances
    var next = Track.instances.indexOf(this) + 1;
    // loop back to the first track
    if(Track.instances[next] == undefined) next = 0;
    return next;
  },
  
  killOtherTracks : function(){
    $.each(Track.instances, function(n,track){ 
      if(this.element.id != track.element.id) track.pause();
    });    
  },
  
  createTabbies : function(){
    this.tabbies = $('ul',this.more).attachAndReturn(Tabbies)[0];
  },
  startTimer : function(){
    $.timer(1000,this.updateTime());
  },
  updateTime : function(){
    this.sound = soundManager.getSoundById(this.soundID);
    if(this.sound != undefined && this.time != undefined && this.timer != false){
      this.elapsed_time = (this.sound.position / 1000).round();
      this.time((this.elapsed_time/60).floor() + ':' + (this.elapsed_time % 60));
    }
  },
});

jQuery(function($) {
  $('.asset, .track').attach(Track);
});

