import { initializeApp, getApp, FirebaseApp } from "firebase/app";
import { getAuth, User } from "firebase/auth";
import { 
  getDatabase,
  ref, 
  get, 
  set, 
  update, 
  remove, 
  onValue, 
  off, 
  push, 
  serverTimestamp,
  DatabaseReference
} from "firebase/database";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  Video, VideoOff, Mic, MicOff, Monitor, Phone, MessageCircle, 
  X, Users, Clock, Minimize2, Maximize2, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SessionFeedbackModal from "@/components/feedback/SessionFeedbackModal";

// Firebase configuration - using VITE environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase safely
let app: FirebaseApp;
try {
  app = getApp();
} catch (e) {
  app = initializeApp(firebaseConfig);
}
const auth = getAuth(app);
const db = getDatabase(app);

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  isHost: boolean;
  isMuted: boolean;
  videoEnabled: boolean;
}

interface ChatMessage {
  id: string;
  sender: string;
  senderId: string;
  message: string;
  timestamp: number | object; // Updated for Firebase serverTimestamp
}

export default function VideoSession() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [sessionTime, setSessionTime] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("Study Session");
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("Study Partner");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isHost, setIsHost] = useState(false);

  // Get current user and session details
  const fetchSessionData = useCallback(async () => {
    const user = auth.currentUser;
    setCurrentUser(user);
    
    if (sessionId && user) {
      try {
        const sessionRef = ref(db, `study_sessions/${sessionId}`);
        const snapshot = await get(sessionRef);
        
        if (snapshot.exists()) {
          const sessionData = snapshot.val();
          setSessionTitle(sessionData.title || "Study Session");
          
          // Determine host status and set partner
          setIsHost(user.uid === sessionData.createdBy);
          if (user.uid !== sessionData.createdBy) {
            setPartnerUserId(sessionData.createdBy);
          } else if (sessionData.participants) {
            // Find another participant as partner
            const otherParticipants = Object.keys(sessionData.participants)
              .filter(uid => uid !== user.uid);
            if (otherParticipants.length > 0) {
              setPartnerUserId(otherParticipants[0]);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching session data:", error);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  // Get partner name
  const fetchPartnerName = useCallback(async () => {
    if (partnerUserId) {
      try {
        const profileRef = ref(db, `profiles/${partnerUserId}`);
        const snapshot = await get(profileRef);
        
        if (snapshot.exists()) {
          const profileData = snapshot.val();
          setPartnerName(profileData.fullName || "Study Partner");
        }
      } catch (error) {
        console.error("Error fetching partner name:", error);
      }
    }
  }, [partnerUserId]);

  useEffect(() => {
    fetchPartnerName();
  }, [fetchPartnerName]);

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Add current user to participants when joining
  useEffect(() => {
    if (!sessionId || !currentUser) return;

    const addParticipant = async () => {
      try {
        const participantRef = ref(
          db, 
          `study_sessions/${sessionId}/participants/${currentUser.uid}`
        );
        
        await set(participantRef, {
          name: currentUser.displayName || "User",
          avatar: currentUser.photoURL || "",
          isHost: isHost,
          isMuted,
          videoEnabled,
          lastActive: serverTimestamp()
        });
      } catch (error) {
        console.error("Error adding participant:", error);
      }
    };

    addParticipant();
  }, [sessionId, currentUser, isMuted, videoEnabled, isHost]);

  // Clean up participant when leaving
  useEffect(() => {
    return () => {
      if (sessionId && currentUser?.uid) {
        const participantRef = ref(
          db, 
          `study_sessions/${sessionId}/participants/${currentUser.uid}`
        );
        remove(participantRef);
      }
    };
  }, [sessionId, currentUser]);

  // Real-time participants subscription
  useEffect(() => {
    if (!sessionId) return;

    const participantsRef = ref(db, `study_sessions/${sessionId}/participants`);
    
    const unsubscribe = onValue(participantsRef, (snapshot) => {
      const participantsData: Participant[] = [];
      const participantsObj = snapshot.val() || {};
      
      Object.keys(participantsObj).forEach(key => {
        participantsData.push({
          id: key,
          ...participantsObj[key]
        });
      });
      
      setParticipants(participantsData);
    });

    return () => {
      off(participantsRef, 'value', unsubscribe);
    };
  }, [sessionId]);

  // Real-time chat messages subscription
  useEffect(() => {
    if (!sessionId) return;

    const messagesRef = ref(db, `study_sessions/${sessionId}/messages`);
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const messagesData: ChatMessage[] = [];
      const messagesObj = snapshot.val() || {};
      
      Object.keys(messagesObj).forEach(key => {
        messagesData.push({
          id: key,
          ...messagesObj[key]
        });
      });
      
      // Sort messages by timestamp (oldest first)
      messagesData.sort((a, b) => {
        const aTime = a.timestamp instanceof Object ? 0 : a.timestamp;
        const bTime = b.timestamp instanceof Object ? 0 : b.timestamp;
        return aTime - bTime;
      });
      setChatMessages(messagesData);
    });

    return () => {
      off(messagesRef, 'value', unsubscribe);
    };
  }, [sessionId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLeaveSession = () => {
    setShowFeedbackModal(true);
  };

  const handleFeedbackComplete = useCallback(async () => {
    toast({
      title: "Left Session",
      description: "You have left the study session.",
    });
    navigate("/sessions");
  }, [toast, navigate]);

  const handleToggleMute = useCallback(async () => {
    if (sessionId && currentUser) {
      try {
        const participantRef = ref(
          db, 
          `study_sessions/${sessionId}/participants/${currentUser.uid}`
        );
        
        await update(participantRef, {
          isMuted: !isMuted
        });
        
        setIsMuted(!isMuted);
        toast({
          title: isMuted ? "Microphone On" : "Microphone Off",
          description: `Your microphone is now ${isMuted ? 'unmuted' : 'muted'}.`,
        });
      } catch (error) {
        console.error("Error updating microphone status:", error);
      }
    }
  }, [sessionId, currentUser, isMuted, toast]);

  const handleToggleVideo = useCallback(async () => {
    if (sessionId && currentUser) {
      try {
        const participantRef = ref(
          db, 
          `study_sessions/${sessionId}/participants/${currentUser.uid}`
        );
        
        await update(participantRef, {
          videoEnabled: !videoEnabled
        });
        
        setVideoEnabled(!videoEnabled);
        toast({
          title: videoEnabled ? "Camera Off" : "Camera On",
          description: `Your camera is now ${videoEnabled ? 'disabled' : 'enabled'}.`,
        });
      } catch (error) {
        console.error("Error updating video status:", error);
      }
    }
  }, [sessionId, currentUser, videoEnabled, toast]);

  const handleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing);
    toast({
      title: isScreenSharing ? "Screen Share Stopped" : "Screen Share Started",
      description: `Screen sharing is now ${isScreenSharing ? 'disabled' : 'enabled'}.`,
    });
  };

  const handleSendMessage = useCallback(async () => {
    if (chatMessage.trim() && sessionId && currentUser) {
      try {
        const messagesRef = ref(
          db, 
          `study_sessions/${sessionId}/messages`
        );
        
        await push(messagesRef, {
          sender: currentUser.displayName || "User",
          senderId: currentUser.uid,
          message: chatMessage,
          timestamp: serverTimestamp()
        });
        
        setChatMessage("");
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  }, [chatMessage, sessionId, currentUser]);

  // Format message timestamp for display
  const formatMessageTime = (timestamp: number | object) => {
    if (typeof timestamp !== 'number') {
      return "Just now";
    }
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">{sessionTitle}</h1>
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(sessionTime)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowChat(!showChat)}
              className="text-white hover:bg-white/10"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-screen pt-16">
        {/* Video Grid */}
        <div className={`flex-1 p-4 transition-all duration-300 ${showChat ? 'mr-80' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {participants.map((participant) => (
              <Card key={participant.id} className="bg-gray-900 border-gray-700 relative overflow-hidden">
                <CardContent className="p-0 h-full relative">
                  {participant.videoEnabled ? (
                    <div className="w-full h-full bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
                      <div className="text-6xl">📹</div>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <Avatar className="h-20 w-20">
                        <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl">
                          {participant.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  
                  {/* Participant Info */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-2">
                    <Badge variant={participant.isHost ? "default" : "secondary"} className="text-xs">
                      {participant.name}
                      {participant.isHost && " (Host)"}
                    </Badge>
                    {participant.isMuted && (
                      <div className="p-1 bg-red-500 rounded">
                        <MicOff className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Chat</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowChat(false)}
                  className="text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((message) => (
                <div key={message.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-medium">{message.sender}</span>
                    <span>{formatMessageTime(message.timestamp)}</span>
                  </div>
                  <p className="text-sm text-white">{message.message}</p>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <Input
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="bg-gray-800 border-gray-600 text-white"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage} size="icon">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-t border-white/10">
        <div className="flex items-center justify-center gap-4 p-4">
          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="icon"
            onClick={handleToggleMute}
            className="h-12 w-12"
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={videoEnabled ? "secondary" : "destructive"}
            size="icon"
            onClick={handleToggleVideo}
            className="h-12 w-12"
          >
            {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={isScreenSharing ? "default" : "secondary"}
            size="icon"
            onClick={handleScreenShare}
            className="h-12 w-12"
          >
            <Monitor className="h-5 w-5" />
          </Button>
          
          <Button
            variant="destructive"
            onClick={handleLeaveSession}
            className="gap-2 h-12 px-6"
          >
            <Phone className="h-5 w-5" />
            Leave
          </Button>
        </div>
      </div>

      {/* Feedback Modal */}
      {sessionId && partnerUserId && (
        <SessionFeedbackModal
          isOpen={showFeedbackModal}
          onClose={handleFeedbackComplete}
          partnerName={partnerName}
          partnerUserId={partnerUserId}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
        />
      )}
    </div>
  );
}