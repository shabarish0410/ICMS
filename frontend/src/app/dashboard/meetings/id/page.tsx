'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { meetingsAPI } from '@/services/api';
import { 
  Video, Mic, MicOff, VideoOff, ScreenShare, PhoneOff, Send, 
  MessageSquare, Users, Loader2, ArrowLeft, ShieldCheck 
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Participant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioMuted: boolean;
  videoMuted: boolean;
}

interface ChatMessage {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const meetingId = parseInt(params.id as string);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  const [showChat, setShowChat] = useState(true);
  const [showRoster, setShowRoster] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<BroadcastChannel | null>(null);
  const localPeerIdRef = useRef<string>('');

  // Fetch meeting details
  const { data: meetingData, isLoading } = useQuery({
    queryKey: ['meeting', meetingId],
    queryFn: () => meetingsAPI.get(meetingId),
    enabled: !!meetingId,
  });

  // Generate random peer ID for the session
  useEffect(() => {
    localPeerIdRef.current = `peer_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Initialize local media
  useEffect(() => {
    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 480, height: 360 }
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Initialize BroadcastChannel Signaling
        initSignaling(stream);
      } catch (err) {
        console.error('Failed to get media devices:', err);
        toast.error('Failed to access microphone or camera. Joining audio-only/preview mode.');
        
        // Still init signaling with no local tracks
        initSignaling(null);
      }
    }
    
    if (localPeerIdRef.current) {
      initMedia();
    }

    return () => {
      // Clean up stream & connections on leave
      stopLocalStream();
      closeAllConnections();
    };
  }, [localPeerIdRef.current]);

  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
  };

  const closeAllConnections = () => {
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    if (channelRef.current) {
      channelRef.current.close();
    }
  };

  // WebRTC Signaling & Peer Connection Management
  const initSignaling = (stream: MediaStream | null) => {
    const channelName = `meeting-room-${meetingId}`;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    // Send Join Message
    channel.postMessage({
      type: 'join',
      senderId: localPeerIdRef.current,
      senderName: user?.full_name || 'Guest Participant'
    });

    channel.onmessage = async (event) => {
      const msg = event.data;
      if (msg.senderId === localPeerIdRef.current) return; // Ignore own messages

      switch (msg.type) {
        case 'join':
          // A new peer joined. Create connection and send Offer.
          toast.success(`${msg.senderName} joined the meeting`);
          await createPeerConnection(msg.senderId, msg.senderName, stream, true);
          break;

        case 'offer':
          // Received Offer from a peer. Create connection and send Answer.
          if (msg.targetId === localPeerIdRef.current) {
            await createPeerConnection(msg.senderId, msg.senderName, stream, false);
            const pc = peerConnectionsRef.current[msg.senderId];
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              channel.postMessage({
                type: 'answer',
                senderId: localPeerIdRef.current,
                targetId: msg.senderId,
                sdp: answer
              });
            }
          }
          break;

        case 'answer':
          // Received Answer from target peer. Set Remote Description.
          if (msg.targetId === localPeerIdRef.current) {
            const pc = peerConnectionsRef.current[msg.senderId];
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            }
          }
          break;

        case 'ice-candidate':
          // Add ICE Candidate
          if (msg.targetId === localPeerIdRef.current) {
            const pc = peerConnectionsRef.current[msg.senderId];
            if (pc && msg.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }
          }
          break;

        case 'chat':
          // Received Chat message
          setChatMessages(prev => [...prev, {
            senderId: msg.senderId,
            senderName: msg.senderName,
            text: msg.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
          break;

        case 'leave':
          // A peer left
          toast.error(`${msg.senderName} left the meeting`);
          removeParticipant(msg.senderId);
          break;

        case 'mute-change':
          // Update mic/video state of participant
          setParticipants(prev => prev.map(p => {
            if (p.id === msg.senderId) {
              return { ...p, audioMuted: msg.audioMuted, videoMuted: msg.videoMuted };
            }
            return p;
          }));
          break;
      }
    };
  };

  const createPeerConnection = async (peerId: string, peerName: string, stream: MediaStream | null, isInitiator: boolean) => {
    // Avoid duplicate connections
    if (peerConnectionsRef.current[peerId]) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnectionsRef.current[peerId] = pc;

    // Add local tracks to peer connection
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setParticipants(prev => {
        const exists = prev.some(p => p.id === peerId);
        if (exists) {
          return prev.map(p => p.id === peerId ? { ...p, stream: remoteStream } : p);
        } else {
          return [...prev, { id: peerId, name: peerName, stream: remoteStream, audioMuted: false, videoMuted: false }];
        }
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.postMessage({
          type: 'ice-candidate',
          senderId: localPeerIdRef.current,
          targetId: peerId,
          candidate: event.candidate
        });
      }
    };

    // If initiator, create and send Offer
    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (channelRef.current) {
        channelRef.current.postMessage({
          type: 'offer',
          senderId: localPeerIdRef.current,
          targetId: peerId,
          sdp: offer,
          senderName: user?.full_name || 'Guest Participant'
        });
      }
    }
  };

  const removeParticipant = (peerId: string) => {
    if (peerConnectionsRef.current[peerId]) {
      peerConnectionsRef.current[peerId].close();
      delete peerConnectionsRef.current[peerId];
    }
    setParticipants(prev => prev.filter(p => p.id !== peerId));
  };

  // Toggle Microphone
  const handleToggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicActive(audioTrack.enabled);
        
        // Notify others
        channelRef.current?.postMessage({
          type: 'mute-change',
          senderId: localPeerIdRef.current,
          audioMuted: !audioTrack.enabled,
          videoMuted: !videoActive
        });
      }
    }
  };

  // Toggle Camera
  const handleToggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoActive(videoTrack.enabled);
        
        // Notify others
        channelRef.current?.postMessage({
          type: 'mute-change',
          senderId: localPeerIdRef.current,
          audioMuted: !micActive,
          videoMuted: !videoTrack.enabled
        });
      }
    }
  };

  // Screen Share Toggle
  const handleToggleScreenShare = async () => {
    if (screenSharing) {
      // Revert to camera
      stopLocalStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        
        // Replace tracks in all peer connections
        const videoTrack = stream.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender && videoTrack) sender.replaceTrack(videoTrack);
        });
        
        setScreenSharing(false);
      } catch (err) {
        console.error(err);
      }
    } else {
      // Start screen share
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const videoTrack = stream.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender && videoTrack) sender.replaceTrack(videoTrack);
        });

        // Listen for stop sharing button
        videoTrack.onended = () => {
          handleToggleScreenShare();
        };

        setScreenSharing(true);
      } catch (err) {
        console.error(err);
        toast.error('Screen sharing canceled or failed');
      }
    }
  };

  // Send Chat message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !channelRef.current) return;

    channelRef.current.postMessage({
      type: 'chat',
      senderId: localPeerIdRef.current,
      senderName: user?.full_name || 'Guest Participant',
      text: chatInput
    });

    setChatMessages(prev => [...prev, {
      senderId: localPeerIdRef.current,
      senderName: 'You',
      text: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setChatInput('');
  };

  // Leave meeting
  const handleLeaveMeeting = () => {
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'leave',
        senderId: localPeerIdRef.current,
        senderName: user?.full_name || 'Guest Participant'
      });
    }
    stopLocalStream();
    closeAllConnections();
    toast.success('You left the meeting room');
    router.push('/dashboard/meetings');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const m = meetingData?.data;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
      {/* Top Details Bar */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 border border-dark-200 dark:border-dark-700 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={handleLeaveMeeting} className="p-2 rounded-lg bg-dark-50 dark:bg-dark-750 hover:bg-dark-100 text-dark-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-bold text-dark-900 dark:text-white flex items-center gap-1.5">
              {m?.title || 'Video Call'} 
              <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> P2P Secured
              </span>
            </h2>
            <p className="text-xs text-dark-500 mt-0.5">{m?.agenda || 'No agenda specified'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowRoster(!showRoster)} 
            className={`p-2 rounded-lg border text-dark-550 transition-colors ${showRoster ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white border-dark-200 hover:bg-dark-50'}`}
          >
            <Users className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setShowChat(!showChat)} 
            className={`p-2 rounded-lg border text-dark-550 transition-colors ${showChat ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white border-dark-200 hover:bg-dark-50'}`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Side: Video Streams Grid */}
        <div className="flex-1 bg-dark-900 dark:bg-dark-950 rounded-3xl p-5 border border-dark-800 flex flex-col justify-between relative shadow-inner overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 items-center justify-center">
            {/* Local Stream Video */}
            <div className="relative aspect-video bg-dark-850 rounded-2xl border border-dark-750 overflow-hidden shadow-md group">
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <div className="absolute left-3 bottom-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-semibold text-white">
                You ({user?.full_name})
              </div>
              <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {!micActive && <div className="bg-red-500/80 p-1 rounded"><MicOff className="w-3.5 h-3.5 text-white" /></div>}
                {!videoActive && <div className="bg-red-500/80 p-1 rounded"><VideoOff className="w-3.5 h-3.5 text-white" /></div>}
              </div>
            </div>

            {/* Remote Streams */}
            {participants.map((p) => (
              <div key={p.id} className="relative aspect-video bg-dark-850 rounded-2xl border border-dark-750 overflow-hidden shadow-md group">
                <video
                  ref={(el) => {
                    if (el && p.stream) el.srcObject = p.stream;
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute left-3 bottom-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-semibold text-white">
                  {p.name}
                </div>
                <div className="absolute right-3 top-3 flex gap-1.5">
                  {p.audioMuted && <div className="bg-red-500/80 p-1 rounded"><MicOff className="w-3.5 h-3.5 text-white" /></div>}
                  {p.videoMuted && <div className="bg-red-500/80 p-1 rounded"><VideoOff className="w-3.5 h-3.5 text-white" /></div>}
                </div>
              </div>
            ))}
          </div>

          {/* Call Controls Panel */}
          <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-dark-800/60 z-20">
            <button 
              onClick={handleToggleMic} 
              className={`p-3.5 rounded-full shadow-lg transition-transform active:scale-95 ${micActive ? 'bg-dark-800 text-white hover:bg-dark-750' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button 
              onClick={handleToggleVideo} 
              className={`p-3.5 rounded-full shadow-lg transition-transform active:scale-95 ${videoActive ? 'bg-dark-800 text-white hover:bg-dark-750' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {videoActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button 
              onClick={handleToggleScreenShare} 
              className={`p-3.5 rounded-full shadow-lg transition-transform active:scale-95 ${screenSharing ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-dark-800 text-white hover:bg-dark-750'}`}
            >
              <ScreenShare className="w-5 h-5" />
            </button>

            <button 
              onClick={handleLeaveMeeting} 
              className="p-3.5 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg transition-transform active:scale-95"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Side: Participant Roster & Live Chat */}
        {(showRoster || showChat) && (
          <div className="w-80 flex flex-col gap-4 flex-shrink-0 min-h-0">
            {/* Participant Roster */}
            {showRoster && (
              <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 border border-dark-200 dark:border-dark-700 flex flex-col h-1/3 min-h-[150px]">
                <h3 className="font-bold text-dark-900 dark:text-white text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary-500" /> Active Roster ({participants.length + 1})
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-dark-50 dark:bg-dark-850 border border-dark-100 dark:border-dark-750">
                    <span className="text-xs font-semibold text-dark-900 dark:text-white truncate">You ({user?.full_name})</span>
                    <span className="text-[10px] text-primary-600 font-bold bg-primary-100 px-1.5 py-0.5 rounded">Host</span>
                  </div>
                  {participants.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-dark-50 dark:bg-dark-850/50 border border-dark-100 dark:border-dark-750/50">
                      <span className="text-xs text-dark-800 dark:text-dark-350 truncate">{p.name}</span>
                      <span className="text-[10px] text-dark-400">Connected</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Box */}
            {showChat && (
              <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 border border-dark-200 dark:border-dark-700 flex flex-col flex-1 min-h-0">
                <h3 className="font-bold text-dark-900 dark:text-white text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-primary-500" /> Meeting Chat Log
                </h3>
                
                {/* Message list */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-dark-400">
                        <span className="font-bold">{msg.senderName}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="p-2.5 rounded-xl bg-dark-50 dark:bg-dark-850 text-xs text-dark-700 dark:text-dark-300 break-words">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <p className="text-center text-xs text-dark-400 py-10 italic">No chat messages yet.</p>
                  )}
                </div>

                {/* Form input */}
                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send message..."
                    className="input-field py-1.5 px-3 text-xs flex-1"
                  />
                  <button type="submit" className="p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
