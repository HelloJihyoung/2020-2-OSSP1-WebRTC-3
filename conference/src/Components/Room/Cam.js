import React, { Component } from 'react';
import io from 'socket.io-client'
import { Route } from 'react-router-dom';

import Video from './Video'
import Videos from './Videos'
import Chat from './Chat'
import { Container, TextField, Dialog, Button, Paper } from '@material-ui/core';
import { MdExitToApp, MdScreenShare } from "react-icons/md";
import Board from './Board';
import EventSeatIcon from '@material-ui/icons/EventSeat';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import BrushIcon from '@material-ui/icons/Brush';
import NewReleasesIcon from '@material-ui/icons/NewReleases';
import Alert from './Alert';

class Cam extends Component {
  constructor(props) {
    super(props)

    this.state = {
      nickName: sessionStorage.getItem("userid"),
      userstatus: sessionStorage.getItem("userstatus"),
      alertm: false,
      screenShare: false,
      emptySeat: false, //안눌렸을 경우 그대로 화면 송출 -> 기본 | 눌렸을 경우 자리비움 표시
      
      localStream: null,    // used to hold local stream object to avoid recreating the stream everytime a new offer comes
      remoteStream: null,    // used to hold remote stream object that is displayed in the main screen

      remoteStreams: [],    // holds all Video Streams (all remote streams)
      peerConnections: {},  // holds all Peer Connections
      selectedVideo: null,

      status: 'Please wait',

      pc_config: {
        "iceServers": [
          {
            urls: 'stun:stun.l.google.com:19302'
          },
          {
            urls: "turn:numb.viagenie.ca",
            credential: "muazkh",
            username: "webrtc@live.com"
          }
        ]
      },

      sdpConstraints: {
        'mandatory': {
          'OfferToReceiveAudio': true,
          'OfferToReceiveVideo': true
        }
      },

      messages: [],
      sendChannels: [],
      disconnected: false,
    }

    // DONT FORGET TO CHANGE TO YOUR URL
    this.serviceIP = 'https://3aad7c2f92f5.ngrok.io/webrtcPeer'

    // https://reactjs.org/docs/refs-and-the-dom.html
    // this.localVideoref = React.createRef()
    // this.remoteVideoref = React.createRef()

    this.socket = null
    // this.candidates = []
  }

  getEmptyPage = () =>{
    
  }

  getLocalStream = () => {
    // called when getUserMedia() successfully returns - see below
    // getUserMedia() returns a MediaStream object (https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
    const success = (stream) => {
      window.localStream = stream
      // this.localVideoref.current.srcObject = stream
      // this.pc.addStream(stream);
      this.setState({
        localStream: stream
      })

      this.whoisOnline()
    }

    // called when getUserMedia() fails - see below
    const failure = (e) => {
      console.log('getUserMedia Error: ', e)
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    // see the above link for more constraint options
    const constraints = {
      audio: true,
      video: true,
      // video: {
      //   width: 1280,
      //   height: 720
      // },
      // video: {
      //   width: { min: 1280 },
      // }
      options: {
        mirror: true,
      }
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

    //화면공유 조건!
    if (this.state.screenShare == false) {
      navigator.mediaDevices.getUserMedia(constraints)
        .then(success)
        .catch(failure)
    } else if(this.state.emptySeat == false){

    } else if(this.state.emptySeat == true){

    }
    else {
      navigator.mediaDevices.getDisplayMedia({
        video: true
      }).then(success).catch(failure)
    }
  }

  whoisOnline = () => {
    // let all peers know I am joining
    this.sendToPeer('onlinePeers', null, { local: this.socket.id })
  }

  sendToPeer = (messageType, payload, socketID) => {
    this.socket.emit(messageType, {
      socketID,
      payload
    })
  }

  createPeerConnection = (socketID, callback) => {

    try {
      let pc = new RTCPeerConnection(this.state.pc_config)

      // add pc to peerConnections object
      const peerConnections = { ...this.state.peerConnections, [socketID]: pc }
      this.setState({
        peerConnections
      })

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendToPeer('candidate', e.candidate, {
            local: this.socket.id,
            remote: socketID
          })
        }
      }

      pc.oniceconnectionstatechange = (e) => {
        // if (pc.iceConnectionState === 'disconnected') {
        //   const remoteStreams = this.state.remoteStreams.filter(stream => stream.id !== socketID)

        //   this.setState({
        //     remoteStream: remoteStreams.length > 0 && remoteStreams[0].stream || null,
        //   })
        // }

      }

      pc.ontrack = (e) => {

        let _remoteStream = null
        let remoteStreams = this.state.remoteStreams
        let remoteVideo = {}

        // 1. check if stream already exists in remoteStreams
        const rVideos = this.state.remoteStreams.filter(stream => stream.id === socketID)

        // 2. if it does exist then add track
        if (rVideos.length) {
          _remoteStream = rVideos[0].stream
          _remoteStream.addTrack(e.track, _remoteStream)

          //???
          remoteVideo = { // let delete
            ...rVideos[0],
            stream: _remoteStream,
          }
          remoteStreams = this.state.remoteStreams.map(_remoteVideo => {
            return _remoteVideo.id === remoteVideo.id && remoteVideo || _remoteVideo
          })
        } else {
          // 3. if not, then create new stream and add track
          _remoteStream = new MediaStream()
          _remoteStream.addTrack(e.track, _remoteStream)

          remoteVideo = {
            id: socketID,
            name: socketID,
            stream: _remoteStream,
          }
          remoteStreams = [...this.state.remoteStreams, remoteVideo]
        }

        this.setState(prevState => {

          // If we already have a stream in display let it stay the same, otherwise use the latest stream
          // const remoteStream = prevState.remoteStreams.length > 0 ? {} : { remoteStream: e.streams[0] }
          const remoteStream = prevState.remoteStreams.length > 0 ? {} : { remoteStream: _remoteStream }

          // get currently selected video
          let selectedVideo = prevState.remoteStreams.filter(stream => stream.id === prevState.selectedVideo.id)
          // if the video is still in the list, then do nothing, otherwise set to new video stream
          selectedVideo = selectedVideo.length ? {} : { selectedVideo: remoteVideo }

          return {
            // selectedVideo: remoteVideo,
            ...selectedVideo,
            // remoteStream: e.streams[0],
            ...remoteStream,
            remoteStreams, //: [...prevState.remoteStreams, remoteVideo]
          }
        })
      }

      pc.close = () => {
        // alert('GONE')
        console.log("pc closed");
      }

      if (this.state.localStream)
        //pc.addStream(this.state.localStream)

        this.state.localStream.getTracks().forEach(track => {
          pc.addTrack(track, this.state.localStream)
        })

      // return pc
      callback(pc)

    } catch (e) {
      console.log('Something went wrong! pc not created!!', e)
      // return;
      callback(null)
    }
  }

  componentDidMount = () => {

    this.socket = io.connect(
      this.serviceIP,
      {
        path: '/io/webrtc',
        query: {
          room: window.location.pathname,
        }
      }
    )

    this.socket.on('connection-success', data => {

      this.getLocalStream()

      //console.log(data.success)
      const status = data.peerCount > 1 ? `Total Connected Peers to room ${window.location.pathname}: ${data.peerCount}` : 'Waiting for other peers to connect'

      this.setState({
        status: status,
        messages: data.messages
      })
    })
    //업데이트 연결된 peer 개수
    this.socket.on('joined-peers', data => {

      this.setState({
        status: data.peerCount > 1 ? `Total Connected Peers to room ${window.location.pathname}: ${data.peerCount}` : 'Waiting for other peers to connect'
      })
    })

    // ************************************* //
    // ************************************* //
    this.socket.on('peer-disconnected', data => {

      // close peer-connection with this peer
      this.state.peerConnections[data.socketID].close()

      //console.log('peer-disconnected', data)

      // get and stop remote audio and video tracks of the disconnected peer
      const rVideo = this.state.remoteStreams.filter(stream => stream.id === data.socketID)
      rVideo && this.stopTracks(rVideo[0].stream)

      // filter out the disconnected peer stream
      const remoteStreams = this.state.remoteStreams.filter(stream => stream.id !== data.socketID)

      this.setState(prevState => {
        // check if disconnected peer is the selected video and if there still connected peers, then select the first
        const selectedVideo = prevState.selectedVideo.id === data.socketID && remoteStreams.length ? { selectedVideo: remoteStreams[0] } : null

        return {
          // remoteStream: remoteStreams.length > 0 && remoteStreams[0].stream || null,
          remoteStreams,
          ...selectedVideo,
          status: data.peerCount > 1 ? `Total Connected Peers to room ${window.location.pathname}: ${data.peerCount}` : 'Waiting for other peers to connect'
        }
      }
      )
    })


    this.socket.on('online-peer', socketID => {
      console.log('connected peers ...', socketID)

      // create and send offer to the peer (data.socketID)
      // 1. Create new pc
      this.createPeerConnection(socketID, pc => {
        // 2. Create Offer
        if (pc) {
          // Send Channel
          const handleSendChannelStatusChange = (event) => {
            console.log('send channel status: ' + this.state.sendChannels[0].readyState)
          }

          const sendChannel = pc.createDataChannel('sendChannel')
          sendChannel.onopen = handleSendChannelStatusChange
          sendChannel.onclose = handleSendChannelStatusChange

          this.setState(prevState => {
            return {
              sendChannels: [...prevState.sendChannels, sendChannel]
            }
          })

          // Receive Channels
          const handleReceiveMessage = (event) => {
            const message = JSON.parse(event.data)
            // console.log(message)
            this.setState(prevState => {
              return {
                messages: [...prevState.messages, message]
              }
            })
          }

          const handleReceiveChannelStatusChange = (event) => {
            if (this.receiveChannel) {
              console.log("receive channel's status has changed to " + this.receiveChannel.readyState);
            }
          }

          const receiveChannelCallback = (event) => {
            const receiveChannel = event.channel
            receiveChannel.onmessage = handleReceiveMessage
            receiveChannel.onopen = handleReceiveChannelStatusChange
            receiveChannel.onclose = handleReceiveChannelStatusChange
          }

          pc.ondatachannel = receiveChannelCallback

          pc.createOffer(this.state.sdpConstraints)
            .then(sdp => {
              pc.setLocalDescription(sdp)

              this.sendToPeer('offer', sdp, {
                local: this.socket.id,
                remote: socketID
              })
            })
        }
      })
    })

    this.socket.on('offer', data => {
      this.createPeerConnection(data.socketID, pc => {
        pc.addStream(this.state.localStream)

        // Send Channel
        const handleSendChannelStatusChange = (event) => {
          console.log('send channel status: ' + this.state.sendChannels[0].readyState)
        }

        const sendChannel = pc.createDataChannel('sendChannel')
        sendChannel.onopen = handleSendChannelStatusChange
        sendChannel.onclose = handleSendChannelStatusChange

        this.setState(prevState => {
          return {
            sendChannels: [...prevState.sendChannels, sendChannel]
          }
        })

        // Receive Channels
        const handleReceiveMessage = (event) => {
          const message = JSON.parse(event.data)
          // console.log(message)
          this.setState(prevState => {
            return {
              messages: [...prevState.messages, message]
            }
          })
        }

        const handleReceiveChannelStatusChange = (event) => {
          if (this.receiveChannel) {
            console.log("receive channel's status has changed to " + this.receiveChannel.readyState);
          }
        }

        const receiveChannelCallback = (event) => {
          const receiveChannel = event.channel
          receiveChannel.onmessage = handleReceiveMessage
          receiveChannel.onopen = handleReceiveChannelStatusChange
          receiveChannel.onclose = handleReceiveChannelStatusChange
        }

        pc.ondatachannel = receiveChannelCallback

        pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
          // 2. Create Answer
          pc.createAnswer(this.state.sdpConstraints)
            .then(sdp => {
              pc.setLocalDescription(sdp)

              this.sendToPeer('answer', sdp, {
                local: this.socket.id,
                remote: data.socketID
              })
            })
        })
      })
    })

    this.socket.on('answer', data => {
      // get remote's peerConnection
      const pc = this.state.peerConnections[data.socketID]
      console.log(data.sdp)
      pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => { })
    })

    this.socket.on('candidate', (data) => {
      // get remote's peerConnection
      const pc = this.state.peerConnections[data.socketID]

      if (pc)
        pc.addIceCandidate(new RTCIceCandidate(data.candidate))
    })

  }

  // ************************************* //
  // NOT REQUIRED
  // ************************************* //
  disconnectSocket = (socketToDisconnect) => {
    this.sendToPeer('socket-to-disconnect', null, {
      local: this.socket.id,
      remote: socketToDisconnect
    })
  }

  switchVideo = (_video) => {
    console.log(_video)
    this.setState({
      selectedVideo: _video
    })
  }

  // ************************************* //
  // ************************************* //
  stopTracks = (stream) => {
    stream.getTracks().forEach(track => track.stop())
  }
  //닉네임
  writeNickname = (event) => {
    this.setState({ nickName: event.target.value });
  }
  //닉네임쓰고 입장
  entryRoom = () => {
    if (this.state.nickName != "") {
      this.setState({ isNickname: true });
    } else {
      alert("닉네임을 정확히 입력해주세요.");
    }
  }
  //화면공유
  shareScreen = () => {
    this.setState({ screenShare: !this.state.screenShare });
    this.getLocalStream();
  }
  emptySeat = () =>{
    this.setState({ emptySeat: !this.state.emptySeat });
    this.getLocalStream();
  }
  //화이트보드
  drawWhiteboard = () => {
    <Route exact path="/board" component={Board} />
    window.open("/board");
  }
  
  alertMessage = () => {
    this.setState({alertm: !this.state.alertm});
  }

  render() {
    console.log(this.state);
    const {
      status,
      messages,
      disconnected,
      localStream,
      peerConnections,
      remoteStreams,
    } = this.state

    //연결 끊기
    if (disconnected) {
      // disconnect socket
      alert("미팅룸을 나갑니다");
      this.socket.close()
      // stop local audio & video tracks
      this.stopTracks(localStream)

      // stop all remote audio & video tracks
      remoteStreams.forEach(rVideo => this.stopTracks(rVideo.stream))

      // stop all remote peerconnections
      peerConnections && Object.values(peerConnections).forEach(pc => pc.close())

      return window.close();
    }

    //console.log(this.state.localStream)

    const statusText = <div style={{ color: 'yellow', padding: 5 }}>{status}</div>
    return (
      <div style={{ padding: "5vh" }}>
        <Paper variant="outlined" style={{width: "100%", height: "5vh", marginBottom: "2vh"}}>

        </Paper>

        <Paper variant="outlined" style={{
          display: "grid", padding: "1vh", gridTemplateRows: "1fr 1fr", gridTemplateColumns: "1fr 1fr"
          , width: "100%", height: "100%"
        }}>

          {/*<Draggable style={{
        zIndex: 101,
        //position: 'absolute',
        bottom: 0,
        cursor: 'move'
      }}>
        
    </Draggable>*/}



          {/* 내얼굴 */}
          <Paper variant="outlined" style={{ padding: '2vh' }}>
            <Video
              videoType='localVideo'
              videoStyles={{
                // zIndex:2,
                //position: 'absolute',
                right: 0,
                width: "100%",
                // height: 200,
                // margin: 5,
                // backgroundColor: 'black'
              }}
              frameStyle={{
                width: "100%",
                margin: 5,
                borderRadius: 5,
                backgroundColor: 'black',
              }}
              showMuteControls={true}
              // ref={this.localVideoref}
              videoStream={localStream}
              autoPlay muted>
            </Video>

            <Container style={{ display: "flex", justifyContent: "center" }}>
              <Button variant="contained" color="primary" startIcon={<ScreenShareIcon />} onClick={this.shareScreen} style={{justifyContent: "center" }}
              >        화면 공유
      </Button>
              <Button variant="contained" color="primary" startIcon={<BrushIcon />} onClick={this.drawWhiteboard} style={{marginLeft: "1vh" }}
              >        화이트 보드
      </Button>
              {this.state.userstatus === "0" ? 
              <Button variant="contained" color="default" startIcon={<EventSeatIcon />} style={{marginLeft: "1vh" }}
              disabled //교수의 경우 이 기능이 필요가 없다!
              >        자리비움 요청
      </Button> : <Button variant="contained" color="primary" startIcon={<EventSeatIcon />} style={{marginLeft: "1vh" }} //교수의 경우 이 기능이 필요가 없다!
              >        자리비움 요청
      </Button> }
              <Button variant="contained" color="primary" startIcon={<NewReleasesIcon />} onClick={this.alertMessage} style={{marginLeft: "1vh" }}
              >        알림 메시지
      </Button>
              {this.state.alertm && <Dialog open={this.state.alertm} onClose={this.alertMessage}>
                <Alert></Alert>
                </Dialog>}
              
            </Container>

          </Paper>


          <div style={{
            zIndex: 5,
            position: 'absolute',
            // margin: 10,
            // backgroundColor: '#cdc4ff4f',
            // padding: 10,
            // borderRadius: 5,
          }}>
                      <Button variant="contained" color="default" startIcon={<MdExitToApp />} onClick={(e) => { this.setState({ disconnected: true }) }} style={{ display: "flex", justifyContent: "center"}}
            >      나가기
      </Button>
            {/* <MdExitToApp size={25}
              onClick={() => { alert('미팅룸을 나갑니다') }}
            ></MdExitToApp> */}
            <div style={{ //please wait 사람수 check
              margin: 10,
              backgroundColor: '#cdc4ff4f',
              padding: 10,
              borderRadius: 5,
            }}>{statusText}</div>
          </div>



          <Paper style={{ gridRow: '1 / 3', gridColumn: '1 / 2' }}>
            <Videos
              switchVideo={this.switchVideo}
              remoteStreams={remoteStreams}
            // videoStream={this.state.selectedVideo && this.state.selectedVideo.stream}
            />
          </Paper>

          <Paper variant='outlined' style={{ padding: '2vh', backgroundColor: "#EAF1F6" }}>
            <Chat
              style={{ gridRow: "1 / 2", gridColumn: "2 / 3", backgroundColor: "#EAF1F6" }}
              user={{
                uid: this.socket && this.socket.id || '',
                unickname: this.state.nickName// 닉네임 던지기
              }}
              //변경사항 확인
              messages={messages}
              sendMessage={(message) => {
                this.setState(prevState => {
                  return { messages: [...prevState.messages, message] }
                })
                //채널이 오픈되어있을때만
                this.state.sendChannels.map(sendChannel => {
                  sendChannel.readyState === 'open' && sendChannel.send(JSON.stringify(message))
                })
                this.sendToPeer('new-message', JSON.stringify(message), { local: this.socket.id })
              }}
            />
          </Paper>
          {/* <div style={{zIndex: 1, position: 'fixed'}} >
          <button onClick={this.createOffer}>Offer</button>
          <button onClick={this.createAnswer}>Answer</button>
          <br />
          <textarea style={{ width: 450, height:40 }} ref={ref => { this.textref = ref }} />
        </div> */}
          {/* <br />
        <button onClick={this.setRemoteDescription}>Set Remote Desc</button>
        <button onClick={this.addCandidate}>Add Candidate</button> */}
        </Paper>
      </div>
    )
  }
}

export default Cam;
