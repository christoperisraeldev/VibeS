import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Phone, Video, MoreVertical, ArrowLeft, Paperclip, Smile, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { database } from "@/lib/firebaseClient";
import useUserProfile from "@/hooks/useUserProfile";
import { Profile } from "@/lib/firebaseClient";
import { ref, push, onValue, off, set, get, onChildAdded, remove } from "firebase/database";
import { getAuth } from "firebase/auth";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: number;
  sender?: Profile;
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  online: boolean;
  type: 'contact' | 'group';
  memberCount?: number;
}

interface ChatRoomProps {
  contact: Contact;
  onBack: () => void;
  onNavigateToOtherPages: () => void;
}

interface TypingStatus {
  userId: string;
  isTyping: boolean;
}

// Extend Profile to include id
interface UserProfile extends Profile {
  id: string;
}

export default function ChatRoom({ contact, onBack, onNavigateToOtherPages }: ChatRoomProps) {
  const { profile } = useUserProfile();
  const auth = getAuth();
  const currentUserId = auth.currentUser?.uid || '';
  
  // Create a memoized merged user profile with id
  const currentUser: UserProfile | null = useMemo(() => {
    return profile ? {
      ...profile,
      id: currentUserId
    } : null;
  }, [profile, currentUserId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize paths to prevent dependency issues
  const messagesPath = useMemo(() => `messages/${contact.id}`, [contact.id]);
  const typingStatusPath = useMemo(() => `typingStatus/${contact.id}`, [contact.id]);

  // Typing indicator functions
  const setTypingIndicator = useCallback(async (isTyping: boolean) => {
    if (!contact.id || !currentUserId) return;
    
    const userTypingRef = ref(database, `${typingStatusPath}/${currentUserId}`);
    
    if (isTyping) {
      await set(userTypingRef, {
        userId: currentUserId,
        isTyping: true
      });
    } else {
      await remove(userTypingRef);
    }
  }, [contact.id, currentUserId, typingStatusPath]);

  const removeTypingIndicator = useCallback(() => {
    setTypingIndicator(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [setTypingIndicator]);

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    if (!contact.id) return;
    
    const messagesRef = ref(database, messagesPath);
    const snapshot = await get(messagesRef);
    
    if (snapshot.exists()) {
      const messagesData = snapshot.val();
      const messagesArray: Message[] = Object.keys(messagesData).map(key => ({
        id: key,
        ...messagesData[key]
      })).sort((a, b) => a.created_at - b.created_at);
      
      setMessages(messagesArray);
    }
  }, [contact.id, messagesPath]);

  // Set up real-time subscription
  const setupRealtime = useCallback(() => {
    if (!contact.id || !currentUserId) return;
    
    // Listen for new messages
    const messagesRef = ref(database, messagesPath);
    const unsubscribeMessages = onChildAdded(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const newMessage: Message = {
          id: snapshot.key!,
          ...snapshot.val()
        };
        
        // Don't show user's own messages twice
        if (newMessage.sender_id !== currentUserId) {
          setMessages(prev => [...prev, newMessage]);
        }
      }
    });
    
    // Listen for typing indicators
    const typingStatusRef = ref(database, typingStatusPath);
    const unsubscribeTyping = onValue(typingStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        const typingStatus = snapshot.val() as Record<string, TypingStatus>;
        const typingUsers = Object.values(typingStatus).filter(
          status => status.userId !== currentUserId && status.isTyping
        );
        setIsTyping(typingUsers.length > 0);
      } else {
        setIsTyping(false);
      }
    });
    
    return () => {
      off(messagesRef, 'child_added', unsubscribeMessages);
      off(typingStatusRef, 'value', unsubscribeTyping);
      removeTypingIndicator();
    };
  }, [contact.id, currentUserId, messagesPath, typingStatusPath, removeTypingIndicator]);

  // Handle sending messages
  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !contact.id || !currentUserId || !currentUser) return;
    
    // Create message data
    const messageData = {
      content: newMessage.trim(),
      sender_id: currentUserId,
      created_at: Date.now(),
    };
    
    // Push to Firebase
    try {
      const newMessageRef = push(ref(database, messagesPath));
      await set(newMessageRef, messageData);
      
      // Add to local state with Firebase ID
      setMessages(prev => [...prev, {
        ...messageData,
        id: newMessageRef.key!,
        sender: currentUser
      }]);
      
      setNewMessage("");
      removeTypingIndicator();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [newMessage, contact.id, currentUser, messagesPath, currentUserId, removeTypingIndicator]);

  // Initial setup
  useEffect(() => {
    fetchMessages();
    const cleanup = setupRealtime();
    
    return () => {
      if (cleanup) cleanup();
      removeTypingIndicator();
    };
  }, [fetchMessages, setupRealtime, removeTypingIndicator]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle typing timeout
  useEffect(() => {
    if (newMessage) {
      setTypingIndicator(true);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        setTypingIndicator(false);
      }, 2000);
    } else {
      removeTypingIndicator();
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [newMessage, setTypingIndicator, removeTypingIndicator]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  const shouldShowDateDivider = (currentMessage: Message, prevMessage?: Message) => {
    if (!prevMessage) return true;
    return formatDate(currentMessage.created_at) !== formatDate(prevMessage.created_at);
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Chat Header */}
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <Avatar className="h-10 w-10">
              <AvatarImage src={contact.avatar} />
              <AvatarFallback className={contact.type === 'group' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' : 'bg-gradient-primary text-primary-foreground'}>
                {contact.type === 'group' ? (
                  <Users className="h-5 w-5" />
                ) : (
                  contact.name.split(' ').map(n => n[0]).join('')
                )}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <h2 className="font-semibold text-foreground">{contact.name}</h2>
              <div className="flex items-center gap-2">
                {contact.type === 'group' ? (
                  <span className="text-sm text-muted-foreground">
                    {contact.memberCount} members
                  </span>
                ) : contact.online ? (
                  <>
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <span className="text-sm text-muted-foreground">Online</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Last seen recently
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {contact.type === 'contact' && (
              <>
                <Button variant="ghost" size="icon">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Video className="h-4 w-4" />
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onNavigateToOtherPages}>
                  Go to Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onBack}>
                  Back to Contacts
                </DropdownMenuItem>
                {contact.type === 'group' && (
                  <DropdownMenuItem>
                    Group Info
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : undefined;
            const showDateDivider = shouldShowDateDivider(message, prevMessage);
            const isCurrentUser = message.sender_id === currentUserId;
            const senderName = message.sender?.full_name || 'Unknown';

            return (
              <div key={message.id}>
                {/* Date Divider */}
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4">
                    <Separator className="flex-1" />
                    <Badge variant="secondary" className="mx-4 text-xs">
                      {formatDate(message.created_at)}
                    </Badge>
                    <Separator className="flex-1" />
                  </div>
                )}

                {/* Message */}
                <div className={`flex gap-3 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  {!isCurrentUser && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={message.sender?.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                        {senderName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div className={`max-w-xs md:max-w-md lg:max-w-lg space-y-1 ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Sender name for groups */}
                    {contact.type === 'group' && !isCurrentUser && (
                      <span className="text-xs text-muted-foreground px-1">
                        {senderName}
                      </span>
                    )}
                    
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isCurrentUser
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                    
                    <div className="flex items-center gap-1 px-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.created_at)}
                      </span>
                      {isCurrentUser && (
                        <div className="text-xs text-muted-foreground">
                          ✓✓
                        </div>
                      )}
                    </div>
                  </div>

                  {isCurrentUser && currentUser && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentUser.avatar_url || ''} />
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                        {currentUser.full_name?.split(' ').map(n => n[0]).join('') || 'ME'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8">
                <AvatarImage src={contact.avatar} />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                  {contact.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t border-border bg-card p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-2">
            <Button variant="ghost" size="icon" className="mb-2">
              <Paperclip className="h-4 w-4" />
            </Button>

            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                onBlur={() => setTypingIndicator(false)}
                placeholder="Type a message..."
                className="pr-10 min-h-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              size="icon"
              className="mb-2"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}