import { useState, useEffect, useRef } from "react";
import { MessageCircle, Search, MoreVertical, Paperclip, Send, Calendar, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAuth } from "firebase/auth";
import { database } from "@/lib/firebaseClient";
import { ref, get, push, set, onChildAdded, off, query, orderByChild, update, serverTimestamp } from "firebase/database";
import { format, formatDistanceToNow } from "date-fns";

// Define TypeScript interfaces
interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  status: string;
}

interface Group {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
}

interface Connection {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
}

interface GroupMember {
  group: Group;
}

interface Conversation {
  id: string;
  type: "connection" | "group";
  name: string;
  avatar: string | null;
  status: string;
  lastUpdated: string;
}

interface FirebaseMessage {
  sender_id: string;
  content: string;
  created_at: string;
  connection_id?: string;
  group_id?: string;
}

interface FirebaseMessageWithId extends FirebaseMessage {
  id: string;
}

interface FormattedMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
}

export default function MessagingLayout() {
  const { toast } = useToast();
  const auth = getAuth();
  const user = auth.currentUser;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<FormattedMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user's connections and groups
  useEffect(() => {
    if (!user) return;
    
    const fetchConversations = async () => {
      setLoading(true);
      
      try {
        // Fetch direct message connections
        const connectionsRef = ref(database, 'connections');
        const connectionsSnapshot = await get(connectionsRef);
        
        const connections: Connection[] = [];
        if (connectionsSnapshot.exists()) {
          connectionsSnapshot.forEach(snapshot => {
            const connection = snapshot.val();
            if ((connection.user1_id === user.uid || connection.user2_id === user.uid) && 
                connection.status === "accepted") {
              connections.push({
                id: snapshot.key as string,
                ...connection
              });
            }
          });
        }

        // Fetch group conversations
        const groupMembersRef = ref(database, 'groupMembers');
        const groupMembersSnapshot = await get(groupMembersRef);
        
        const groups: GroupMember[] = [];
        if (groupMembersSnapshot.exists()) {
          groupMembersSnapshot.forEach(snapshot => {
            const groupData = snapshot.val();
            if (groupData.user_id === user.uid) {
              groups.push({
                group: {
                  id: snapshot.key as string,
                  ...groupData.group
                }
              });
            }
          });
        }

        // Fetch profiles for connection users
        const profilePromises: Promise<Profile>[] = [];
        const userIds = new Set<string>();
        
        connections.forEach(conn => {
          if (conn.user1_id === user.uid) userIds.add(conn.user2_id);
          if (conn.user2_id === user.uid) userIds.add(conn.user1_id);
        });

        for (const userId of userIds) {
          const profileRef = ref(database, `profiles/${userId}`);
          profilePromises.push(get(profileRef).then(snapshot => ({
            id: userId,
            ...snapshot.val()
          })));
        }

        const profiles = await Promise.all(profilePromises);
        const profilesMap = new Map(profiles.map(p => [p.id, p]));

        // Format conversations
        const formattedConnections = connections.map(conn => {
          const otherUserId = conn.user1_id === user.uid ? conn.user2_id : conn.user1_id;
          const otherUser = profilesMap.get(otherUserId);
          
          return {
            id: conn.id,
            type: "connection" as const,
            name: otherUser?.full_name || otherUser?.username || "Unknown",
            avatar: otherUser?.avatar_url || null,
            status: otherUser?.status || "offline",
            lastUpdated: conn.created_at
          };
        });

        const formattedGroups = groups.map(member => ({
          id: member.group.id,
          type: "group" as const,
          name: member.group.name,
          avatar: null,
          status: "group",
          lastUpdated: member.group.created_at
        }));

        setConversations([...formattedConnections, ...formattedGroups]);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching conversations:", error);
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user]);

  // Fetch messages when a conversation is selected
  useEffect(() => {
    if (!selectedConversation || !user) return;

    const fetchMessages = async () => {
      try {
        let messagesPath = '';
        if (selectedConversation.type === "connection") {
          messagesPath = `messages/connections/${selectedConversation.id}`;
        } else if (selectedConversation.type === "group") {
          messagesPath = `messages/groups/${selectedConversation.id}`;
        } else {
          return;
        }

        const messagesRef = ref(database, messagesPath);
        const messagesQuery = query(messagesRef, orderByChild("created_at"));
        const messagesSnapshot = await get(messagesQuery);
        
        if (!messagesSnapshot.exists()) {
          setMessages([]);
          return;
        }
        
        const messagesData: FirebaseMessageWithId[] = [];
        messagesSnapshot.forEach(childSnapshot => {
          messagesData.push({
            id: childSnapshot.key as string,
            ...childSnapshot.val()
          });
        });
        
        // Format messages with sender info
        const formattedMessages = await Promise.all(
          messagesData.map(async (msg) => {
            const senderRef = ref(database, `profiles/${msg.sender_id}`);
            const senderSnapshot = await get(senderRef);
            const sender = senderSnapshot.exists() ? senderSnapshot.val() : null;
            
            return {
              id: msg.id,
              sender: sender?.full_name || "Unknown",
              content: msg.content,
              timestamp: format(new Date(msg.created_at), "h:mm a"),
              isOwn: msg.sender_id === user.uid
            };
          })
        );
        
        // Sort by timestamp just in case
        formattedMessages.sort((a, b) => 
          new Date(messagesData.find(m => m.id === a.id)?.created_at).getTime() - 
          new Date(messagesData.find(m => m.id === b.id)?.created_at).getTime()
        );
        
        setMessages(formattedMessages);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    fetchMessages();
  }, [selectedConversation, user]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user || !selectedConversation) return;

    let messagesPath = '';
    if (selectedConversation.type === "connection") {
      messagesPath = `messages/connections/${selectedConversation.id}`;
    } else if (selectedConversation.type === "group") {
      messagesPath = `messages/groups/${selectedConversation.id}`;
    } else {
      return;
    }

    // Listen for new messages
    const messagesRef = ref(database, messagesPath);
    const unsubscribeMessages = onChildAdded(messagesRef, async (snapshot) => {
      const newMessageData: FirebaseMessage = snapshot.val();
      const senderRef = ref(database, `profiles/${newMessageData.sender_id}`);
      const senderSnapshot = await get(senderRef);
      const sender = senderSnapshot.exists() ? senderSnapshot.val() : null;

      const newMessage: FormattedMessage = {
        id: snapshot.key as string,
        sender: sender?.full_name || "Unknown",
        content: newMessageData.content,
        timestamp: format(new Date(newMessageData.created_at), "h:mm a"),
        isOwn: newMessageData.sender_id === user.uid
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      // Update conversation lastUpdated
      setConversations(prev => prev.map(conv => {
        if (conv.id === selectedConversation.id) {
          return { ...conv, lastUpdated: newMessageData.created_at };
        }
        return conv;
      }));
    });

    // Listen for profile status updates
    const statusUpdatesRef = ref(database, 'profiles');
    const unsubscribeStatus = onChildAdded(statusUpdatesRef, (snapshot) => {
      const updatedProfile: Profile = snapshot.val();
      setConversations(prev => prev.map(conv => {
        if (conv.type === "connection" && 
            conv.id === snapshot.key) {
          return { ...conv, status: updatedProfile.status || "offline" };
        }
        return conv;
      }));
    });

    return () => {
      off(messagesRef, 'child_added', unsubscribeMessages);
      off(statusUpdatesRef, 'child_added', unsubscribeStatus);
    };
  }, [user, selectedConversation]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    try {
      const messageData: FirebaseMessage = {
        sender_id: user.uid,
        content: newMessage,
        created_at: serverTimestamp() as unknown as string
      };

      let messagesPath = '';
      if (selectedConversation.type === "connection") {
        messageData.connection_id = selectedConversation.id;
        messagesPath = `messages/connections/${selectedConversation.id}`;
      } else if (selectedConversation.type === "group") {
        messageData.group_id = selectedConversation.id;
        messagesPath = `messages/groups/${selectedConversation.id}`;
      }

      const newMessageRef = push(ref(database, messagesPath));
      await set(newMessageRef, messageData);

      // Update conversation lastUpdated
      const convPath = selectedConversation.type === "connection" 
        ? `connections/${selectedConversation.id}`
        : `groups/${selectedConversation.id}`;
      
      await update(ref(database, convPath), {
        lastUpdated: serverTimestamp()
      });

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Message failed",
        description: "Could not send your message. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleProposeSession = () => {
    if (!selectedConversation) return;
    
    toast({
      title: "Study Session Proposed",
      description: `Sent a study session request to ${selectedConversation.name}`,
    });
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
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
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading conversations...</div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No conversations found</div>
                ) : (
                  conversations.map((conversation) => (
                    <div
                      key={`${conversation.type}-${conversation.id}`}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`p-4 border-b border-border cursor-pointer transition-colors hover:bg-accent/50 ${
                        selectedConversation?.id === conversation.id ? 'bg-accent' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={conversation.avatar || ""} />
                            <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                              {conversation.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          {conversation.status === "online" && (
                            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-background rounded-full" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-foreground truncate">{conversation.name}</h3>
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(conversation.lastUpdated)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {conversation.type === "group" ? "Group chat" : "Direct message"}
                          </p>
                        </div>
                        
                        {/* Unread badge placeholder */}
                        {/* {conversation.unread > 0 && (
                          <Badge variant="default" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                            {conversation.unread}
                          </Badge>
                        )} */}
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
              {/* Chat Header */}
              {selectedConversation ? (
                <>
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={selectedConversation.avatar || ""} />
                          <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                            {selectedConversation.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-foreground">{selectedConversation.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedConversation.type === "group" 
                              ? "Group chat" 
                              : selectedConversation.status === "online" 
                                ? "Online" 
                                : "Offline"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={handleProposeSession}>
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon">
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
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        No messages yet. Start the conversation!
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${message.isOwn ? 'order-2' : 'order-1'}`}>
                            {!message.isOwn && (
                              <p className="text-xs text-muted-foreground mb-1 ml-1">
                                {message.sender}
                              </p>
                            )}
                            <div
                              className={`rounded-lg px-4 py-2 ${
                                message.isOwn
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-foreground'
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 px-1">
                              {message.timestamp}
                              {message.isOwn && <span className="ml-2">✓✓</span>}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-border">
                    <div className="flex items-end gap-2">
                      <Button variant="outline" size="icon">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <div className="flex-1">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          className="resize-none"
                        />
                      </div>
                      <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select a conversation to start chatting
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}