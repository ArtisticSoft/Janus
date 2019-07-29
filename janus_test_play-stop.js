//=============================================================================
//UI related

var PlayStopButton;
var NoVideoBanner;

function myLog(msg) {
    console.log(msg);
}

function myAlert(msg) {
    //bootbox.alert(msg);
    window.alert(msg);
}

//myLog('--- init...');

//myAlert('--- init...');

//-----------------------------------------------------------------------------
//Janus server URL 
/*
Janus Server: camproxy.ru (должны работать http/https/ws/wss протоколы)
тестовый rtsp: rtsp://camproxy.ru:8554/bars

demo page:
https://rsatom.github.io/janus-gstreamer-plugin/
*/

var UseWebSockets = false;

var serverHost = 'camproxy.ru';

//assumed the demo page reside on the same server where Janus server installed
//serverHost = window.location.hostname;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var ProtocolMap = {
  //UseWebSockets = false
  false: {
    'http:':  {scheme: 'http', port: '8088', path: '/janus'},
    'https:': {scheme: 'https', port: '8089', path: '/janus'}
  },
  
  //UseWebSockets = true
  true: {
    'http:':  {scheme: 'ws', port: '8189', path: ''},
    'https:': {scheme: 'wss', port: '8989', path: ''}
  }
};

var server;

//real-life
//var p = ProtocolMap[UseWebSockets][window.location.protocol];

//---debug
var UseWebSockets = true;
var p = ProtocolMap[UseWebSockets]['https:'];
//var p = ProtocolMap[UseWebSockets]['http:'];
//Works
//var UseWebSockets = false;
//var p = ProtocolMap[UseWebSockets]['https:'];//Works
//var p = ProtocolMap[UseWebSockets]['http:'];//Works

if (p) {
  server = p.scheme + '://' + serverHost + ':' + p.port + p.path;
}

//override - for very basic testing only
//server = 'https://janus.conf.meetecho.com/janus';

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//debug

//myLog('UseWebSockets = ['+UseWebSockets +'] serverHost = ['+serverHost +']');
//myLog('window.location.protocol= ['+window.location.protocol+']');

myLog('server= ['+server+']');

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//global vars 

var janus;
var streaming;
var opaqueId = 'streamingtest-'+Janus.randomString(12);

//-----------------------------------------------------------------------------

window.addEventListener('load', (event) => {
//$(document).ready(function() {

    //return;//debug!
    
    if (!server) {
      myAlert("can't determine Janus server URL");
      return;
    }
    
    //PlayStop button
    PlayStopButton = document.getElementById('play-stop-button');
    PlayStopButton.addEventListener('click', clickPlayStopButton, false);
    PlayStopButton.disabled = true;
    PlayStopButton.StreamState = '';//forge a property
    
    NoVideoBanner = document.getElementById('novideo');
    
    // Initialize the library (all console debuggers enabled)
    Janus.init({debug: 'all', callback: function() {
    
    // Make sure the browser supports WebRTC
    if(!Janus.isWebrtcSupported()) {
        myAlert('No WebRTC support... ');
        return;
    }
    // Create session
    janus = new Janus(
        {
            server: server,
            success: function() {
                // Attach to streaming plugin
                janus.attach(
                    {
                        //not works on the native demo server
                        plugin: 'janus.plugin.gstreamer',

                        //Works on the native demo server
                        //plugin: 'janus.plugin.streaming',
                        
                        opaqueId: opaqueId,
                        success: function(pluginHandle) {
                            streaming = pluginHandle;
                            Janus.log('Plugin attached! (' + streaming.getPlugin() + ', id=' + streaming.getId() + ')');
							
                            //[UI] interaction
                            StreamStateChangeHandler('attached');
                        },
                        error: function(error) {
                            Janus.error('  -- Error attaching plugin... ', error);
                            myAlert('Error attaching plugin... ' + error);
                        },
                        onmessage: function(msg, jsep) {
                            Janus.debug(' ::: Got a message :::');
                            Janus.debug(msg);
                            var result = msg['result'];
                            if(result !== null && result !== undefined) {
                                if(result['status'] !== undefined && result['status'] !== null) {
                                    var status = result['status'];
                                    if(status === 'stopped')
                                        stopStream();
                                }
                            } else if(msg['error'] !== undefined && msg['error'] !== null) {
                                myAlert(msg['error']);
                                stopStream();
                                return;
                            }
                            if(jsep !== undefined && jsep !== null) {
                                Janus.debug('Handling SDP as well...');
                                Janus.debug(jsep);
                                // Offer from the plugin, let's answer
                                streaming.createAnswer(
                                    {
                                        jsep: jsep,
                                        media: { audioSend: false, videoSend: false },    // We want recvonly audio/video

                                        success: function(jsep) {
                                            Janus.debug('Got SDP!');
                                            Janus.debug(jsep);
                                            var body = { 'request': 'start' };
                                            streaming.send({'message': body, 'jsep': jsep});
											
                                            //[UI] interaction
                                            StreamStateChangeHandler('streaming');
                                        },
                                        error: function(error) {
                                            Janus.error('WebRTC error:', error);
                                            myAlert('WebRTC error... ' + JSON.stringify(error));
                                        }
                                    });
                            }
                        },
                        onremotestream: function(stream) {
                            Janus.debug(' ::: Got a remote stream :::');
                            Janus.debug(stream);
                            //[UI] interaction
                            Janus.attachMediaStream(document.getElementById('remotevideo'), stream);
                        },
                        oncleanup: function() {
                            Janus.log(' ::: Got a cleanup notification :::');
                        }
                    });
            },
            error: function(error) {
                Janus.error(error);
                myAlert(error);
            },
            destroyed: function() {
                window.location.reload();
            }
        });
    }});
});

//-----------------------------------------------------------------------------

function StreamStateChangeHandler(state) {
  PlayStopButton.StreamState = state;
  switch (state) {
    case 'attached':
      PlayStopButton.disabled = false;
      PlayStopButton.innerHTML = 'Play';
      break;

    case 'streaming':
      PlayStopButton.disabled = false;
      PlayStopButton.innerHTML = 'Stop';
      break;
  }
}


function clickPlayStopButton(e) {
  //myAlert('e.target.id =['+e.target.id +']');
  //myAlert('e.target.StreamState =['+e.target.StreamState +']');
  
  var body;
  
  switch (e.target.StreamState) {
    case 'attached':
      var mrl = document.getElementById('source-edit').value;
      if(mrl && mrl.length) {
          //myAlert('MRL=['+mrl+']');
          
          //begin Play video. button will be enabled on the actual play begin message
          e.target.disabled = true;
          body = { 'request': 'watch', mrl: mrl };
          streaming.send({'message': body});
          NoVideoBanner.style.display = 'none';
      } else {
          myAlert('Enter source MRL');
      }
      break;

    case 'streaming':
      e.target.disabled = true;
      body = { 'request': 'stop' };
      streaming.send({'message': body});
      streaming.hangup();
      StreamStateChangeHandler('attached');
      NoVideoBanner.style.display = 'block';
      break;
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//=============================================================================
