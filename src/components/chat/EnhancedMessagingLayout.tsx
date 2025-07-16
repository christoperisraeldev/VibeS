import React, { useState, useRef, useEffect, useContext } from "react";
import { MessageCircle, Search, MoreVertical, Paperclip, Send, Calendar, Video, Phone, Smile, FileText, Image, FileVideo, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { database } from "@/lib/firebaseClient";
import { ref, get, push, set, onChildAdded, off, update, serverTimestamp } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const EMOJI_LIST = ["😊", "😂", "❤️", "👍", "👎", "😢", "😮", "😡", "🎉", "🔥", "📚", "✅", "❌", "🤔", "💡"];

// User context types
interface User {
  id: string;
  email?: string;
  full_name?: string;
}

interface UserContextValue {
  user: User | null;
}

const UserContext = React.createContext<UserContextValue>({ user: null });

// Types for our data
interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  online?: boolean;
}

interface Conversation {
  id: string;
  created_at: string;
  user1: string;
  user2: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  type: 'text' | 'image' | 'document' | 'video';
}

interface EnhancedConversation extends Conversation {
  other_user: Profile;
  online: boolean;
}

export default function EnhancedMessagingLayout() {
  const { toast } = useToast();
  const { user } = useContext(UserContext);
  const [conversations, setConversations] = useState<EnhancedConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<EnhancedConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Get Firebase storage instance
  const storage = getStorage();

  // Fetch conversations
  useEffect(() => {
    if (!currentUser?.uid) return;

    const fetchConversations = async () => {
      setLoading(true);
      
      try {
        // Fetch conversations where current user is either user1 or user2
        const convRef = ref(database, 'conversations');
        const convSnapshot = await get(convRef);
        
        if (!convSnapshot.exists()) {
          setLoading(false);
          return;
        }
        
        const conversationsData: Conversation[] = [];
        convSnapshot.forEach(childSnapshot => {
          const conv = childSnapshot.val();
          if (conv.user1 === currentUser.uid || conv.user2 === currentUser.uid) {
            conversationsData.push({
              id: childSnapshot.key as string,
              ...conv
            });
          }
        });

        // Extract unique user IDs from conversations
        const userIds = new Set<string>();
        conversationsData.forEach(conv => {
          userIds.add(conv.user1);
          userIds.add(conv.user2);
        });

        // Fetch profiles for all users in conversations
        const profilesMap: Record<string, Profile> = {};
        for (const userId of userIds) {
          const profileRef = ref(database, `users/${userId}`);
          const profileSnapshot = await get(profileRef);
          if (profileSnapshot.exists()) {
            profilesMap[userId] = profileSnapshot.val();
          }
        }

        // Create enhanced conversations with other user's profile
        const enhancedConversations = conversationsData.map(conv => {
          const otherUserId = conv.user1 === currentUser.uid ? conv.user2 : conv.user1;
          return {
            ...conv,
            other_user: profilesMap[otherUserId],
            online: profilesMap[otherUserId]?.online || false
          };
        });

        setProfiles(profilesMap);
        setConversations(enhancedConversations);
        
        // Select first conversation by default
        if (enhancedConversations.length > 0) {
          setSelectedConversation(enhancedConversations[0]);
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
        toast({
          title: "Error",
          description: "Could not load conversations",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [currentUser?.uid, toast]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversation?.id) return;

    const fetchMessages = async () => {
      try {
        const messagesRef = ref(database, `messages/${selectedConversation.id}`);
        const messagesSnapshot = await get(messagesRef);
        
        if (!messagesSnapshot.exists()) {
          setMessages([]);
          return;
        }
        
        const messagesData: Message[] = [];
        messagesSnapshot.forEach(childSnapshot => {
          const message = childSnapshot.val();
          messagesData.push({
            id: childSnapshot.key as string,
            ...message
          });
        });
        
        // Sort by timestamp
        messagesData.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        setMessages(messagesData);
      } catch (error) {
        console.error("Error fetching messages:", error);
        toast({
          title: "Error",
          description: "Could not load messages",
          variant: "destructive"
        });
      }
    };

    fetchMessages();
  }, [selectedConversation?.id, toast]);

  // Setup real-time listener for messages
  useEffect(() => {
    if (!selectedConversation?.id || !currentUser?.uid) return;

    const messagesRef = ref(database, `messages/${selectedConversation.id}`);
    const unsubscribe = onChildAdded(messagesRef, (snapshot) => {
      const newMessage = {
        id: snapshot.key as string,
        ...snapshot.val()
      };
      
      setMessages(prev => {
        // Check if message already exists
        if (prev.some(msg => msg.id === newMessage.id)) {
          return prev;
        }
        
        return [...prev, newMessage];
      });
    });

    return () => {
      off(messagesRef, 'child_added', unsubscribe);
    };
  }, [selectedConversation?.id, currentUser?.uid]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser?.uid) return;

    try {
      // Add new message
      const messagesRef = ref(database, `messages/${selectedConversation.id}`);
      const newMessageRef = push(messagesRef);
      
      await set(newMessageRef, {
        conversation_id: selectedConversation.id,
        sender_id: currentUser.uid,
        content: newMessage,
        type: 'text',
        created_at: serverTimestamp()
      });

      // Update conversation last message
      const convRef = ref(database, `conversations/${selectedConversation.id}`);
      await update(convRef, {
        last_message: newMessage,
        last_message_at: serverTimestamp()
      });

      setNewMessage("");
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleFileUpload = async (type: string) => {
    if (!selectedConversation || !currentUser?.uid) return;

    const input = document.createElement('input');
    input.type = 'file';
    
    switch (type) {
      case 'image':
        input.accept = 'image/*';
        break;
      case 'document':
        input.accept = '.pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx';
        break;
      case 'video':
        input.accept = 'video/*';
        break;
    }

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files[0]) {
        const file = files[0];
        const fileName = `${Date.now()}-${file.name}`;
        
        try {
          // Upload file to Firebase Storage
          const fileRef = storageRef(storage, `chat_attachments/${fileName}`);
          const uploadResult = await uploadBytes(fileRef, file);
          const downloadURL = await getDownloadURL(uploadResult.ref);

          // Add message with file URL
          const messagesRef = ref(database, `messages/${selectedConversation.id}`);
          const newMessageRef = push(messagesRef);
          
          await set(newMessageRef, {
            conversation_id: selectedConversation.id,
            sender_id: currentUser.uid,
            content: downloadURL,
            type: type as 'image' | 'document' | 'video',
            created_at: serverTimestamp()
          });

          // Update conversation last message
          const convRef = ref(database, `conversations/${selectedConversation.id}`);
          await update(convRef, {
            last_message: `📎 ${file.name}`,
            last_message_at: serverTimestamp()
          });

          toast({
            title: "File Uploaded",
            description: `${file.name} has been attached to your message.`,
          });
        } catch (error) {
          console.error("Error uploading file:", error);
          toast({
            title: "Upload Failed",
            description: "Could not upload file",
            variant: "destructive"
          });
        }
      }
    };

    input.click();
    setShowAttachMenu(false);
  };

  const startVideoCall = () => {
    if (!selectedConversation) return;
    
    setIsVideoCallActive(true);
    toast({
      title: "Video Call Started",
      description: `Calling ${selectedConversation.other_user.full_name}...`,
    });
  };

  const startAudioCall = () => {
    if (!selectedConversation) return;
    
    toast({
      title: "Audio Call Started",
      description: `Calling ${selectedConversation.other_user.full_name}...`,
    });
  };

  const handleProposeSession = () => {
    if (!selectedConversation) return;
    
    toast({
      title: "Study Session Proposed",
      description: `Sent a study session request to ${selectedConversation.other_user.full_name}`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <p>Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <MessageCircle className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">Messages</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
          {/* Conversations List */}
          <Card className="shadow-medium lg:col-span-1">
            <CardContent className="p-0 h-full flex flex-col">
              {/* Search */}
              <div className="p-4 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search conversations..." className="pl-10" />
                </div>
              </div>

              {/* Conversations */}
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>No conversations found</p>
                    <p className="text-sm mt-2">Start a new conversation from a study group</p>
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`p-4 border-b border-border cursor-pointer transition-colors hover:bg-accent/50 ${
                        selectedConversation?.id === conversation.id ? 'bg-accent' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={conversation.other_user.avatar_url || ""} />
                            <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                              {conversation.other_user.full_name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          {conversation.online && (
                            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-background rounded-full" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-foreground truncate">
                              {conversation.other_user.full_name}
                            </h3>
                            {conversation.last_message_at && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(conversation.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {conversation.last_message || "Start a conversation"}
                          </p>
                        </div>
                        
                        {conversation.unread_count && conversation.unread_count > 0 && (
                          <Badge variant="default" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                            {conversation.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chat View */}
          <Card className="shadow-medium lg:col-span-2">
            <CardContent className="p-0 h-full flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={selectedConversation.other_user.avatar_url || ""} />
                          <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                            {selectedConversation.other_user.full_name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {selectedConversation.other_user.full_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedConversation.online ? "Online" : "Offline"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={handleProposeSession}>
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={startAudioCall}>
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={startVideoCall}>
                          <Video className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <MessageCircle className="h-12 w-12 mb-4" />
                        <p>No messages yet</p>
                        <p className="text-sm mt-1">Send a message to start the conversation</p>
                      </div>
                    ) : (
                      <>
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.sender_id === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[70%] ${message.sender_id === currentUser?.uid ? 'order-2' : 'order-1'}`}>
                              <div
                                className={`rounded-lg px-4 py-2 ${
                                  message.sender_id === currentUser?.uid
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-foreground'
                                }`}
                              >
                                {message.type === 'text' ? (
                                  <p className="text-sm">{message.content}</p>
                                ) : (
                                  <a 
                                    href={message.content} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm underline hover:text-blue-500"
                                  >
                                    {message.type === 'image' ? '📷 Image' : 
                                     message.type === 'video' ? '🎬 Video' : '📄 Document'}
                                  </a>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 px-1">
                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {message.sender_id === currentUser?.uid && <span className="ml-2">✓✓</span>}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-border">
                    <div className="flex items-end gap-2">
                      {/* Attachment Menu */}
                      <div className="relative">
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => setShowAttachMenu(!showAttachMenu)}
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        
                        {showAttachMenu && (
                          <div className="absolute bottom-12 left-0 bg-card border border-border rounded-lg shadow-lg p-2 space-y-1 min-w-40">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full justify-start gap-2"
                              onClick={() => handleFileUpload('image')}
                            >
                              <Image className="h-4 w-4" />
                              Image
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full justify-start gap-2"
                              onClick={() => handleFileUpload('document')}
                            >
                              <FileText className="h-4 w-4" />
                              Document
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full justify-start gap-2"
                              onClick={() => handleFileUpload('video')}
                            >
                              <FileVideo className="h-4 w-4" />
                              Video
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Message Input Field */}
                      <div className="flex-1 relative">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          className="pr-10"
                        />
                        
                        {/* Emoji Button */}
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          >
                            <Smile className="h-4 w-4" />
                          </Button>
                          
                          {/* Emoji Picker */}
                          {showEmojiPicker && (
                            <div className="absolute bottom-10 right-0 bg-card border border-border rounded-lg shadow-lg p-3 min-w-64">
                              <div className="grid grid-cols-5 gap-2">
                                {EMOJI_LIST.map((emoji) => (
                                  <Button
                                    key={emoji}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleEmojiSelect(emoji)}
                                  >
                                    {emoji}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Send Button */}
                      <Button 
                        onClick={handleSendMessage} 
                        disabled={!newMessage.trim()}
                        className="px-4"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
                  <MessageCircle className="h-16 w-16 mb-4" />
                  <h3 className="text-lg font-medium">No conversation selected</h3>
                  <p className="text-sm mt-1">Select a conversation or start a new one</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Video Call Dialog */}
      <Dialog open={isVideoCallActive} onOpenChange={setIsVideoCallActive}>
        <DialogContent className="max-w-4xl h-[600px]">
          <DialogHeader>
            <DialogTitle>
              Video Call with {selectedConversation?.other_user.full_name || "User"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-black rounded-lg relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Video call simulation</p>
                <p className="text-sm opacity-75">In a real app, this would show video feeds</p>
              </div>
            </div>
            
            {/* Call Controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
              <Button size="icon" variant="outline" className="bg-background/20 border-white/20">
                <Video className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" className="bg-background/20 border-white/20">
                <Phone className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="destructive"
                onClick={() => setIsVideoCallActive(false)}
              >
                <Phone className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}