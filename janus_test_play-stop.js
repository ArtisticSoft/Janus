//=============================================================================

var PlayStopButton;

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
//Janus server URL autodetect
//assumed the demo page reside on the same server where Janus server installed

var serverHost = window.location.hostname;

var server;
if(window.location.protocol === 'http:')
    server = 'http://' + serverHost + ':8088/janus';
else
    server = 'https://' + serverHost + ':8089/janus';

//debug!

//can't connect
//server = 'ws://janus.conf.meetecho.com:8188';

server = 'https://janus.conf.meetecho.com/janus';

//-----------------------------------------------------------------------------
var janus;
var streaming;
var opaqueId = 'streamingtest-'+Janus.randomString(12);

//-----------------------------------------------------------------------------

const ProtocolToPortNum = {
  'http:': '8088',
  'https:': '8089'
};

let p = window.location.protocol;
var my_server = p + '//' + serverHost + ':' + ProtocolToPortNum[p] + '/janus';

//myLog('window.location.protocol= ['+window.location.protocol+']');
myLog('server= ['+server+'] my_server = ['+my_server+']');

//-----------------------------------------------------------------------------

window.addEventListener('load', (event) => {
//$(document).ready(function() {

    // Use a button to start the demo
    PlayStopButton = document.getElementById('PlayStopButton');
    PlayStopButton.addEventListener('click', clickPlayStopButton, false);
	PlayStopButton.disabled = true;
    
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
						//Works on the native demo server
                        plugin: 'janus.plugin.streaming',

						//not works on the native demo server
      //                  plugin: 'janus.plugin.gstreamer',

                        opaqueId: opaqueId,
                        success: function(pluginHandle) {
                            streaming = pluginHandle;
                            Janus.log('Plugin attached! (' + streaming.getPlugin() + ', id=' + streaming.getId() + ')');
							
							//[UI] interaction
							WebRTCState = 'attached';
                            PlayStopButton.disabled = false;
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
											//PlayStopButton.innerHTML = 'Stop';
											WebRTCState = 'streaming';
											PlayStopButton.disabled = false;
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
/*
function startStream() {
    var mrl = $('#source-edit').val();
    if(mrl === undefined || mrl === null || !mrl) {
        myAlert('Enter source MRL');
        return;
    }
    $('#watch').attr('disabled', true).unbind('click');
    var body = { 'request': 'watch', mrl: mrl };
    streaming.send({'message': body});
}

function stopStream() {
    $('#watch').attr('disabled', true).unbind('click');
    var body = { 'request': 'stop' };
    streaming.send({'message': body});
    streaming.hangup();
    $('#watch').html('Watch').removeAttr('disabled').click(startStream);
}
*/
//-----------------------------------------------------------------------------

function clickPlayStopButton() {
    var mrl = document.getElementById('source-edit').value;
    if(mrl && mrl.length) {
        myAlert('MRL=['+mrl+']');
        var body = { 'request': 'watch', mrl: mrl };
        //streaming.send({'message': body});
    } else {
        myAlert('Enter source MRL');
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//=============================================================================
