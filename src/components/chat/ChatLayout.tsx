import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ContactsList from "./ContactsList";
import CreateGroup from "./CreateGroup";
import ChatRoom from "./ChatRoom";

export interface Contact {
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

export interface User {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
}

type ViewType = 'contacts' | 'chat' | 'create-group';

export default function ChatLayout() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewType>('contacts');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setCurrentView('chat');
  };

  const handleCreateGroup = () => {
    setCurrentView('create-group');
  };

  const handleGroupCreated = (groupName: string, selectedUsers: User[]) => {
    const newGroup: Contact = {
      id: crypto.randomUUID(),
      name: groupName,
      avatar: "",
      lastMessage: "Group created",
      timestamp: new Date(),
      unreadCount: 0,
      online: false,
      type: 'group',
      memberCount: selectedUsers.length
    };
    
    setSelectedContact(newGroup);
    setCurrentView('chat');
  };

  const handleBackToContacts = () => {
    setCurrentView('contacts');
    setSelectedContact(null);
  };

  const handleNavigateBack = () => {
    navigate('/dashboard');
  };

  const handleBackFromCreateGroup = () => {
    setCurrentView('contacts');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'contacts':
        return (
          <ContactsList
            onSelectContact={handleSelectContact}
            onCreateGroup={handleCreateGroup}
            onNavigateBack={handleNavigateBack}
            selectedContactId={selectedContact?.id}
          />
        );
      
      case 'create-group':
        return (
          <CreateGroup
            onClose={handleBackFromCreateGroup}
            onGroupCreated={handleGroupCreated}
          />
        );
      
      case 'chat':
        return selectedContact ? (
          <ChatRoom
            contact={selectedContact}
            onBack={handleBackToContacts}
            onNavigateToOtherPages={handleNavigateBack}
          />
        ) : null;
      
      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-background">
      {renderCurrentView()}
    </div>
  );
}