// C:\Users\USER\Desktop\vibe-study-buddies-1\src\components\chat\ContactsList.tsx
import { useState, useEffect } from "react";
import { Plus, Search, Users, MessageCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, onValue, DataSnapshot } from "firebase/database";
import { app } from "@/lib/firebaseClient"; // Adjust import path as needed

interface Contact {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: Date | null;
  unreadCount: number;
  online: boolean;
  type: 'contact' | 'group';
  memberCount?: number;
}

interface FirebaseConversation {
  name: string;
  avatar_url: string | null;
  type: 'contact' | 'group';
  member_count: number | null;
  last_message: string | null;
  last_message_at: string | null;
}

interface FirebaseUserConversation {
  unread_count: number;
}

interface ContactsListProps {
  onSelectContact: (contact: Contact) => void;
  onCreateGroup: () => void;
  onNavigateBack: () => void;
  selectedContactId?: string;
}

export default function ContactsList({ onSelectContact, onCreateGroup, onNavigateBack, selectedContactId }: ContactsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'all' | 'contacts' | 'groups'>('all');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  const auth = getAuth(app);
  const db = getDatabase(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
    });
    return unsubscribe;
  }, [auth]);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    
    // References to Firebase data
    const userConvRef = ref(db, `userConversations/${userId}`);
    const conversationsRef = ref(db, 'conversations');
    
    // Combined listener for user conversations and conversation details
    const handleUserConvData = (userConvSnapshot: DataSnapshot) => {
      const userConvData = userConvSnapshot.val() || {};
      const conversationIds = Object.keys(userConvData);
      
      // Get conversation details
      const convDetailsListener = onValue(conversationsRef, (convSnapshot) => {
        const conversationsData = convSnapshot.val() || {};
        const newContacts: Contact[] = [];
        
        conversationIds.forEach(conversationId => {
          const conversation = conversationsData[conversationId] as FirebaseConversation;
          const userConv = userConvData[conversationId] as FirebaseUserConversation;
          
          if (conversation) {
            newContacts.push({
              id: conversationId,
              name: conversation.name,
              avatar: conversation.avatar_url || "",
              lastMessage: conversation.last_message || "",
              timestamp: conversation.last_message_at ? new Date(conversation.last_message_at) : null,
              unreadCount: userConv?.unread_count || 0,
              online: false,
              type: conversation.type,
              memberCount: conversation.member_count || undefined
            });
          }
        });
        
        setContacts(newContacts);
        setLoading(false);
      }, {
        onlyOnce: true // Fetch conversation details once
      });

      return convDetailsListener; // Return the unsubscribe function
    };

    // Set up real-time listeners
    const unsubscribeUserConv = onValue(userConvRef, handleUserConvData);
    
    // Conversation update listener
    const unsubscribeConv = onValue(conversationsRef, (snapshot) => {
      const conversationsData = snapshot.val() || {};
      
      setContacts(prev => prev.map(contact => {
        const updatedConv = conversationsData[contact.id] as FirebaseConversation;
        if (!updatedConv) return contact;
        
        return {
          ...contact,
          lastMessage: updatedConv.last_message || contact.lastMessage,
          timestamp: updatedConv.last_message_at 
            ? new Date(updatedConv.last_message_at) 
            : contact.timestamp
        };
      }));
    });

    // User conversation update listener
    const unsubscribeUserConvUpdates = onValue(userConvRef, (snapshot) => {
      const userConvData = snapshot.val() || {};
      
      setContacts(prev => prev.map(contact => {
        const updatedUserConv = userConvData[contact.id] as FirebaseUserConversation;
        if (!updatedUserConv) return contact;
        
        return {
          ...contact,
          unreadCount: updatedUserConv.unread_count || 0
        };
      }));
    });

    return () => {
      // Call all unsubscribe functions
      unsubscribeUserConv();
      unsubscribeConv();
      unsubscribeUserConvUpdates();
    };
  }, [db, userId]);

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'all' || 
                      (activeTab === 'contacts' && contact.type === 'contact') ||
                      (activeTab === 'groups' && contact.type === 'group');
    return matchesSearch && matchesTab;
  });

  const formatTime = (date: Date | null) => {
    if (!date) return "";
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  return (
    <div className="h-full bg-background border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onNavigateBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Messages</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={onCreateGroup}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 bg-muted p-1 rounded-lg">
          <Button
            variant={activeTab === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('all')}
            className="flex-1 h-8"
          >
            All
          </Button>
          <Button
            variant={activeTab === 'contacts' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('contacts')}
            className="flex-1 h-8"
          >
            <MessageCircle className="h-3 w-3 mr-1" />
            Contacts
          </Button>
          <Button
            variant={activeTab === 'groups' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('groups')}
            className="flex-1 h-8"
          >
            <Users className="h-3 w-3 mr-1" />
            Groups
          </Button>
        </div>
      </div>

      {/* Contacts List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading contacts...</p>
            </div>
          ) : filteredContacts.length > 0 ? (
            filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedContactId === contact.id ? 'bg-muted' : ''
                }`}
                onClick={() => onSelectContact(contact)}
              >
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={contact.avatar} />
                    <AvatarFallback className={contact.type === 'group' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' : 'bg-gradient-primary text-primary-foreground'}>
                      {contact.type === 'group' ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        contact.name.split(' ').map(n => n[0]).join('')
                      )}
                    </AvatarFallback>
                  </Avatar>
                  {contact.online && contact.type === 'contact' && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-background"></div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground truncate">
                        {contact.name}
                      </h3>
                      {contact.type === 'group' && contact.memberCount && (
                        <span className="text-xs text-muted-foreground">
                          {contact.memberCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {contact.timestamp && (
                        <span className="text-xs text-muted-foreground">
                          {formatTime(contact.timestamp)}
                        </span>
                      )}
                      {contact.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 text-xs px-1.5">
                          {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.lastMessage || "No messages yet"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No contacts found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}